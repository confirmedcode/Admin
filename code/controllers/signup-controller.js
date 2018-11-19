const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { check, body, query } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Models
const { Email } = require("shared/utilities");
const { AdminUser } = require("shared/models");

// Constants
const DOMAIN = process.env.DOMAIN;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * Sign Up Page
 *
 *********************************************/

router.get("/signup",
(request, response, next) => {
  response.render("signup");
});

router.get("/signup-success",
(request, response, next) => {
  response.render("signup-success");
});

/*********************************************
 *
 * Create User
 *
 *********************************************/

router.post("/signup",
[
  check("email")
    .exists().withMessage("Missing email address.")
    .isEmail().withMessage("Invalid email address.")
    .normalizeEmail({
      gmail_remove_dots: false
    })
    .custom((email, { request }) => {
      return email.endsWith("@" + DOMAIN);
    }).withMessage("Email address must end in: @" + DOMAIN),
  check("password")
    .exists().withMessage("Missing password.")
    .not().isEmpty().withMessage("Missing password.")
    .isLength({ min: 8, max: 50 }).withMessage("Password must be at least 8 characters long."),
  validateCheck
],
(request, response, next) => {
  const email = request.values.email;
  const password = request.values.password;
  return AdminUser.createWithEmailAndPassword(email, password)
    .then(user => {
      Email.sendAdminAlert("Admin Signup Initiated",
      `IP: ${request.ip}
      Time: ${new Date()}
      Email: ${request.values.email}`);
      response.redirect("/signup-success");
    })
    .catch( error => next(error) );
});

/*********************************************
 *
 * Confirm Email
 *
 *********************************************/

router.get(["/confirm-email"],
[
  query("code")
    .exists().withMessage("Missing confirmation code.")
    .not().isEmpty().withMessage("Missing confirmation code.")
    .isAlphanumeric().withMessage("Invalid confirmation code.")
    .trim(),
  validateCheck
],
(request, response, next) => {
  const code = request.values.code;
  // If already confirmed, tell user already confirmed
  return AdminUser.getWithConfirmCode(code)
    .then( user => {
      // Email already confirmed
      if (user.emailConfirmed) {
          return request.flashRedirect("success", "Email already confirmed. Please sign in.", "/signin");
      }
      // Email not yet confirmed, confirm it.
      else {
        Email.sendAdminAlert("Admin Signup Confirmed",
        `IP: ${request.ip}
        Time: ${new Date()}
        Email: ${user.email}`);
        return AdminUser.confirmEmail(code)
          .then( success => {
            return request.flashRedirect("success", "Email confirmed. Please sign in.", "/signin");
          });
      }
    })
    .catch( error => next(error) );
});

/*********************************************
 *
 * Resend Confirmation Code
 *
 *********************************************/

router.get("/resend-confirm-code",
(request, response, next) => {
  response.render("resend-confirm-code");
});

router.post("/resend-confirm-code",
[
  body("email")
  .exists().withMessage("Missing email address.")
  .isEmail().withMessage("Invalid email address.")
  .normalizeEmail({
      gmail_remove_dots: false
    })
  .custom((email, { request }) => {
    return email.endsWith("@" + DOMAIN);
  }).withMessage("Email address must end in: @" + DOMAIN),
  validateCheck
],
(request, response, next) => {
  const email = request.values.email;
  AdminUser.resendConfirmCode(email)
    .then( results => {
      Email.sendAdminAlert("Admin Confirmation Code Resent",
      `IP: ${request.ip}
      Time: ${new Date()}
      Email: ${email}`);
      request.flashRedirect("info", "Confirmation email re-sent. Be sure to check your spam folder, as sometimes the email can get stuck there.", "/signin");
    })
    .catch( error => next(error) );
});

module.exports = router;