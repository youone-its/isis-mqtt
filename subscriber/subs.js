const { createClient } = require('../common/mqttClient');

/*
========================================
SHARED SUBSCRIPTION IMPLEMENTATION
========================================

Tujuan:
- Multiple subscriber dalam 1 group
- Broker membagi message otomatis
- Demonstrasi load balancing MQTT 5.0
*/

const dashboardSub1 = createClient('dashboard_subscriber_1', {
    properties: { receiveMaximum: 15 }
});

const dashboardSub2 = createClient('dashboard_subscriber_2', {
    properties: { receiveMaximum: 15 }
});

const alertSub = createClient('alert_subscriber', {
    properties: { receiveMaximum: 10 }
});

/*
========================================
DASHBOARD SUBSCRIBER 1
========================================
*/

dashboardSub1.on('connect', () => {
    console.log('✅ Dashboard Subscriber 1 Connected');

    // Shared Subscription
    dashboardSub1.subscribe(
        '$share/web_group/farm/sensors/+/+',
        { qos: 1 }
    );

    dashboardSub1.subscribe(
        '$share/web_group/farm/status/+',
        { qos: 1 }
    );
});

dashboardSub1.on('message', (topic, message) => {
    const parts = topic.split('/');
    const type = parts[1];
    const ctrl = parts[2];

    if (type === 'sensors') {
        const data = JSON.parse(message.toString());

        console.log(
            `[SUB-1] ${ctrl} → T:${data.temp}°C H:${data.hum}% CO2:${data.co2}ppm | ${data.timestamp}`
        );
    }

    else if (type === 'status') {
        const statusData = JSON.parse(message.toString());

        console.log(
            `[SUB-1 STATUS] ${ctrl} → ${statusData.status} (${statusData.timestamp})`
        );
    }
});

/*
========================================
DASHBOARD SUBSCRIBER 2
========================================
*/

dashboardSub2.on('connect', () => {
    console.log('✅ Dashboard Subscriber 2 Connected');

    // SAME GROUP = MESSAGE LOAD BALANCING
    dashboardSub2.subscribe(
        '$share/web_group/farm/sensors/+/+',
        { qos: 1 }
    );

    dashboardSub2.subscribe(
        '$share/web_group/farm/status/+',
        { qos: 1 }
    );
});

dashboardSub2.on('message', (topic, message) => {
    const parts = topic.split('/');
    const type = parts[1];
    const ctrl = parts[2];

    if (type === 'sensors') {
        const data = JSON.parse(message.toString());

        console.log(
            `[SUB-2] ${ctrl} → T:${data.temp}°C H:${data.hum}% CO2:${data.co2}ppm | ${data.timestamp}`
        );
    }

    else if (type === 'status') {
        const statusData = JSON.parse(message.toString());

        console.log(
            `[SUB-2 STATUS] ${ctrl} → ${statusData.status} (${statusData.timestamp})`
        );
    }
});

/*
========================================
ALERT SUBSCRIBER
========================================
*/

alertSub.on('connect', () => {
    console.log('✅ Alert Subscriber Connected');

    alertSub.subscribe(
        '$share/alert_group/farm/alerts/+',
        { qos: 1 }
    );

    alertSub.subscribe(
        '$share/alert_group/farm/status/+',
        { qos: 1 }
    );
});

alertSub.on('message', (topic, message) => {
    const parts = topic.split('/');
    const type = parts[1];
    const ctrl = parts[2];

    if (type === 'alerts') {
        const data = JSON.parse(message.toString());

        console.log(
            `🚨 [ALERT] ${ctrl}: ${data.message} (@${data.timestamp})`
        );
    }

    else if (type === 'status') {
        const statusData = JSON.parse(message.toString());

        if (statusData.status.toLowerCase() === 'offline') {
            console.log(
                `⚠️ [ALERT] ${ctrl} is OFFLINE (${statusData.timestamp})`
            );
        }
    }
});