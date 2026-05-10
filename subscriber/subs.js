const { createClient } = require('../common/mqttClient');

const dashboardSub = createClient('dashboard_subscriber', {
    properties: { receiveMaximum: 15 }
});

const alertSub = createClient('alert_subscriber', {
    properties: { receiveMaximum: 10 }
});

dashboardSub.on('connect', () => {
    console.log('✅ Dashboard Subscriber Connected');
    dashboardSub.subscribe('$share/web_group/farm/+/sensor/#', { qos: 1 });
});

dashboardSub.on('message', (topic, message) => {
    const data = JSON.parse(message.toString());
    const ctrl = topic.split('/')[1];
    console.log(`[Dashboard] ${ctrl} → T:${data.temp}°C H:${data.hum}% CO2:${data.co2}ppm`);
});

alertSub.on('connect', () => {
    console.log('✅ Alert Subscriber Connected');
    alertSub.subscribe('$share/web_group/farm/+/status', { qos: 1 });
});

alertSub.on('message', (topic, message) => {
    const status = message.toString();
    const ctrl = topic.split('/')[1];
    if (status.toLowerCase().includes('offline')) {
        console.log(`⚠️  [ALERT] ${ctrl} is OFFLINE!`);
    }
});
