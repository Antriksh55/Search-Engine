const API = '';
let uid = 'user123';
let acTimer = null;

const steps = [
  { color: '#7c3aed', title: 'Query received & validated', text: 'Express receives the request. Joi middleware validates all parameters — query must be non-empty, page must be a number, sort must be a known value. Invalid input is rejected before touching any database.' },
  { color: '#06b6d4', title: 'Redis cache lookup', text: 'Before hitting Elasticsearch, the server checks Redis for a cached result using a key built from all query parameters. Cache HIT → result returned in ~1ms. Cache MISS → continues to Elasticsearch.' },
  { color: '#10b981', title: 'Inverted index lookup', text: 'Elasticsearch doesn\'t scan documents. It looks up your keyword in a pre-built inverted index — a map of every word to the documents containing it. "nodejs" → [doc1, doc3] in microseconds.' },
  { color: '#f59e0b', title: 'Relevance scoring (TF-IDF)', text: 'Each matching document gets a _score. Score = Term Frequency × Inverse Document Frequency × field boost. Title matches count 3× more than content. Higher score = shown first.' },
  { color: '#ef4444', title: 'Result cached + analytics saved', text: 'Result stored in Redis for 5 minutes (TTL). Your search is saved to MongoDB asynchronously using setImmediate() — fire-and-forget, never delays your response. Used for history and popular queries.' },
  { color: '#7c3aed', title: 'Response returned', text: 'Ranked results with _score, total count, and keyword highlights sent back. Total time: ~10–50ms from Elasticsearch, or ~1ms from Redis cache hit.' },
];

function buildPipeline() {
  const el = document.getElementById('pipeline');
  el.innerHTML = steps.map(s => `
    <div class="pipe-step">
      <div class="pipe-num" style="background:${s.color}">${steps.indexOf(s)+1}</div>
      <div class="pipe-body">
        <h4>${s.title}</h4>
        <p>${s.text}</p>
      </div>
    </div>
  `).join('');
}

// ── NAV ──
function goHome() {
  document.getElementById('homePage').style.display = 'flex';
  document.getElementById('resultsPage').style.display = 'none';
}

function goSearch() {
  const q = document.getElementById('homeInput').value.trim();
  uid = document.getElementById('homeUID').value.trim() || 'user123';
  if (!q) return;
  closeAC('homeACBox');
  document.getElementById('topInput').value = q;
  document.getElementById('homePage').style.display = 'none';
  document.getElementById('resultsPage').style.display = 'block';
  buildPipeline();
  switchTab('results');
  fetchResults(q);
}

function showHow() {
  document.getElementById('homePage').style.display = 'none';
  document.getElementById('resultsPage').style.display = 'block';
  buildPipeline();
  switchTab('how');
}

function doSearch() {
  const q = document.getElementById('topInput').value.trim();
  if (!q) return;
  closeAC('topACBox');
  switchTab('results');
  fetchResults(q);
}

// ── SEARCH ──
async function fetchResults(q) {
  document.getElementById('resultsArea').innerHTML = `<div class="loader"><span></span><span></span><span></span></div>`;
  try {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&highlight=true&userId=${uid}`);
    const cache = res.headers.get('X-Cache') || 'MISS';
    const data = await res.json();
    renderResults(data, q, cache);
  } catch(e) {
    document.getElementById('resultsArea').innerHTML = `<div class="empty-state"><div class="e-icon">⚠️</div><p>Could not connect to server.</p></div>`;
  }
}

function hl(str) {
  if (!str) return '';
  return str.replace(/\u003cem\u003e/g,'<em>').replace(/\u003c\/em\u003e/g,'</em>');
}

function renderResults(data, q, cache) {
  const area = document.getElementById('resultsArea');
  if (!data.success || data.total === 0) {
    area.innerHTML = `<div class="empty-state"><div class="e-icon">🔍</div><p>No results for "<strong>${q}</strong>"</p></div>`;
    return;
  }
  const isHit = cache === 'HIT';
  let html = `
    <div class="result-meta-bar">
      <span class="stat-text">${data.total} result${data.total!==1?'s':''} found</span>
      <span class="cache-tag ${isHit?'hit':'miss'}">
        <span class="cache-dot"></span>
        ${isHit ? 'Redis HIT · ~1ms' : 'Elasticsearch · ~50ms'}
      </span>
    </div>
  `;
  data.data.forEach(doc => {
    const title = hl(doc.highlights?.title?.[0] || doc.title);
    const snippet = hl(doc.highlights?.content?.[0] || (doc.content||'').substring(0,200));
    const date = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
    html += `
      <div class="result-card">
        ${doc.category ? `<div class="r-category">${doc.category}</div>` : ''}
        <h3>${title}</h3>
        <p>${snippet}</p>
        <div class="result-footer">
          <span class="score-badge">score ${doc._score?.toFixed(3)}</span>
          <span class="r-date">${date}</span>
        </div>
      </div>
    `;
  });
  area.innerHTML = html;
}

// ── AUTOCOMPLETE ──
function homeAC(v) {
  clearTimeout(acTimer);
  if (v.length < 2) { closeAC('homeACBox'); return; }
  acTimer = setTimeout(() => fetchAC(v, 'homeACBox', 'homeInput', true), 260);
}
function topAC(v) {
  clearTimeout(acTimer);
  if (v.length < 2) { closeAC('topACBox'); return; }
  acTimer = setTimeout(() => fetchAC(v, 'topACBox', 'topInput', false), 260);
}

async function fetchAC(q, boxId, inputId, isHome) {
  try {
    const res = await fetch(`${API}/api/search/autocomplete?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const box = document.getElementById(boxId);
    if (!data.success || !data.data.length) { box.classList.remove('open'); return; }
    box.innerHTML = data.data.map(s =>
      `<div class="ac-item" onclick="pickAC('${s.text}','${inputId}','${boxId}',${isHome})">
        <span class="ac-ic">↗</span>${s.text}
      </div>`
    ).join('');
    box.classList.add('open');
  } catch(e) {}
}

function pickAC(text, inputId, boxId, isHome) {
  document.getElementById(inputId).value = text;
  closeAC(boxId);
  if (isHome) goSearch(); else doSearch();
}

function closeAC(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  if (!e.target.closest('#homeWrap')) closeAC('homeACBox');
  if (!e.target.closest('#topWrap')) closeAC('topACBox');
});

// ── HISTORY ──
async function loadHistory() {
  const area = document.getElementById('historyArea');
  area.innerHTML = `<div class="loader"><span></span><span></span><span></span></div>`;
  try {
    const res = await fetch(`${API}/api/analytics/history?userId=${uid}`);
    const data = await res.json();
    if (!data.success || !data.data.length) {
      area.innerHTML = `<div class="empty-state"><div class="e-icon">🕐</div><p>No history yet for <strong>${uid}</strong></p></div>`;
      return;
    }
    area.innerHTML = data.data.map(h => `
      <div class="history-card" onclick="searchFromHistory('${h.query}')">
        <div>
          <div class="h-query">🔍 ${h.query}</div>
        </div>
        <div class="h-meta">
          ${h.resultCount} result${h.resultCount!==1?'s':''}<br>
          ${new Date(h.searchedAt).toLocaleTimeString()}
        </div>
      </div>
    `).join('');
  } catch(e) {
    area.innerHTML = `<div class="empty-state"><div class="e-icon">⚠️</div><p>Could not load history.</p></div>`;
  }
}

function searchFromHistory(q) {
  document.getElementById('topInput').value = q;
  switchTab('results');
  fetchResults(q);
}

// ── TABS ──
function switchTab(name) {
  const tabs = ['results','history','how'];
  tabs.forEach((t,i) => {
    document.querySelectorAll('.tab')[i].classList.toggle('active', t===name);
    const pane = document.getElementById('pane'+t.charAt(0).toUpperCase()+t.slice(1));
    pane.classList.toggle('active', t===name);
  });
  if (name === 'history') loadHistory();
}
