const MAX_CHART_POINTS = 30;

let ws;
let msgCount = 0;
let controllers = {};
let activeController = null;

const charts = {
  temp: null,
  humidity: null,
  co2: null
};

function initCharts() {
  const defaults = {
    animation: { duration: 800, easing: 'easeOutQuart' },
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { 
        display: true, 
        grid: { display: false },
        ticks: { color: '#8b949e', font: { size: 9 }, maxRotation: 0 }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#8b949e', font: { size: 10 } }
      }
    }
  };

  charts.temp = new Chart(document.getElementById('chart-temp'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Temp', data: [], borderColor: '#39d353', borderWidth: 2, pointRadius: 2, fill: true, backgroundColor: 'rgba(57,211,83,0.1)', tension: 0.4 }] },
    options: defaults
  });

  charts.humidity = new Chart(document.getElementById('chart-humidity'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Humidity', data: [], borderColor: '#58a6ff', borderWidth: 2, pointRadius: 2, fill: true, backgroundColor: 'rgba(88,166,255,0.1)', tension: 0.4 }] },
    options: defaults
  });

  charts.co2 = new Chart(document.getElementById('chart-co2'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'CO2', data: [], borderColor: '#d69e2e', borderWidth: 2, pointRadius: 2, fill: true, backgroundColor: 'rgba(214,158,46,0.1)', tension: 0.4 }] },
    options: defaults
  });
}

async function loadHistory(ctrlId) {
  try {
    const res = await fetch(`/api/history/${ctrlId}`);
    const data = await res.json();
    
    if (data.length > 0) {
      addLog('status', `Loaded ${data.length} historical points for ${ctrlId}`);
      
      const labels = data.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const temps = data.map(r => r.temperature);
      const hums = data.map(r => r.humidity);
      const co2s = data.map(r => r.co2);

      charts.temp.data.labels = labels;
      charts.temp.data.datasets[0].data = temps;
      
      charts.humidity.data.labels = labels;
      charts.humidity.data.datasets[0].data = hums;
      
      charts.co2.data.labels = labels;
      charts.co2.data.datasets[0].data = co2s;

      Object.values(charts).forEach(c => c.update());
      
      // Update latest metrics from history
      const last = data[data.length - 1];
      updateMetricsDisplay({ temperature: last.temperature, humidity: last.humidity, co2: last.co2 });
    }
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

function pushData(chart, label, value) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_CHART_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function updateMetricsDisplay(data) {
  const t = document.getElementById('m-temp');
  const h = document.getElementById('m-humidity');
  const c = document.getElementById('m-co2');

  t.textContent = data.temperature.toFixed(1);
  h.textContent = data.humidity.toFixed(1);
  c.textContent = data.co2.toFixed(0);

  t.className = 'metric-val' + (data.temperature > 35 ? ' alert' : data.temperature > 30 ? ' warn' : '');
  h.className = 'metric-val' + (data.humidity < 40 ? ' alert' : data.humidity < 60 ? ' warn' : '');
  c.className = 'metric-val' + (data.co2 > 1000 ? ' alert' : data.co2 > 800 ? ' warn' : '');
}

function calculateAliasSavings(topic, payload) {
  const fullSize = topic.length + JSON.stringify(payload).length;
  const aliasSize = 2 + JSON.stringify(payload).length; // Topic Alias property is small
  const savings = ((fullSize - aliasSize) / fullSize * 100).toFixed(1);
  document.getElementById('alias-savings').textContent = `${savings}%`;
}

function updateControllerBadge(ctrlId, status) {
  if (!controllers[ctrlId]) {
    controllers[ctrlId] = 'offline';
    if (!activeController) {
      activeController = ctrlId;
      loadHistory(ctrlId);
    }
  }
  controllers[ctrlId] = status;

  const container = document.getElementById('controller-badges');
  container.innerHTML = '';

  let onlineCount = 0;
  Object.entries(controllers).forEach(([id, st]) => {
    if (st === 'online') onlineCount++;
    const badge = document.createElement('span');
    badge.className = `ctrl-badge ${st} ${activeController === id ? 'active' : ''}`;
    badge.innerHTML = `<span class="ctrl-dot"></span>${id}`;
    badge.onclick = () => {
      activeController = id;
      loadHistory(id);
      updateControllerBadge(id, controllers[id]);
    };
    container.appendChild(badge);
  });

  document.getElementById('m-ctrl').textContent = onlineCount;
}

function addLog(type, msg) {
  const log = document.getElementById('event-log');
  const noData = log.querySelector('.no-data');
  if (noData) noData.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-tag">[${type.toUpperCase()}]</span><span class="log-msg">${msg}</span>`;
  log.prepend(entry);

  while (log.children.length > 50) log.lastChild.remove();
}

function clearLog() {
  document.getElementById('event-log').innerHTML = '<span class="no-data">Log cleared.</span>';
}

function setWsState(state) {
  const badge = document.getElementById('ws-badge');
  const dot = document.getElementById('ws-dot');
  const label = document.getElementById('ws-label');

  badge.className = 'ws-badge' + (state === 'connected' ? ' connected' : state === 'error' ? ' error' : '');
  dot.className = 'ws-dot' + (state === 'connected' ? ' on' : state === 'error' ? ' error' : '');
  label.textContent = state === 'connected' ? 'Connected' : state === 'error' ? 'Error' : 'Disconnected';
}

function addAlert(ctrlId, message, ts) {
  const container = document.getElementById('alerts-container');
  const noData = container.querySelector('.no-data');
  if (noData) noData.remove();

  const alertId = `alert-${ctrlId}-${Date.now()}`;
  const alertEl = document.createElement('div');
  alertEl.className = 'alert-item';
  alertEl.id = alertId;
  alertEl.innerHTML = `
    <div class="alert-icon">⚠️</div>
    <div class="alert-content">
      <div class="alert-title">${ctrlId} Alert</div>
      <div class="alert-message">${message}</div>
      <div class="alert-meta">${new Date(ts).toLocaleString()}</div>
    </div>
    <button class="btn-logout" style="margin-left:auto; padding:2px 8px" onclick="this.parentElement.remove(); checkEmptyAlerts()">Dismiss</button>
  `;
  container.prepend(alertEl);

  setTimeout(() => {
    if (document.getElementById(alertId)) {
      document.getElementById(alertId).remove();
      checkEmptyAlerts();
    }
  }, 60000);
}

function checkEmptyAlerts() {
  const container = document.getElementById('alerts-container');
  if (container.children.length === 0) {
    container.innerHTML = '<span class="no-data">No active alerts. System healthy.</span>';
  }
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => setWsState('connected');
  ws.onclose = () => setWsState('');
  ws.onerror = () => setWsState('error');

  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);

    if (data.type === 'auth_ok') {
      document.getElementById('auth-overlay').style.display = 'none';
      document.getElementById('main-content').classList.remove('blurred');
      addLog('status', `Logged in as ${data.username}`);
      return;
    }

    if (data.type === 'error') {
      const errEl = document.getElementById('auth-error');
      errEl.textContent = data.message;
      errEl.style.display = 'block';
      addLog('error', data.message);
      return;
    }

    if (data.type === 'reg_ok') {
      addLog('status', 'Registration successful. Please login.');
      toggleAuth(false);
      return;
    }

    msgCount++;
    document.getElementById('msg-count').textContent = msgCount;

    if (data.type === 'sensor') {
      updateControllerBadge(data.controller, 'online');
      
      if (data.controller === activeController) {
        updateMetricsDisplay(data.payload);
        const timeLabel = new Date(data.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        pushData(charts.temp, timeLabel, data.payload.temperature);
        pushData(charts.humidity, timeLabel, data.payload.humidity);
        pushData(charts.co2, timeLabel, data.payload.co2);
        
        // Demo Topic Alias Logic
        calculateAliasSavings(`farm/sensors/${data.controller}/MOD_01`, data.payload);
      }
      
      addLog('sensor', `${data.controller}: T=${data.payload.temperature.toFixed(1)}°C H=${data.payload.humidity.toFixed(1)}%`);
    } else if (data.type === 'status') {
      updateControllerBadge(data.controller, data.status);
      addLog('status', `${data.controller} is ${data.status.toUpperCase()}`);
    } else if (data.type === 'alert') {
      addAlert(data.controller, data.message, data.ts);
      addLog('error', `ALERT ${data.controller}: ${data.message}`);
    }
  };
}

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pass').value;
  ws.send(JSON.stringify({ type: 'auth', username, password }));
});

document.getElementById('register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-user').value;
  const password = document.getElementById('reg-pass').value;
  const controllers = document.getElementById('reg-ctrl').value;
  ws.send(JSON.stringify({ type: 'register', username, password, controllers }));
});

initCharts();
connectWS();
