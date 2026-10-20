const KEY = 'my-bus-timetable-v1';
const SAMPLE_URL = 'sample.json';

let routes = [];
let dayMode = 'auto';
let editingId = null;

// Saved routes win; sample.json is only the starting point when nothing is saved yet
async function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  try {
    const res = await fetch(SAMPLE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn(`${SAMPLE_URL} 을 읽지 못했어요:`, e);
    return [];
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(routes)); }
  catch (e) { document.getElementById('warn').hidden = false; }
}
function storageOk() {
  try { localStorage.setItem(KEY + '-probe', '1'); localStorage.removeItem(KEY + '-probe'); return true; }
  catch (e) { return false; }
}

const pad = n => String(n).padStart(2, '0');
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function parseTimes(text) {
  const out = [];
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    let m = tok.match(/^(\d{1,2}):(\d{2})$/) || tok.match(/^(\d{1,2})(\d{2})$/);
    if (!m) throw new Error(`"${tok}" 는 올바른 시간 형식이 아닙니다.`);
    const h = +m[1], mi = +m[2];
    if (h > 27 || mi > 59) throw new Error(`"${tok}" 는 올바른 시간이 아닙니다.`);
    out.push(`${pad(h)}:${pad(mi)}`);
  }
  return [...new Set(out)].sort((a, b) => toMin(a) - toMin(b));
}

function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }
function currentType(now) {
  if (dayMode !== 'auto') return dayMode;
  return isWeekend(now) ? 'weekend' : 'weekday';
}
function timesFor(r, type) {
  if (type === 'weekend' && r.weekend && r.weekend.length) return r.weekend;
  return r.weekday || [];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function render() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const type = currentType(now);
  const live = dayMode === 'auto' || (dayMode === 'weekend') === isWeekend(now);
  const list = document.getElementById('list');

  if (!routes.length) {
    list.innerHTML = '<div class="card empty">등록된 노선이 없어요. 아래에서 추가해 주세요.</div>';
    list.dataset.last = '';
    return;
  }

  const html = routes.map(r => {
    const times = timesFor(r, type);
    let nextIdx = live ? times.findIndex(t => toMin(t) >= nowMin) : -1;
    let nextHtml;
    if (!times.length) {
      nextHtml = '<div class="sub">운행 없음</div>';
    } else if (!live) {
      nextHtml = `<div class="sub">첫차 ${times[0]}<br>막차 ${times[times.length - 1]}</div>`;
    } else if (nextIdx === -1) {
      nextHtml = '<div class="mins">운행 종료</div><div class="sub">첫차 ' + times[0] + '</div>';
    } else {
      const diff = Math.max(0, Math.floor(toMin(times[nextIdx]) - nowMin));
      const after = times[nextIdx + 1];
      nextHtml = `<div class="mins ${diff <= 5 ? 'soon' : ''}">${diff === 0 ? '곧 도착' : diff + '분 후'}</div>
        <div class="sub">${times[nextIdx]} 출발${after ? ' · 다음 ' + after : ' · 막차'}</div>`;
    }
    const chips = times.map((t, i) => {
      let cls = '';
      if (live && nextIdx !== -1) cls = i < nextIdx ? 'past' : i === nextIdx ? 'upcoming' : '';
      else if (live && nextIdx === -1) cls = 'past';
      return `<span class="${cls}">${t}</span>`;
    }).join('');
    return `<div class="card">
      <div class="route-head">
        <div>
          <div class="route-name"><span class="badge">${esc(r.no)}</span>${esc(r.dir || '')}</div>
          <div class="stop">📍 ${esc(r.stop)}</div>
        </div>
        <div class="next">${nextHtml}</div>
      </div>
      <div class="times">${chips || '<span class="past">시간 미등록</span>'}</div>
      <div class="actions">
        <button class="btn" data-edit="${r.id}">수정</button>
        <button class="btn danger" data-del="${r.id}">삭제</button>
      </div>
    </div>`;
  }).join('');
  // Only touch the DOM when something changed, so buttons aren't replaced mid-click
  if (html !== list.dataset.last) { list.innerHTML = html; list.dataset.last = html; }
}

function tickClock() {
  const now = new Date();
  document.getElementById('now').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const days = ['일','월','화','수','목','금','토'];
  document.getElementById('today').textContent =
    `${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]}) · ${isWeekend(now) ? '주말' : '평일'}`;
}

// Tabs
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  dayMode = b.dataset.day;
  render();
}));

// Dialog
const dlg = document.getElementById('dlg');
const f = id => document.getElementById(id);

function openDialog(route) {
  editingId = route ? route.id : null;
  f('dlgTitle').textContent = route ? '노선 수정' : '노선 추가';
  f('fNo').value = route ? route.no : '';
  f('fStop').value = route ? route.stop : '';
  f('fDir').value = route ? route.dir || '' : '';
  f('fWeekday').value = route ? (route.weekday || []).join(', ') : '';
  f('fWeekend').value = route ? (route.weekend || []).join(', ') : '';
  f('err').textContent = '';
  dlg.showModal();
}

f('addBtn').addEventListener('click', () => openDialog(null));
f('cancelBtn').addEventListener('click', () => dlg.close());

f('form').addEventListener('submit', e => {
  e.preventDefault();
  let weekday, weekend;
  try {
    weekday = parseTimes(f('fWeekday').value);
    weekend = parseTimes(f('fWeekend').value);
  } catch (err) {
    f('err').textContent = err.message;
    return;
  }
  const data = { no: f('fNo').value.trim(), stop: f('fStop').value.trim(), dir: f('fDir').value.trim(), weekday, weekend };
  if (editingId != null) {
    routes = routes.map(r => r.id === editingId ? { ...r, ...data } : r);
  } else {
    routes.push({ id: Date.now(), ...data });
  }
  save();
  dlg.close();
  render();
});

// In-page confirm: some embedded browsers make window.confirm() return false without showing anything
const confirmDlg = document.getElementById('confirmDlg');
function askConfirm(message) {
  f('confirmMsg').textContent = message;
  confirmDlg.returnValue = '';
  confirmDlg.showModal();
  return new Promise(resolve => {
    confirmDlg.addEventListener('close', () => resolve(confirmDlg.returnValue === 'ok'), { once: true });
  });
}

document.getElementById('list').addEventListener('click', async e => {
  const edit = e.target.dataset.edit, del = e.target.dataset.del;
  if (edit) openDialog(routes.find(r => String(r.id) === edit));
  if (del) {
    const r = routes.find(r => String(r.id) === del);
    if (r && await askConfirm(`${r.no}번 (${r.stop}) 노선을 삭제할까요?`)) {
      routes = routes.filter(x => x !== r);
      save();
      render();
    }
  }
});

if (!storageOk()) document.getElementById('warn').hidden = false;
tickClock();
load().then(data => {
  routes = data;
  render();
  setInterval(() => { tickClock(); render(); }, 1000);
});
