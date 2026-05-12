const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db'); // Mengambil dari folder yang sama (common)
const { createClient } = require('./mqttClient');

const PORT = 3001;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
// Melayani file statis (css, js client) dari folder web
app.use(express.static(path.join(__dirname, '../web')));

// Simpan client MQTT yang aktif berdasarkan username
const activeSubscriptions = new Map();

wss.on('connection', (ws) => {
    console.log('New Browser Connected');
    let currentUser = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'auth') {
                const { username, password } = data;

                const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
                if (!user) {
                    console.log(`❌ Auth failed for: ${username}`);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid username or password' }));
                    return;
                }

                if (activeSubscriptions.has(username)) {
                    console.log(`🔄 Re-authenticating user: ${username}`);
                    activeSubscriptions.get(username).end();
                    activeSubscriptions.delete(username);
                }

                currentUser = username;
                ws.send(JSON.stringify({ type: 'auth_ok', username }));
                setupMqttForUser(ws, user);
            }

            if (data.type === 'register') {
                const { username, password, controllers } = data;

                try {
                    db.prepare("INSERT INTO users (username, password, allowed_controllers) VALUES (?, ?, ?)").run(username, password, controllers);
                    console.log(`✅ New user registered: ${username}`);
                    ws.send(JSON.stringify({ type: 'reg_ok' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Username already exists' }));
                }
            }
        } catch (e) {
            console.error("Gagal memproses pesan WS:", e);
        }
    });

    // 3. Cleanup saat tab browser ditutup
    ws.on('close', () => {
        if (currentUser && activeSubscriptions.has(currentUser)) {
            console.log(`🔌 Closing MQTT client for user: ${currentUser}`);
            activeSubscriptions.get(currentUser).end();
            activeSubscriptions.delete(currentUser);
        }
    });
});

function setupMqttForUser(ws, user) {
    const controllers = user.allowed_controllers.split(',');
    
    const mqttClient = createClient(`web_sub_${user.username}`, {
        properties: { receiveMaximum: 15 }
    });

    mqttClient.on('connect', () => {
        console.log(`✅ MQTT Client Active for ${user.username}. Monitoring: ${controllers}`);
        
        controllers.forEach(ctrlId => {
            // New topic structure subscriptions
            mqttClient.subscribe(`$share/web_group/farm/sensors/${ctrlId}/+`, { qos: 1 });
            mqttClient.subscribe(`$share/web_group/farm/status/${ctrlId}`, { qos: 1 });
            mqttClient.subscribe(`$share/web_group/farm/alerts/${ctrlId}`, { qos: 1 });
        });
    });

    mqttClient.on('message', (topic, message) => {
        const parts = topic.split('/');
        const type = parts[1]; // sensors, status, or alerts
        const ctrlId = parts[2];

        let payload;
        if (type === 'sensors') {
            try {
                const data = JSON.parse(message.toString());
                const modId = parts[3];

                // Step 2: Improved Data Persistence (DB Logging)
                const stmt = db.prepare('INSERT INTO sensor_logs (controller_id, module_id, temperature, humidity, co2) VALUES (?, ?, ?, ?, ?)');
                stmt.run(ctrlId, modId, data.temp, data.hum, data.co2);

                payload = {
                    type: 'sensor',
                    controller: ctrlId,
                    ts: data.timestamp || new Date().toISOString(),
                    payload: {
                        temperature: parseFloat(data.temp),
                        humidity: parseFloat(data.hum),
                        co2: parseFloat(data.co2)
                    }
                };
            } catch (e) { console.error("DB Log Error:", e); return; }
        } else if (type === 'alerts') {
            try {
                const data = JSON.parse(message.toString());
                payload = {
                    type: 'alert',
                    controller: ctrlId,
                    message: data.message,
                    ts: data.timestamp
                };
            } catch (e) { return; }
        } else if (type === 'status') {
            try {
                const data = JSON.parse(message.toString());
                payload = {
                    type: 'status',
                    controller: ctrlId,
                    status: data.status,
                    ts: data.timestamp
                };
            } catch (e) {
                // Fallback for non-JSON status
                payload = {
                    type: 'status',
                    controller: ctrlId,
                    status: message.toString().toLowerCase().includes('offline') ? 'offline' : 'online'
                };
            }
        }

        if (ws.readyState === WebSocket.OPEN && payload) {
            ws.send(JSON.stringify(payload));
        }
    });

    activeSubscriptions.set(user.username, mqttClient);
}


// ─── ROUTING ───
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/web.html'));
});

// Historical Data API
app.get('/api/history/:controllerId', (req, res) => {
    const { controllerId } = req.params;
    try {
        const rows = db.prepare('SELECT * FROM sensor_logs WHERE controller_id = ? ORDER BY timestamp DESC LIMIT 50').all(controllerId);
        res.json(rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── START ───
server.listen(PORT, () => {
    console.log(`
    🚀 GCMS Backend is Running!
    URL: http://localhost:${PORT}
    DB: Connected to farming.db
    `);
});