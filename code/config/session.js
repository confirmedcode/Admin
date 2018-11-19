const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Constants
const DOMAIN = process.env.DOMAIN;
const NODE_ENV = process.env.NODE_ENV;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

const session = require("express-session");
const flash = require("connect-flash");

const RedisClient = require("shared/redis").Client;
const RedisStore = require("connect-redis")(session);

const sessionOptions = {
  store: new RedisStore({
    client: RedisClient,
    prefix: "a:" // "admin session"
  }),
  secret: ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1 * 60 * 60 * 1000,
    httpOnly: true
  },
  unset: "destroy",
  name: "confirmedadminid",
  sameSite: true
};

if (NODE_ENV === "production") {
  sessionOptions.cookie.secure = true;
  sessionOptions.cookie.domain = DOMAIN;
}

const flashMiddleware = (request, response, next) => {
  // flash for the current page without redirecting
  request.flashRender = (type, message, render, code = 200) => {
    request.flash(type, message);
    response.locals.flash = request.flash();
    response.status(code);
    response.render(render);
  };
  // flash for redirects - should retrieve from response.locals
  request.flashRedirect = (type, message, redirect) => {
    request.flash(type, message);
    response.redirect(redirect);
  };
  response.locals.flash = request.flash();
  // clear it
  if (request.session && request.session.flash) {
    delete request.session.flash;
  }
  next();
};

const setIpEmail = (request, response, next) => {
  response.locals.ip = request.ip;
  response.locals.email = (request.session && request.session.userEmail) ? request.session.userEmail : "";
  next();
};

module.exports = [
  session(sessionOptions),
  flash(),
  flashMiddleware,
  setIpEmail
];