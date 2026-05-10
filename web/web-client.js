const MAX_CHART_POINTS = 30;

let ws;
let msgCount = 0;
let controllers = {};

const charts = {
  temp: null,
  humidity: null,
  co2: null
};

function initCharts() {
  const defaults = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#8b949e', font: { size: 10 } }
      }
    }
  };

  charts.temp = new Chart(document.getElementById('chart-temp'), {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderColor: '#39d353', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(57,211,83,0.08)' }] },
    options: defaults
  });

  charts.humidity = new Chart(document.getElementById('chart-humidity'), {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderColor: '#58a6ff', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(88,166,255,0.08)' }] },
    options: defaults
  });

  charts.co2 = new Chart(document.getElementById('chart-co2'), {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderColor: '#d69e2e', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(214,158,46,0.08)' }] },
    options: defaults
  });
}

function pushData(chart, value) {
  chart.data.labels.push(new Date().toLocaleTimeString());
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_CHART_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function updateMetrics(data) {
  const t = document.getElementById('m-temp');
  const h = document.getElementById('m-humidity');
  const c = document.getElementById('m-co2');

  t.textContent = data.temperature.toFixed(1);
  h.textContent = data.humidity.toFixed(1);
  c.textContent = data.co2.toFixed(0);

  t.className = 'metric-val' + (data.temperature > 35 ? ' alert' : data.temperature > 30 ? ' warn' : '');
  h.className = 'metric-val' + (data.humidity < 40 ? ' alert' : data.humidity < 60 ? ' warn' : '');
  c.className = 'metric-val' + (data.co2 > 1000 ? ' alert' : data.co2 > 800 ? ' warn' : '');

  pushData(charts.temp, data.temperature);
  pushData(charts.humidity, data.humidity);
  pushData(charts.co2, data.co2);
}

function updateControllerBadge(ctrlId, status) {
  if (!controllers[ctrlId]) controllers[ctrlId] = 'offline';
  controllers[ctrlId] = status;

  const container = document.getElementById('controller-badges');
  container.innerHTML = '';

  let onlineCount = 0;
  Object.entries(controllers).forEach(([id, st]) => {
    if (st === 'online') onlineCount++;
    const badge = document.createElement('span');
    badge.className = `ctrl-badge ${st}`;
    badge.innerHTML = `<span class="ctrl-dot"></span>${id}`;
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
      updateMetrics(data.payload);
      updateControllerBadge(data.controller, 'online');
      addLog('sensor', `${data.controller}: T=${data.payload.temperature}°C H=${data.payload.humidity}% CO2=${data.payload.co2}ppm`);
    } else if (data.type === 'status') {
      updateControllerBadge(data.controller, data.status);
      addLog('status', `${data.controller} is ${data.status}`);
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
