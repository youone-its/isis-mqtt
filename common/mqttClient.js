const mqtt = require('mqtt');

function createClient(clientId, extraOptions = {}) {
    const client = mqtt.connect('mqtt://localhost', {
        protocolVersion: 5,
        clientId,
        clean: true,
        reconnectPeriod: 1000,
        ...extraOptions
    });

    client.on('error', (err) => {
        console.error(`[${clientId}] ERROR:`, err.message);
    });

    return client;
}

module.exports = { createClient };