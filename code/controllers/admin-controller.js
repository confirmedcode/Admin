const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { body } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Models
const { User } = require("shared/models");
const { Source } = require("shared/models");
const { RuleFile } = require("shared/models");
const { ClientFile } = require("shared/models");

// Utilities
const { Database } = require("shared/utilities");
const { Email } = require("shared/utilities");
const { Secure } = require("shared/utilities");
const multer = require("multer");
const upload = multer({ dest : "../uploads" });
const aws = require("aws-sdk");
const ec2 = new aws.EC2();

const ENVIRONMENT = process.env.ENVIRONMENT;
const CERT_ACCESS_SECRET = process.env.CERT_ACCESS_SECRET;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * Admin Page
 *
 *********************************************/

router.get("/admin",
authenticate,
(request, response, next) => {
  return response.render("admin", {
    environment: ENVIRONMENT
  });
});

/*********************************************
 *
 * Client Management Page
 *
 *********************************************/

router.get("/clients",
authenticate,
(request, response, next) => {
  return ClientFile.getAll()
  .then(result => {
    clients = result;
    response.render("clients", {
      clients: clients
    });
  })
  .catch(error => { next(error); });
});

/*********************************************
 *
 * Source Management Page
 *
 *********************************************/

router.get("/sources",
authenticate,
(request, response, next) => {
  var sources;
  return Source.getSources()
  .then(result => {
    sources = result;
    return getAdminInternalSecurityGroup();
  })
  .then(securityGroup => {
    var secretEnabled = false;
    if (securityGroup) {
      secretEnabled = securityGroup.IpPermissions.length > 0 ? true : false
    }
    response.render("sources", {
      sources: sources,
      secretEnabled: secretEnabled,
      certAccessSecret: CERT_ACCESS_SECRET
    });
  })
  .catch(error => { next(error); });
});

/*********************************************
 *
 * Suricata Management Page
 *
 *********************************************/

router.get("/suricata",
authenticate,
(request, response, next) => {
  return RuleFile.getAll()
  .then(result => {
    ruleFiles = result;
    response.render("suricata", {
      ruleFiles: ruleFiles
    });
  })
  .catch(error => { next(error); });
});

/*********************************************
 *
 * Enable/Disable Secret API
 *
 *********************************************/

router.post("/toggle-secret",
authenticate,
(request, response, next) => {
  return getAdminInternalSecurityGroup()
  .then( securityGroup => {
    let ingressRules = securityGroup.IpPermissions
    if (ingressRules.length > 0) {
      // disable it by removing the ingress
      Email.sendAdminAlert("Secret access toggle: disabled", `${request.ip}`);
      return ec2.revokeSecurityGroupIngress({
        CidrIp: "172.16.0.0/12",
        FromPort: 80,
        ToPort: 80,
        IpProtocol: "tcp",
        GroupId: securityGroup.GroupId
      }).promise();
    }
    else {
      // enable it by enabling the ingress
      Email.sendAdminAlert("Secret access toggle: enabled", `${request.ip}`);
      return ec2.authorizeSecurityGroupIngress({
        GroupId: securityGroup.GroupId, 
        IpPermissions: [
          {
            FromPort: 80, 
            ToPort: 80,
            IpProtocol: "tcp", 
            IpRanges:
            [
              {
                CidrIp: "172.16.0.0/12", 
                Description: "Allow HTTP from internal IPv4 to Admin Internal Load Balancer"
              }
            ]
          }
        ]
      }).promise();
    }
  })
  .then( result => {
    return request.flashRedirect("success", "Certificate Secret API toggled.", "/sources");
  })
  .catch(error => { next(error); });
});

/*********************************************
 *
 * Email Opt Out User
 *
 *********************************************/

router.post("/set-do-not-email",
[
  authenticate,
  body("email")
  .exists().withMessage("Missing email address.")
  .isEmail().withMessage("Invalid email address.")
  .normalizeEmail({
      gmail_remove_dots: false
    }),
  validateCheck
],
(request, response, next) => {
  var email = request.values.email;
  // Check that we do have this email in the database
  return User.getWithEmail(email)
    .then(user => {
      return User.setDoNotEmail(email, user.doNotEmailCode);
    })
    .then(success => {
      response.status(200).json({
        message: "Do not email set successfully."
      });
    })
    .catch(error => { next(error); });
});

/*********************************************
 *
 * Delete User
 *
 *********************************************/

router.post("/delete-user-with-email",
[
  authenticate,
  body("email")
  .exists().withMessage("Missing email address.")
  .isEmail().withMessage("Invalid email address.")
  .normalizeEmail({
      gmail_remove_dots: false
    }),
  body("reason")
  .exists().withMessage("A reason for deletion is required.")
  .not().isEmpty().withMessage("A reason for deletion is required."),
  body("banned")
  .isBoolean(),
  validateCheck
],
(request, response, next) => {
  var email = request.values.email;
  var reason = request.values.reason;
  var banned = request.values.banned;
  // Check that we do have this email in the database
  return User.getWithEmail(email)
    .then(user => {
      // Send email alert to user
      return Email.sendAuditAlert(email, "Delete user account and cancel all desktop subscriptions. Any iOS/Android subscriptions must be cancelled separately using the app store.", reason)
      .then(success => {
        // Delete the user
        return user.delete(reason, banned);
      })
      .then(success => {
        response.status(200).json({
          message: "Deleted user successfully. Any iOS/Android subscriptions must be deleted separately."
        });
      });
    })
    .catch(error => { next(error); });
});

router.post("/delete-user-with-id",
[
  authenticate,
  body("id")
  .isAlphanumeric().withMessage("Invalid id."),
  body("reason")
  .exists().withMessage("A reason for deletion is required.")
  .not().isEmpty().withMessage("A reason for deletion is required."),
  body("banned")
  .isBoolean(),
  validateCheck
],
(request, response, next) => {
  var id = request.values.id;
  var reason = request.values.reason;
  var banned = request.values.banned;
  // Check that we do have this email in the database
  return User.getWithId(id)
    .then(user => {
      // Delete the user
      return user.delete(reason, banned)
      .then(success => {
        response.status(200).json({
          message: "Deleted user successfully. Any iOS/Android subscriptions must be deleted separately."
        });
        if (user.email) {
          Email.sendAuditAlert(user.email, "Delete user account and cancel all desktop subscriptions. Any iOS/Android subscriptions must be cancelled separately using the app store.", reason)
        }
      });
    })
    .catch(error => { next(error); });
});

/*********************************************
 *
 * Generate Users
 *
 *********************************************/

router.post("/generate-users",
[
  authenticate,
  body("num")
    .exists().withMessage("Missing num."),
  validateCheck
],
(request, response, next) => {
  
  var num = request.values.num;
  
  Email.sendAdminAlert("ADMIN ACTION", "Generate Users By " + request.user.email);
  
  let chain = Promise.resolve();
  let count = 0;
  for (var i = 0; i < num; i++) {
    chain = chain
      .then(() => {
        count = count + 1;
        var email = `success+${Secure.randomString(15)}@simulator.amazonses.com`;
        Logger.info("Generating user #" + count + " email: " + email);
        return User.createWithEmailAndPassword(email, "TestPass!123", false, null, true)
        .then(user => {
          return User.confirmEmail(user.emailConfirmCode, email);
        })
        .catch(error => { 
          Logger.error("error: " + JSON.stringify(error));
        });
      })
  }
  
  response.status(200).json({
    message: "queued"
  })

});

/*********************************************
 *
 * Upload and Modify Client
 *
 *********************************************/

router.post("/upload-client",
authenticate,
upload.single("file"),
(request, response, next) => {
  return ClientFile.uploadToS3(request.body.type, request.file)
  .then( result => {
    request.flashRedirect("success", "Upload Successful", "/clients");
  })
  .catch(error => { next(error); });
});

router.post("/modify-percent",
[
  authenticate,
  (request, response, next) => {
    // check percentages add up to 100%
    var body = request.body;
    var percentageTotal = 0;
    Object.keys(body).forEach( (key) => {
      var value = parseInt(body[key]);
      if (value < 0 || value > 100 || value % 1 !== 0) {
        throw new ConfirmedError(400, 100, "Percentages must be non-negative, maximum 100%, and whole numbers.");
      }
      percentageTotal = percentageTotal + value;
    });
    if (percentageTotal != 100) {
      throw new ConfirmedError(400, 100, "Percentages must add up to 100. Your total: " + percentageTotal);
    }
    next();
  }
],
(request, response, next) => {
  var items = request.body;
  let chain = Promise.resolve();
  Object.keys(items).forEach( (key) => {
    var clientFile = new ClientFile(key);
    chain = chain
      .then(() => {
        return clientFile.changePercentage(items[key]);
      });
  });
  chain = chain.then(() => {
    return request.flashRedirect("success", "Percentage change successful.", "/clients");
  })
  .catch(error => {
    return next(error);
  });
});

/*********************************************
 *
 * Change Password
 *
 *********************************************/

router.get("/change-password",
authenticate,
(request, response, next) => {
  response.render("change-password");
});

router.post("/change-password",
[
  authenticate,
  body("currentPassword")
    .exists().withMessage("Missing current password.")
    .not().isEmpty().withMessage("Missing current password.")
    .custom((value, {req, location, path}) => {
      return req.user.assertPassword(value);
    }).withMessage("Current password is incorrect."),
  body("newPassword")
    .exists().withMessage("Missing new password.")
    .not().isEmpty().withMessage("Missing new password.")
    .isLength({ min: 8, max: 50 }).withMessage("New password must be at least 8 characters long."),
  validateCheck
],
(request, response, next) => {
  const currentPassword = request.values.currentPassword;
  const newPassword = request.values.newPassword;
  return request.user.changePassword(currentPassword, newPassword)
    .then( success => {
      Email.sendAdminAlert("Admin Password Changed",
      `IP: ${request.ip}
      Time: ${new Date()}
      Email: ${request.user.email}`);
      request.flashRedirect("success", "Password changed successfully.", "/admin");
    })
    .catch(error => { next(error); });
});

module.exports = router;

function getAdminInternalSecurityGroup() {
  return ec2.describeSecurityGroups({
    Filters: [
      {
        Name: "group-name", 
        Values:
        [
          `${ENVIRONMENT}-AdminInternalLoadBalancer`
        ]
      }
    ]
  }).promise()
  .then(result => {
    return result.SecurityGroups[0];
  })
}
