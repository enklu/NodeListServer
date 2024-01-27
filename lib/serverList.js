const { configuration } = require("./config");
const { loggerInstance } = require("./logger");
const { generateUuid, pruneInterval, inactiveServerRemovalMs } = require("./utils"); // some utils

// ------------
// Our server list object, We'll import it to any other file that needs it.
// Use this object to add/remove servers from the list. eg. knownServers.add(newServer);
// ------------
var ServerList = {
  _list: [],

  get list() {
    return this._list;
  },

  sendList(req, res) {
    // Shows if keys match for those getting list server details.
    loggerInstance.info(`${req.ip} accepted; communication key matched: '${req.body.key}'`);

    // Clean out the old ones.
    this.prune();

    // A client wants the server list. Compile it and send out via JSON.
    var serverList = this._list.map((knownServer) => {
      return {
        ip: knownServer.ip,
        name: knownServer.name,
        port: parseInt(knownServer.port, 10),
        players: parseInt(knownServer.players, 10),
        capacity: parseInt(knownServer.capacity, 10),
        experience: knownServer.experience,
        phase: knownServer.phase,
        configuration: knownServer.configuration,
        extras: knownServer.extras,
      };
    });

    // If dontShowServersOnSameIp is true, remove any servers that are on the same IP as the client.
    if (configuration.Pruning.dontShowServersOnSameIp) {
      serverList = serverList.filter((server) => server.ip !== req.ip);
    }

    // Build response with extra data with the server list we're about to send.
    var response = {
      count: serverList.length,
      servers: serverList,
      updateFrequency: inactiveServerRemovalMs / 1000 / 2, // How often a game server should update it's listing
    };

    loggerInstance.info(`Replying to ${req.ip} with known server list.`);
    return res.json(response);
  },

  // Add a new server to the list.
  addServer(req, res) {
    // Our request validator already checks if a uuid exists
    // So we'll just check if there's a uuid in the request body and pass it to the update function
    if (req.body.uuid)
      // Hand it over to the update routine.
      return this.updateServer(req, res);

    // Time to wrap things up.
    var newServer = {
      uuid: generateUuid(this.list),
      ip: req.body.ip,
      name: req.body.name.trim(),
      port: parseInt(req.body.port, 10),
    };

    // Extra field santitization
    newServer["players"] = parseInt(req.body.players, 10) || 0;
    newServer["capacity"] = parseInt(req.body.capacity, 10) || 0;
    newServer["experience"] = req.body.experience; // OK if undefined
    newServer["phase"] = req.body.phase; // OK if undefined
    newServer["configuration"] = req.body.configuration;
    newServer["site"] = req.body.site;
    newServer["extras"] = req.body.extras?.trim() || "";
    newServer["lastUpdated"] = Date.now();

    this._list.push(newServer);
    // Log it and send back the UUID to the client - they'll need it for later.
    loggerInstance.info(
      `Handled add server request from ${req.ip}: ${newServer["uuid"]} ('${newServer["name"]}')`
    );
    return res.send(newServer["uuid"]);
  },

  // Update a server's details.
  updateServer(req, res) {
    // Remove the server and save it to a variable
    const index = this._list.findIndex((server) => server.uuid === req.body.uuid);
    var [updatedServer] = this._list.splice(index, 1);

    // Create an object with our requestData data
    var requestData = {
      name: req.body.name?.trim(),
      players: !isNaN(req.body.players) && parseInt(req.body.players, 10),
      capacity: !isNaN(req.body.capacity) && parseInt(req.body.capacity, 10),
      experience: req.body.experience,
      phase: req.body.phase,
      extras: req.body.extras?.trim(),
      lastUpdated: Date.now(),
    };

    // Cross-check the request data against our current server values and update if needed
    Object.entries(requestData).forEach(([key, value]) => {
      if (value && value !== updatedServer[key]) {
        updatedServer[key] = value;
      }
    });

    // Push the server back onto the stack.
    this._list.push(updatedServer);
    loggerInstance.info(
      `Handled update request for server '${updatedServer.uuid}' (${updatedServer.name}) requested by ${req.ip}`
    );
    return res.sendStatus(200); // 200 OK
  },

  // findServer: Finds a server that meets the requirement
  findServers(req, res) {
    requestedProperties = req.body;
    delete requestedProperties.key;
    return res.json(this.list.filter( (server) => {
      console.log("foo" + JSON.stringify(server))
      return Object.entries(requestedProperties).every(([key, value]) => {
        console.log(key);
        console.log(`${key}: ${value} - ${server[key]}`);
        return value == server[key];
      });
    }));
  },

  // removeServer: Removes a server from the list.
  removeServer(req, res) {
    this._list = this.list.filter((server) => server.uuid !== req.body.uuid);
    loggerInstance.info(
      `Deleted server '${req.body.uuid}' from cache (requested by ${req.ip}).`
    );
    return res.send("OK\n");
  },

  prune() {
    const oldLength = this.list.length;
    this._list = this._list.filter(
      (server) => server.lastUpdated + inactiveServerRemovalMs >= Date.now()
    );

    // if we removed any servers then log how many
    if (oldLength > this.list.length)
      loggerInstance.info(`Purged ${oldLength - this.list.length} old server(s).`);
  },

  // Automtically remove old servers if they haven't updated based on the time specified in the configuration
  async pruneLoop() {
    this.prune();
    await new Promise((resolve) => setTimeout(resolve, pruneInterval)); // async delay
    this.pruneLoop();
  },

  getServerPruneTime(existingServer) {
    const lastUpdated = this.list.find((server) => server.ip == existingServer.ip)?.lastUpdated;
    const serverLife = (lastUpdated + (inactiveServerRemovalMs - Date.now())) / 1000;
    if (lastUpdated) return Math.ceil(serverLife + 1);
  },
};

// Start the first purge iteration
ServerList.pruneLoop();

module.exports = ServerList;
