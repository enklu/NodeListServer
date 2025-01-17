//-------
// Validators: Put request validators to be used in the requestHandler module here
// They should return an object with the following properties:
// passed: boolean - true if the request passed, false if not
// logMessage: string - To log the message to the console
// status: number - To return a specific response status code to the client
//-------

const { configuration } = require("./config");
const serverList = require("./serverList");

// No post body check
function requestIncludesBody(req) {
  if (!req.body) {
    return {
      passed: false,
      logMessage: `Request to "${req.path}" denied from ${req.ip}: No POST body data?`,
      status: 400,
    };
  }
}

function accessControlCheck(req, useAccessControl, allowedServerAddresses) {
  if (useAccessControl && !allowedServerAddresses.includes(req.ip)) {
    return {
      passed: false,
      logMessage: `Request to "${req.path}" blocked from ${req.ip}. They are not known in our allowed IPs list.`,
      status: 403,
    };
  }
}

// Uuid provided but doesn't exist (/add).
function uuidProvidedButDoesNotExist(req, serverArray) {
  if (req.body.uuid) {
    if (!serverArray.some((server) => server.uuid === req.body.uuid.trim())) {
      return {
        passed: false,
        logMessage: `Request to "${req.path}" from ${req.ip} denied: No such server with UUID '${req.body.uuid}'`,
        status: 400,
      };
    }
  }
}

// Server Name checking (/add)
function serverNameCheck(req, serverArray, allowDuplicateServerNames) {
  // If no uuid provided, means client is trying to add a server
  if (!req.body.uuid) {
    if (!req.body.name) {
      return {
        passed: false,
        logMessage: `Request from ${req.ip} denied: Server name is null/undefined.`,
        status: 400,
      };
    }
    if (
      !allowDuplicateServerNames &&
      serverArray.some((server) => server.name === req.body.name.trim())
    ) {
      return {
        passed: false,
        logMessage: `Request from ${req.ip} denied: Server name clashes with an existing server name.`,
        status: 400,
      };
    }
  }

  // client provided server uuid, meaning they want to update
  if (req.body.uuid) {
    // if client provided server name, check if we allow duplicates
    if (!allowDuplicateServerNames && req.body.name) {
      // Check if any servers in the list have the same name, but don't have the same uuid
      const otherServerHasSameName = serverArray.some(
        (server) =>
          server.uuid !== req.body.uuid && server.name === req.body.name.trim()
      );
      if (otherServerHasSameName) {
        return {
          passed: false,
          logMessage: `Request from ${req.ip} denied: Server name clashes with an existing server name.`,
          status: 400,
        };
      }
    }
  }
}

// Valid port provided?
function serverPortCheck(req) {
  // No need to provide a port in an update
  if(req.body.uuid && !req.body.port)
    return;
  // Now we need to check to ensure the server port isn't out of bounds.
  // Port 0 doesn't exist as per se, so we need to make sure we're valid.
  if (
    !req.body.port ||
    isNaN(req.body.port) ||
    req.body.port < 1 ||
    req.body.port > 65535
  ) {
    return {
      passed: false,
      logMessage: `Request from ${req.ip} denied: Server port is undefined, below 1 or above 65335.`,
      status: 400,
    };
  }
}

function serverCollisionCheck(req, serverArray) {
  if (!req.body.uuid) {
    // Returns the first server it find with the same ip and port
    const existingServer = serverArray.find(
      (server) => server.ip === req.ip && server.port === +req.body.port
    );

    if (existingServer) {
      if (configuration.Pruning.sendNextPruneTimeInSeconds) {
        return {
          passed: false,
          logMessage: `Request to "${req.path}" from ${req.ip} denied: Server with same IP and Port already exists`,
          status: 400,
          responseMessage: {
            error: "Server Already Exists!",
            secondsToRetry: serverList.getServerPruneTime(existingServer),
          },
        };
      }
      return {
        passed: false,
        logMessage: `Request to "${req.path}" from ${req.ip} denied: Server with same IP and Port already exists`,
        status: 400,
      };
    }
  }
}

// No server uuid provided ("/remove")
function serverUuidProvided(req) {
  if (!req.body.uuid) {
    return {
      passed: false,
      logMessage: `Request to "${req.path}" from ${req.ip} denied: No UUID provided`,
      status: 400,
    };
  }
}

module.exports = {
  uuidProvidedButDoesNotExist,
  serverNameCheck,
  serverPortCheck,
  serverCollisionCheck,
  serverUuidProvided,
  requestIncludesBody,
  accessControlCheck,
};
