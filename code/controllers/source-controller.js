const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { check, body, query } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Utilities
const { Email } = require("shared/utilities");

// Models
const { Source } = require("shared/models");

// Constants
const DOMAIN = process.env.DOMAIN;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * New Source
 *
 *********************************************/

router.post("/new-source",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLowercase().withMessage("Source Id must be lowercase.")
    .isLength({ min: 1, max: 25 }).withMessage("ID must be between 1 and 25 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  return Source.createWithId(id)
    .then(id => {
      Email.sendAdminAlert("New Source Created.",
      `Source ID: ${id}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Source created successfully.", "/sources");
    })
    .catch( error => next(error) );
});

router.post("/set-current-source",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 25 }).withMessage("ID must be between 1 and 25 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  return Source.setCurrent(id)
    .then(id => {
      Email.sendAdminAlert("Current Source Changed.",
      `Source ID: ${id}
  IP: ${request.ip}
  Time: ${new Date()}`);
      request.flashRedirect("success", "Current source set successfully.", "/sources");
    })
    .catch( error => next(error) );
});

router.post("/get-unassigned-certificates",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 25 }).withMessage("ID must be between 1 and 25 characters."),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  return Source.getUnassignedCertificatesCount(id)
    .then(result => {
      response.status(200).json({
        count: result
      });
    })
    .catch( error => next(error) );
});

router.post("/generate-certificates",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 25 }).withMessage("ID must be between 1 and 25 characters."),
  body("num")
    .exists().withMessage("Missing num.")
    .not().isEmpty().withMessage("Missing num.")
    .isNumeric(),
  validateCheck
],
(request, response, next) => {
  const id = request.values.id;
  const num = request.values.num;
  Email.sendAdminAlert("Generating Source Certificates.",
  `Source ID: ${id}
Number: ${num}
Time: ${new Date()}`);
  Source.generateCertificates(id, num);
  request.flashRedirect("success", "Certificate generation started.", "/sources");
});


module.exports = router;