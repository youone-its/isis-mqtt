const { createClient } = require('../common/mqttClient');
const fs = require('fs');
const csv = require('csv-parser');

const sensorPub = createClient('sensor_publisher_01');
const securityPub = createClient('security_publisher');
const statusPub = createClient('status_publisher', {
    will: {
        // Ganti ke salah satu controller utama agar masuk ke filter web.js
        topic: 'farm/YBA_01/status', 
        payload: Buffer.from('Offline'),
        qos: 1,
        retain: true 
    }
});

sensorPub.on('connect', () => {
    console.log('✅ Sensor Publisher Connected (MQTT 5.0)');
    
    // Membaca CSV dan simulasi stream
    const rows = [];
    fs.createReadStream('./publisher/sensor_data.csv')
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => {
            let index = 0;
            setInterval(() => {
                if (index >= rows.length) index = 0;
                const row = rows[index];

                // Fitur: User Properties (Metadata) & Expiry & Alias
                const options = {
                    qos: 1,
                    properties: {
                        messageExpiryInterval: 60, // Fitur: Expiry 60 detik
                        topicAlias: 1,            // Fitur: Topic Alias
                        userProperties: {
                            'unit-temp': 'Celsius',
                            'sensor-type': 'Industrial'
                        }
                    }
                };

                const topic = `farm/${row.main_controller_id}/sensor/${row.sensor_module_id}`;
                const payload = JSON.stringify({
                    temp: row.temperature,
                    hum: row.humidity,
                    co2: row.CO2,
                    token: row.refreshable_token
                });

                sensorPub.publish(topic, payload, options);
                console.log(`[Sensor] Published to ${topic}`);
                index++;
            }, 3000); // Kirim tiap 3 detik
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

        // Fitur: Request-Response Pattern
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
    statusPub.publish('farm/system/status', 'System Online', { retain: true, qos: 1 });
});