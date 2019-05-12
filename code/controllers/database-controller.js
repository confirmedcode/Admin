const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { body } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Utilities
const { Audit } = require("shared/utilities");
const { Database } = require("shared/utilities");
const { Email } = require("shared/utilities");
const { Secure } = require("shared/utilities");
const RedisClient = require("shared/redis").Client;

// Constants
const PG_PARTNER_PASSWORD = process.env.PG_PARTNER_PASSWORD;
const REDIS_SALT = process.env.REDIS_SALT;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * Database Management Page
 *
 *********************************************/

router.get("/database",
authenticate,
(request, response, next) => {
  return response.render("database");
});

/*********************************************
 *
 * Postgres
 *
 *********************************************/

router.post("/postgres-command",
[
  authenticate,
  body("command")
    .exists().withMessage("Missing Command."),
  validateCheck
],
(request, response, next) => {
  
  var command = request.values.command;
  
  // Notify Admin
  Email.sendAdminAlert("Postgres Query By " + request.user.email, command);
  
  // Write the Postgres query (not the response) to CloudWatch Log Group and AdminAudit S3
  return Audit.logToCloudWatch("PostgresQueries", command)
  .then( result => {
    return Audit.logToS3("PostgresQueries", command);
  })
  // Execute the query, replacing PG_PARTNER_PASSWORD as needed
  .then( result => {
    command = command.replace("PG_PARTNER_PASSWORD", PG_PARTNER_PASSWORD);
    return Database.query( command, [])
  })
  .catch( error => {
    throw new ConfirmedError(400, 9999, "Error running Postgres query: " + error); 
  })
  // Show result to Admin (but don't log result to maintain privacy)
  .then( result => {
    return response.status(200).json({
      message: JSON.stringify(result.rows, null, 2)
    });
  })
  .catch(error => {
    return next(error);
  });
});

/*********************************************
 *
 * Brute
 *
 *********************************************/

// router.post("/redis-command",
// [
//   authenticate,
//   body("command")
//   .exists().withMessage("Missing Command."),
//   body("arguments"),
//   validateCheck
// ],
// (request, response, next) => {
//   return RedisClient.send_command(request.values.command, request.values.arguments ? request.values.arguments.split(",") : null, (error, result) => {
//     if (error) {
//       next(error);
//     }
//     else {
//       response.status(200).json({
//         message: result
//       });
//     }
//   });
// });

router.post("/get-brute",
[
  authenticate,
  body("ip")
    .exists().withMessage("Missing IP."),
  validateCheck
],
(request, response, next) => {

  const ip = request.values.ip;
  const ipHashed = Secure.hashSha512(ip, REDIS_SALT);
  
  // Look up all brute/ratelimit entries for this IP and return them
  var hashes = [];
  for (var i = 0; i <= 500; i++) {
    hashes.push("erl:" + ipHashed + "-" + i );
  }
  
  return Audit.logToCloudWatch("Actions", "Looking up Brute for an IP")
  .then( result => {
    return Audit.logToS3("Actions", "Looking up Brute for an IP");
  })
  .then( result => {
    return RedisClient.mget(hashes, (error, results) => {
      if (error) {
        next(error);
      }
      else {
        var toReturn = "";
        for (var i = 0; i <= 500; i++) {
          if ( results[i] != null && results[i].length != 0) {
            toReturn = `${toReturn}brute${i}
    ${results[i]}
  `;
          }
        }
        if (toReturn == "") {
          response.status(200).json({
            message: "IP Not Found"
          });
        }
        else {
          response.status(200).json({
            message: toReturn
          });
        }
      }
    });
  });

});

router.post("/clear-brute",
[
  authenticate,
  body("ip")
    .exists().withMessage("Missing IP."),
  validateCheck
],
(request, response, next) => {
  const ip = request.values.ip;
  const ipHashed = Secure.hashSha512(ip, REDIS_SALT);

  // Clear all brute/ratelimit entries for this IP
  var hashes = [];
  for (var i = 0; i <= 500; i++) {
    hashes.push("erl:" + ipHashed + "-" + i );
  }
  
  return Audit.logToCloudWatch("Actions", "Clearing Brute for an IP")
  .then( result => {
    return Audit.logToS3("Actions", "Clearing Brute for an IP");
  })
  .then( result => {
    return RedisClient.del(hashes, (error, result) => {
      if (error) {
        next(error);
      }
      else {
        response.status(200).json({
          message: result + " Brute Entries Cleared"
        });
      }
    });
  });

});

module.exports = router;