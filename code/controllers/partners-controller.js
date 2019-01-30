const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { check, body, query } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Utilities
const { Email } = require("shared/utilities");
const { Database } = require("shared/utilities");
const schedule = require("node-schedule");

// Models
const { Partner } = require("shared/models");
const { PartnerUser } = require("shared/models");
const { PartnerSnapshot } = require("shared/models");

// Constants
const DOMAIN = process.env.DOMAIN;
const NODE_ENV = process.env.NODE_ENV;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * Monthly Scheduled Snapshot
 *
 *********************************************/

if (NODE_ENV === "production") {
  var scheduledCheck = schedule.scheduleJob('0 0 * * *', snapshotEachPartner); // midnight every day, snapshot each partner
}

function snapshotEachPartner() {
  return Partner.list()
    .then( partners => {
      let chain = Promise.resolve();
      for (const partner of partners) {
        chain = chain.then(() => {
          Logger.info("Snapshotting " + partner.title + " - " + partner.code);
          return partner.getCurrentSnapshot();
        })
        .then(snapshot => {
          Logger.info("Saving snapshot for " + partner.title + " - " + partner.code);
          return snapshot.save();
        })
      }
      return chain;
    });
}

/*********************************************
 *
 * Partners Management Page
 *
 *********************************************/

router.get("/partners",
authenticate,
(request, response, next) => {
  var partners;
  var partnerUsers;
  return Partner.list()
  .then(result => {
    partners = result;
    return PartnerUser.list();
  })
  .then(result => {
    partnerUsers = result;
    return PartnerSnapshot.list();
  })
  .then(result => {
    response.render("partners", {
      partners: partners,
      partnerUsers: partnerUsers,
      partnerSnapshots: result
    });
  })
  .catch(error => { next(error); });
});

/*********************************************
 *
 * New Partner
 *
 *********************************************/

router.post("/new-partner",
[
  authenticate,
  body("newPartnerTitle")
    .exists().withMessage("Missing title.")
    .not().isEmpty().withMessage("Missing title."),
  body("newPartnerCode")
    .exists().withMessage("Missing code.")
    .not().isEmpty().withMessage("Missing code.")
    .isAlphanumeric()
    .isLowercase().withMessage("Partner Code must be lowercase.")
    .isLength({ min: 1, max: 100 }).withMessage("Code must be between 1 and 100 characters."),
  body("newPartnerPercentageShare")
    .exists().withMessage("Missing percentage share.")
    .not().isEmpty().withMessage("Missing percentage share.")
    .isInt({ min: 0, max: 100}).withMessage("Percentage share must be integer between 0 and 100."),
  validateCheck
],
(request, response, next) => {
  const newPartnerTitle = request.values.newPartnerTitle;
  const newPartnerCode = request.values.newPartnerCode;
  const newPartnerPercentageShare = request.values.newPartnerPercentageShare;
  
  return Partner.create(newPartnerTitle, newPartnerCode, newPartnerPercentageShare)
    .then(partner => {
      Email.sendAdminAlert("New Partner Created.",
      `Partner Title: ${partner.title}
  Partner Code: ${partner.code}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Partner created successfully.", "/partners");
    })
    .catch( error => next(error) );
});

router.post("/delete-partner",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 100 }).withMessage("ID must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  return Partner.delete(id)
    .then(partner => {
      Email.sendAdminAlert("Partner deleted.",
      `ID: ${partner.id}
  Title: ${partner.title}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Partner deleted successfully.", "/partners");
    })
    .catch( error => next(error) );
});

/*********************************************
 *
 * New Partner User
 *
 *********************************************/

router.post("/new-partner-user",
[
  authenticate,
  body("newPartnerUserEmail")
    .exists().withMessage("Missing email address.")
    .isEmail().withMessage("Invalid email address.")
    .normalizeEmail(),
  body("newPartnerUserPassword")
    .exists().withMessage("Missing password.")
    .not().isEmpty().withMessage("Missing password.")
    .isLength({ min: 8, max: 50 }).withMessage("Password must be at least 8 characters long."),
  body("newPartnerUserCode")
    .exists().withMessage("Missing code.")
    .not().isEmpty().withMessage("Missing code.")
    .isAlphanumeric()
    .isLowercase().withMessage("Partner Code must be lowercase.")
    .isLength({ min: 1, max: 100 }).withMessage("Code must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const newPartnerUserEmail = request.values.newPartnerUserEmail;
  const newPartnerUserPassword = request.values.newPartnerUserPassword;
  const newPartnerUserCode = request.values.newPartnerUserCode;
  
  return PartnerUser.create(newPartnerUserEmail, newPartnerUserPassword, newPartnerUserCode)
    .then(partnerUser => {
      Email.sendAdminAlert("New Partner User Created.",
      `Partner Email: ${partnerUser.email}
  Partner Code: ${partnerUser.partnerCode}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Partner user created successfully.", "/partners");
    })
    .catch( error => next(error) );
});

router.post("/delete-partner-user",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 100 }).withMessage("ID must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  
  return PartnerUser.delete(id)
    .then(partnerUser => {
      Email.sendAdminAlert("Partner User deleted.",
      `ID: ${partnerUser.id}
  Partner Email: ${partnerUser.email}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Partner user deleted successfully.", "/partners");
    })
    .catch( error => next(error) );
});

/*********************************************
 *
 * Get Current Snapshot For Partner
 *
 *********************************************/

router.post("/current-snapshot",
[
  authenticate,
  body("partnerCode")
    .exists().withMessage("Missing code.")
    .not().isEmpty().withMessage("Missing code.")
    .isAlphanumeric()
    .isLowercase().withMessage("Partner Code must be lowercase.")
    .isLength({ min: 1, max: 100 }).withMessage("Code must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const partnerCode = request.values.partnerCode;
  
  return Partner.getWithCode(partnerCode)
    .then(partner => {
      return partner.getCurrentSnapshot()
    })
    .then(snapshot => {
      response.status(200).json(snapshot);
    })
    .catch( error => next(error) );
});

router.post("/save-snapshot",
[
  authenticate,
  body("partnerCode")
    .exists().withMessage("Missing code.")
    .not().isEmpty().withMessage("Missing code.")
    .isAlphanumeric()
    .isLowercase().withMessage("Partner Code must be lowercase.")
    .isLength({ min: 1, max: 100 }).withMessage("Code must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const partnerCode = request.values.partnerCode;
  
  return Partner.getWithCode(partnerCode)
    .then(partner => {
      return partner.getCurrentSnapshot()
    })
    .then(snapshot => {
      return snapshot.save();
    })
    .then(result => {
      response.status(200).json({
        success: true
      });
    })
    .catch( error => next(error) );
});

router.post("/delete-snapshot",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 100 }).withMessage("ID must be between 1 and 100 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  return PartnerSnapshot.delete(id)
    .then(result => {
      Email.sendAdminAlert("Partner Snapshot deleted.",
      `ID: ${result.id}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Partner snapshot deleted successfully.", "/partners");
    })
    .catch( error => next(error) );
});

module.exports = router;