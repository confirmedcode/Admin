// Load environment
require("./config/environment.js");

// Shared
const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Constants
const DOMAIN = process.env.DOMAIN;
const NODE_ENV = process.env.NODE_ENV;

const ipRangeCheck = require("ip-range-check");

// Express and body parsers
const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Email for /signin alerts
const { Email } = require("shared/utilities");

// Admin logs everything including successful requests
const expressWinston = require("express-winston");
expressWinston.requestWhitelist = ["url", "session", "ip", "method", "httpVersion", "originalUrl", "query"];
app.use(expressWinston.logger({
  winstonInstance: Logger,
  ignoreRoute: function (request, response) {
    const reqUrl = request.url;
    if (reqUrl.startsWith("/css/")
      || reqUrl.startsWith("/images/")
      || reqUrl.startsWith("/js/")
      || reqUrl.startsWith("/favicon.ico")
      || reqUrl.startsWith("/health")) {
        return true;
      } 
      return false;
  }
}));

// Log unhandled rejections
process.on("unhandledRejection", error => {
  Logger.error(`unhandledRejection:
    ${error.stack}`);
});

// Basic Security
app.use(require("helmet")());

// View Engine & HTML/JS/CSS
app.engine(".hbs", require("express-handlebars")({
  defaultLayout: "main",
  extname: ".hbs",
  partialsDir: __dirname + "/views/partials/"
}));
app.set("view engine", ".hbs");
app.use(express.static("public"));
app.locals.DOMAIN = DOMAIN;

// Sessions/Flash
app.use(require("./config/session.js"));
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Private network can only access /get-server-certificate
app.use((request, response, next) => {
  if (ipRangeCheck(request.ip, "172.16.0.0/12") === true) {
    if (request.path.toLowerCase() !== "/get-server-certificate") {
      next(new ConfirmedError(400, 99, "Internal IPs only allowed to access /get-server-certificate. Incident reported."));
    }
  }
  next();
});

// Initialize Database
app.use(require("./middleware/initialize-database.js"));

// Controllers
app.use("/", require("./controllers/admin-controller.js"));
app.use("/", require("./controllers/notification-controller.js"));
app.use("/", require("./controllers/partners-controller.js"));
app.use("/", require("./controllers/signin-controller.js"));
app.use("/", require("./controllers/signup-controller.js"));
app.use("/", require("./controllers/source-controller.js"));
app.use("/", require("./controllers/secret-controller.js"));
app.use("/", require("./controllers/rule-controller.js"));

app.get("/error-test", (request, response, next) => {
  next(new ConfirmedError(500, 999, "Test alerts", "Details here"));
});

app.get("/health", function(request, response, next) {
	return response.status(200).json({
		message: "OK from Admin"
	});
});

app.get("/", (request, response, next) => {  
  if (request.session && request.session.userEmail) {
    response.redirect("/admin");
  }
  else {
    response.redirect("/signin");
  }
});

// Log Errors
app.use(expressWinston.errorLogger({
  winstonInstance: Logger
}));

// Handle Errors
app.use((error, request, response, next) => {
  // Email Alert on /signin requests
  // This is here instead of the controller route so we can also catch validation errors from middleware
  if (request.path.toLowerCase().startsWith("/signin")) {
    Email.sendAdminAlert("Sign In Error",
`Path: ${request.path}
IP: ${request.ip}
Time: ${new Date()}
Error: ${error}
Email: ${request.body ? request.body.email : "none"}`);
  }
  if (response.headersSent) {
    Logger.error("RESPONSE ALREADY SENT");
    return;
  }
  return response.format({
    json: () => {
      if (!error.statusCode) {
        response.status(500).json({
          code: error.confirmedCode,
          message: error.message
        });
      }
      else {
        response.status(error.statusCode).json({
          code: error.confirmedCode,
          message: error.message
        });
      }
    },
    html: () => {
      if (error.statusCode == 401) {
        request.flashRedirect("error", error.message, "/signin");
      }
      else if (error.statusCode >= 200 && error.statusCode < 500) {
        if (error.confirmedCode == 1) {
          response.redirect("/resend-confirm-code");
        }
        request.flashRedirect("error", error.message, request.headers.referrer || request.headers.referer);
      }
      else {
        request.flashRender("error", error.message, "notification");
      }
    }
  });
});

// Handle 404 Not Found
app.use((request, response, next) => {
  return response.format({
    json: () => {
      response.status(404).json({
        code: 404,
        message: "Not Found"
      });
    },
    html: () => {
      request.flashRender("error", "The page you are looking for does not exist.", "notification", 404);
    }
  });
});

module.exports = app;