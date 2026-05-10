const { createClient } = require('../common/mqttClient');

const dashboardSub = createClient('dashboard_subscriber', {
    properties: { receiveMaximum: 15 }
});

const alertSub = createClient('alert_subscriber', {
    properties: { receiveMaximum: 10 }
});

dashboardSub.on('connect', () => {
    console.log('✅ Dashboard Subscriber Connected');
    // Subscribing to sensors and status using new structure
    dashboardSub.subscribe('$share/web_group/farm/sensors/+/+', { qos: 1 });
    dashboardSub.subscribe('$share/web_group/farm/status/+', { qos: 1 });
});

dashboardSub.on('message', (topic, message) => {
    const parts = topic.split('/');
    const type = parts[1]; // sensors or status
    const ctrl = parts[2];

    if (type === 'sensors') {
        const data = JSON.parse(message.toString());
        console.log(`[Dashboard] ${ctrl} → T:${data.temp}°C H:${data.hum}% CO2:${data.co2}ppm | TS: ${data.timestamp}`);
    } else if (type === 'status') {
        console.log(`[Dashboard] ${ctrl} Status → ${message.toString()}`);
    }
});

alertSub.on('connect', () => {
    console.log('✅ Alert Subscriber Connected');
    // Subscribing to alerts and status using new structure
    alertSub.subscribe('$share/web_group/farm/alerts/+', { qos: 1 });
    alertSub.subscribe('$share/web_group/farm/status/+', { qos: 1 });
});

alertSub.on('message', (topic, message) => {
    const parts = topic.split('/');
    const type = parts[1];
    const ctrl = parts[2];

    if (type === 'alerts') {
        const data = JSON.parse(message.toString());
        console.log(`🚨 [ALERT] ${ctrl}: ${data.message} (@${data.timestamp})`);
    } else if (type === 'status') {
        const status = message.toString();
        if (status.toLowerCase().includes('offline')) {
            console.log(`⚠️  [ALERT] ${ctrl} is OFFLINE!`);
        }
    }
});

