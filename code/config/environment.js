const Logger = require("shared/logger");

// Load environment variables
require("shared/environment")([
  "COMMON",
  "ADMIN",
  "MAIN",
  "RENEWER",
  "PARTNER",
  "SUPPORT",
  "HELPER",
  "WEBHOOK",
  "DEBUG"
]);

// Load database login
process.env.PG_USER = "master";
process.env.PG_PASSWORD = process.env.PG_ADMIN_PASSWORD;

// Check that Sources EFS is mounted
const fs = require("fs-extra");
const path = require("path");

if (process.env.NODE_ENV !== "test") {
  const SOURCES_MOUNTED_FILE = path.join(__dirname, "..", "..", "sources", "MOUNTED");
  fs.pathExists(SOURCES_MOUNTED_FILE)
  .then(exists => {
    if (!exists) {
      throw Error("Sources EFS not mounted on Admin startup.");
    }
    else {
      Logger.info("Sources EFS mounted. Proceeding.");
    }
  })
  .catch(error => {
    Logger.error("FATAL - Error checking Sources EFS mount on startup: " + error);
    process.exit(1);
  });
}