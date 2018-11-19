const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { check, body, query, oneOf } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Models
const { RuleFile } = require("shared/models");

// Routes
const router = require("express").Router();

router.post("/save-rule",
[
  authenticate,
  body("ruleFile")
    .exists().withMessage("Missing rule file.")
    .not().isEmpty().withMessage("Missing rule file."),
  body("ruleContent")
    .exists().withMessage("Missing content.")
    .not().isEmpty().withMessage("Missing content."),
  validateCheck
],
(request, response, next) => {
  const ruleFile = request.values.ruleFile;
  const ruleContent = request.values.ruleContent;
  return RuleFile.save(ruleFile, ruleContent)
    .then(result => {
      return request.flashRedirect("success", "Rule file saved successfully.", "/suricata");
    })
    .catch( error => next(error) );
});

// router.post("/new-rule",
// [
//   authenticate,
//   body("newRuleDescription")
//     .exists().withMessage("Missing description.")
//     .not().isEmpty().withMessage("Missing description."),
//   body("newRuleText")
//     .exists().withMessage("Missing text.")
//     .not().isEmpty().withMessage("Missing text."),
//   validateCheck
// ],
// (request, response, next) => {
//   const description = request.values.newRuleDescription;
//   const text = request.values.newRuleText;
//   return Rule.newRule(description, text)
//     .then(result => {
//       return response.redirect('/admin');
//     })
//     .catch( error => next(error) );
// });
//
// router.post("/delete-rule",
// [
//   authenticate,
//   body("id")
//     .exists().withMessage("Missing id.")
//     .not().isEmpty().withMessage("Missing id.")
//     .isNumeric(),
//   validateCheck
// ],
// (request, response, next) => {
//   const id = request.values.id;
//   return Rule.deleteRuleWithId(id)
//     .then(result => {
//       response.status(200).json({
//         success: true
//       });
//     })
//     .catch( error => next(error) );
// });
//
// router.post("/new-banned-host",
// [
//   authenticate,
//   body("newBannedHost")
//     .exists().withMessage("Missing host.")
//     .not().isEmpty().withMessage("Missing host."),
//   validateCheck
// ],
// (request, response, next) => {
//   const host = request.values.newBannedHost;
//   return Rule.newBannedHost(host)
//     .then(result => {
//       return response.redirect('/admin');
//     })
//     .catch( error => next(error) );
// });

module.exports = router;