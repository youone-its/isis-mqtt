const { createClient } = require('../common/mqttClient');
const fs = require('fs');
const csv = require('csv-parser');

const sensorPub = createClient('sensor_publisher_01');
const securityPub = createClient('security_publisher');
const statusPub = createClient('status_publisher', {
    will: {
        topic: 'farm/status/YBA_01', 
        payload: Buffer.from('Offline'),
        qos: 1,
        retain: true 
    }
});

sensorPub.on('connect', () => {
    console.log('✅ Sensor Publisher Connected (MQTT 5.0)');
    
    const rows = [];
    fs.createReadStream('./publisher/sensor_data.csv')
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => {
            let index = 0;
            setInterval(() => {
                if (index >= rows.length) index = 0;
                const row = rows[index];

                // QoS 0 for realtime sensor data
                const options = {
                    qos: 0,
                    retain: true, // Enable retained messages for latest values
                    properties: {
                        messageExpiryInterval: 60,
                        topicAlias: 1,
                        userProperties: {
                            'unit-temp': 'Celsius',
                            'sensor-type': 'Industrial'
                        }
                    }
                };

                const topic = `farm/sensors/${row.main_controller_id}/${row.sensor_module_id}`;
                const payload = JSON.stringify({
                    temp: parseFloat(row.temperature),
                    hum: parseFloat(row.humidity),
                    co2: parseFloat(row.CO2),
                    token: row.refreshable_token,
                    timestamp: new Date().toISOString() // Timestamp Integration
                });

                sensorPub.publish(topic, payload, options);
                
                // Realistic Alert System: Publish alert if thresholds exceeded
                if (parseFloat(row.temperature) > 35 || parseFloat(row.humidity) < 40 || parseFloat(row.CO2) > 1000) {
                    const alertTopic = `farm/alerts/${row.main_controller_id}`;
                    const alertPayload = JSON.stringify({
                        type: 'THRESHOLD_ALERT',
                        controller: row.main_controller_id,
                        message: `Critical levels detected! T:${row.temperature}°C H:${row.humidity}% CO2:${row.CO2}ppm`,
                        timestamp: new Date().toISOString()
                    });
                    sensorPub.publish(alertTopic, alertPayload, { qos: 1 }); // Alerts use QoS 1
                }

                console.log(`[Sensor] Published to ${topic}`);
                index++;
            }, 1000); // Increased rate for Flow Control Testing (from 3s to 1s)
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
    // Initial status with QoS 1 and Retain
    statusPub.publish('farm/status/system', 'System Online', { retain: true, qos: 1 });
});