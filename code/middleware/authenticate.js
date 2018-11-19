const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const { header } = require("express-validator/check");

// Utilities
const validator = require("validator");

const DOMAIN = process.env.DOMAIN;

// Models
const { AdminUser } = require("shared/models");

const cookieCheck = [ // Check for cookie, grab value from session in method
  header("cookie")
    .exists().withMessage("No cookie.")
    .not().isEmpty().withMessage("No cookie.")
];

const authenticateAndSetUser = (request, response, next) => {
  // Session Auth - Get userId from secure session, not cookie directly
  if (request.session && request.session.userEmail) {
    const sessionUserEmail = request.session.userEmail;
    return AdminUser.getWithEmail(sessionUserEmail)
      .then( user => {
        request.user = user;
        return next();
      })
      .catch( error => {
        next(error);
      });
  }
  return next(new ConfirmedError(401, 2, "Incorrect Login"));
};

module.exports = [
  cookieCheck,
  authenticateAndSetUser
];
