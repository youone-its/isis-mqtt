const { createClient } = require('../common/mqttClient');
const fs = require('fs');
const csv = require('csv-parser');

const sensorPub = createClient('sensor_publisher_01');
const securityPub = createClient('security_publisher');

// Consistent Status Topic Structure: farm/status/{controller_id}
const CONTROLLER_ID = 'YBA_01';
const statusPub = createClient('status_publisher', {
    will: {
        topic: `farm/status/${CONTROLLER_ID}`,
        payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
        qos: 1,
        retain: true
    }
});

sensorPub.on('connect', () => {
    console.log('✅ Sensor Publisher Connected (MQTT 5.0)');

    const rows = [];
    fs.createReadStream('./publisher/sensor_data.csv')
        .pipe(csv())
        .on('data', (data) => {
            if (data.main_controller_id !== 'ID_OFF') rows.push(data);
        })
        .on('end', () => {
            let index = 0;
            setInterval(() => {
                if (index >= rows.length) index = 0;
                const row = rows[index];

                const topic = `farm/sensors/${row.main_controller_id}/${row.sensor_module_id}`;
                const payload = JSON.stringify({
                    temp: parseFloat(row.temperature),
                    hum: parseFloat(row.humidity),
                    co2: parseFloat(row.CO2),
                    token: row.refreshable_token,
                    timestamp: new Date().toISOString()
                });

                // Topic Alias Demonstration
                const aliasOptions = {
                    qos: 0,
                    retain: true,
                    properties: {
                        topicAlias: 1, // Using Alias 1 for this topic
                        messageExpiryInterval: 60 // Message expires after 60 seconds
                    }
                };

                // Traffic Comparison Simulation
                const overheadWithoutAlias = topic.length + payload.length;
                const overheadWithAlias = 0 + payload.length; // Simplified: topic name is not sent after first time
                const reduction = ((overheadWithoutAlias - overheadWithAlias) / overheadWithoutAlias * 100).toFixed(1);

                sensorPub.publish(topic, payload, aliasOptions);

                if (parseFloat(row.temperature) > 35 || parseFloat(row.humidity) < 40 || parseFloat(row.CO2) > 1000) {
                    const alertTopic = `farm/alerts/${row.main_controller_id}`;
                    const alertPayload = JSON.stringify({
                        type: 'THRESHOLD_ALERT',
                        controller: row.main_controller_id,
                        message: `Critical levels detected! T:${row.temperature}°C H:${row.humidity}% CO2:${row.CO2}ppm`,
                        timestamp: new Date().toISOString()
                    });
                    sensorPub.publish(alertTopic, alertPayload, { qos: 1 });
                }

                console.log(`[Sensor] Published to ${topic} | Alias Savings: ${reduction}%`);
                index++;
            }, 2000); // Set to 2s for better visibility
        });
});

securityPub.on('connect', () => {
    console.log('✅ Security Publisher Connected');
    securityPub.subscribe('auth/request');
});

securityPub.on('message', (topic, message, packet) => {
    if (topic === 'auth/request') {
        const requestData = JSON.parse(message.toString());
        console.log(`[Security] Received Request:`, requestData);

        const responseTopic = packet.properties.responseTopic;
        const correlationData = packet.properties.correlationData;

        if (responseTopic) {
            const responsePayload = JSON.stringify({
                status: 'Authorized',
                newToken: 'SECRET_' + Math.random().toString(36).substring(7).toUpperCase()
            });

            securityPub.publish(responseTopic, responsePayload, {
                properties: { correlationData }
            });
            console.log(`[Security] Replied to ${responseTopic}`);
        }
    }
});

statusPub.on('connect', () => {
    // Initial status with JSON payload
    const onlinePayload = JSON.stringify({ status: 'online', timestamp: new Date().toISOString() });
    statusPub.publish(`farm/status/${CONTROLLER_ID}`, onlinePayload, { retain: true, qos: 1 });
    console.log(`[Status] Published Online status for ${CONTROLLER_ID}`);
});
