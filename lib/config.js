const { SecretClient } = require("@azure/keyvault-secrets");
const { ManagedIdentityCredential } = require("@azure/identity");

let configuration = {
  Core: {
    ipV4: true, // Set to true to listen for IPv4 connections, false to listen for IPv6
    listenPort: (process.env.PORT || 8889), // The port to listen on
  },
  Auth: {
    useAccessControl: false, // Set to true to use access control, false to disables
    allowedIpAddresses: ["127.0.0.1"], // if useAccessControl is true, allow these IP addresses only
  },
  Pruning: {
    dontShowServersOnSameIp: false, // When a client requests the server list, remove the server they're on from the list.
    inactiveServerRemovalMinutes: 3, // How many minutes a server should be considered inactive before it's removed from the list.
    sendNextPruneTimeInSeconds: true, // Send the servers remaining life in seconds if a collision check was detected.
  },
  Security: {
    useRateLimiter: false, // Limit the amount of requests from the same IP
    rateLimiterWindowMs: 900000, // The window in Ms before the rate limit is reset
    allowDuplicateServerNames: false, // Allow duplicate server names to be added to the list
    updatesMustMatchOriginalAddress: true, // Any server updates must match the original server's IP
    rateLimiterMaxApiRequestsPerWindow: 100, // The amount of requests allowed from the same IP before being blocked
  },
};

async function initConfiguration() {
  var secretKey = "insecureLocalDevelopmentKey";

  if(process.env.WEBSITE_INSTANCE_ID) { // in Azure App Service
    // https://stackoverflow.com/questions/65919559/access-azure-app-configuration-settings-that-reference-key-vault-in-nodejs
    let vaultUrl = `https://enklucloudsecrets.vault.azure.net/`;
    let credentials = new ManagedIdentityCredential();

    let client = new SecretClient(vaultUrl, credentials);
    secretKey = (await client.getSecret("multiplayerListServerKey")).value
  }
  configuration.Auth.communicationKey = secretKey;
}

module.exports = { initConfiguration, configuration };
