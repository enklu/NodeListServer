const fs = require("fs");
const log4js = require("log4js");

// ---------------
// Logging configuration. Feel free to modify.
// ---------------

function logToConsoleOnly()
{
  log4js.configure({
    appenders: {
      console: { type: "stdout" },
      default: { type: "stdout" },
    },
    categories: {
      default: { appenders: ["console"], level: "debug" },
    },
  });
}

// Bugfix: If Google App Engine is running NodeLS, we cannot write to the disk, since it's readonly.
// So we run a check to ensure we can write, if not, we just log to console.
// Also, Azure App Service gets app update failures with this log file as well, so just log to console 
var logFile = "NodeListServer.log";

if(process.env.WEBSITE_INSTANCE_ID) {
  console.warn("File log breaks rsync on Azure app services; logging to file will be disabled!");
  logToConsoleOnly()
} else {
// Check if we can write?
  fs.access(__dirname, fs.constants.W_OK, function (err) {
    if (err) {
      console.warn("Can't write to disk; logging to file will be disabled!");
      logToConsoleOnly();
    } else {
      log4js.configure({
        appenders: {
          console: { type: "stdout" },
          default: {
            type: "file",
            filename: logFile,
            maxLogSize: 1048576,
            backups: 3,
            compress: true,
          },
        },
        categories: {
          default: { appenders: ["default", "console"], level: "debug" },
        },
      });
    }
  });
}

// Now we get the logger instance.
var loggerInstance = log4js.getLogger("NodeLS");

module.exports = { loggerInstance };
