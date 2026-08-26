/* MelachaPlug Setup Wizard — custom web UI for ESPHome web server v2
 * Replaces the default ESPHome component list with a clean setup form.
 * Communicates via the ESPHome REST API (GET/POST to /switch, /number, /select, /button endpoints)
 * Vanilla JS, no frameworks, works on iOS Safari.
 */
(function(){
"use strict";

// ESPHome REST API helpers
const api = {
  get: async (path) => {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`GET ${path} failed`);
    return r.json();
  },
  post: async (path, data) => {
    const body = new URLSearchParams(data);
    const r = await fetch(path, {method:'POST', body});
    if (!r.ok) throw new Error(`POST ${path} failed`);
  }
};

// Entity ID slugifier (ESPHome lowercases and hyphenates names)
function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Read all current settings from the device
async function readSettings() {
  const settings = {};
  try {
    // Read switches
    settings.inverted = (await api.get('/switch/25-inverted-shabbos-mode')).state === 'ON';
    settings.earlyShabbos = (await api.get('/switch/24-early-shabbos')).state === 'ON';
    settings.eretzYisrael = (await api.get('/switch/17-eretz-yisrael')).state === 'ON';
    settings.shabbosMode = (await api.get('/switch/19-shabbos-mode')).state === 'ON';
    settings.override = (await api.get('/switch/18-override-shabbos-mode')).state === 'ON';
    settings.localNtpFirst = (await api.get('/switch/27-local-ntp-first')).state === 'ON';

    // Read numbers
    settings.minOffsetStart = (await api.get('/number/06-minute-offset-start')).value;
    settings.minOffsetEnd = (await api.get('/number/07-minute-offset-end')).value;
    settings.degStarts = (await api.get('/number/08-degree-shabbos-starts')).value;
    settings.degEnds = (await api.get('/number/09-degree-shabbos-ends')).value;
    settings.lat = (await api.get('/number/13-set-latitude')).value;
    settings.lon = (await api.get('/number/14-set-longitude')).value;
    settings.ntp1 = (await api.get('/number/28-local-ntp-ip-1')).value;
    settings.ntp2 = (await api.get('/number/29-local-ntp-ip-2')).value;
    settings.ntp3 = (await api.get('/number/30-local-ntp-ip-3')).value;
    settings.ntp4 = (await api.get('/number/31-local-ntp-ip-4')).value;

    // Read text sensors
    settings.hebrewDate = (await api.get('/text_sensor/02-hebrew-date')).state;
    settings.timezone = (await api.get('/text_sensor/06a-current-timezone')).state;
    settings.internetStatus = (await api.get('/text_sensor/08a-internet-status')).state;
    settings.location = (await api.get('/text_sensor/12-location-info')).state;
    settings.checkTime = (await api.get('/text_sensor/03-todays-melacha-check-time')).state;

    // Read select
    settings.tzSelect = (await api.get('/select/06b-set-timezone')).state;
  } catch(e) {
    console.warn('readSettings error:', e);
  }
  return settings;
}

// Save settings to the device
async function saveSettings(data) {
  const tasks = [];

  if (data.inverted !== undefined)
    tasks.push(api.post('/switch/25-inverted-shabbos-mode', {state: data.inverted ? 'ON' : 'OFF'}));
  if (data.earlyShabbos !== undefined)
    tasks.push(api.post('/switch/24-early-shabbos', {state: data.earlyShabbos ? 'ON' : 'OFF'}));
  if (data.eretzYisrael !== undefined)
    tasks.push(api.post('/switch/17-eretz-yisrael', {state: data.eretzYisrael ? 'ON' : 'OFF'}));
  if (data.minOffsetStart !== undefined)
    tasks.push(api.post('/number/06-minute-offset-start', {value: data.minOffsetStart}));
  if (data.minOffsetEnd !== undefined)
    tasks.push(api.post('/number/07-minute-offset-end', {value: data.minOffsetEnd}));
  if (data.degStarts !== undefined)
    tasks.push(api.post('/number/08-degree-shabbos-starts', {value: data.degStarts}));
  if (data.degEnds !== undefined)
    tasks.push(api.post('/number/09-degree-shabbos-ends', {value: data.degEnds}));
  if (data.lat !== undefined)
    tasks.push(api.post('/number/13-set-latitude', {value: data.lat}));
  if (data.lon !== undefined)
    tasks.push(api.post('/number/14-set-longitude', {value: data.lon}));
  if (data.tzSelect !== undefined)
    tasks.push(api.post('/select/06b-set-timezone', {option: data.tzSelect}));
  if (data.ntp1 !== undefined)
    tasks.push(api.post('/number/28-local-ntp-ip-1', {value: data.ntp1}));
  if (data.ntp2 !== undefined)
    tasks.push(api.post('/number/29-local-ntp-ip-2', {value: data.ntp2}));
  if (data.ntp3 !== undefined)
    tasks.push(api.post('/number/30-local-ntp-ip-3', {value: data.ntp3}));
  if (data.ntp4 !== undefined)
    tasks.push(api.post('/number/31-local-ntp-ip-4', {value: data.ntp4}));
  if (data.localNtpFirst !== undefined)
    tasks.push(api.post('/switch/27-local-ntp-first', {state: data.localNtpFirst ? 'ON' : 'OFF'}));

  await Promise.all(tasks);
}

// Trigger location auto-detect
async function detectLocation() {
  await api.post('/button/15-detect-location', {});
}

// Press zmanim preset button
async function setZmanim(preset) {
  if (preset === 'alter Rebbe') {
    await api.post('/button/10-set-to-alter Rebbe-zmanim', {});
  } else if (preset === 'r Moshe') {
    await api.post('/button/10b-set-to-r-moshe-feinstein-zmanim', {});
  }
}

// UI rendering
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
  }
  children.flat().forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

function card(title, ...content) {
  return el('div', {class:'card'},
    el('h2', {}, title),
    ...content
  );
}

function field(label, input) {
  return el('div', {class:'field'},
    el('label', {}, label),
    input
  );
}

function input(type, id, value) {
  const i = el('input', {type, id, class:'input'});
  if (value != null) i.value = value;
  return i;
}

function select(id, options, selected) {
  const s = el('select', {id, class:'input'});
  options.forEach(opt => {
    const o = el('option', {value: opt}, opt);
    if (opt === selected) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

function toggle(id, checked) {
  const wrapper = el('label', {class:'toggle'},
    el('input', {type:'checkbox', id}),
    el('span', {class:'slider'})
  );
  if (checked) wrapper.querySelector('input').checked = true;
  return wrapper;
}

function btn(text, onClick, primary) {
  return el('button', {
    class: primary ? 'btn primary' : 'btn',
    onclick: onClick
  }, text);
}

// Main app
async function init() {
  const root = document.getElementById('app') || document.body;
  root.innerHTML = '';
  root.appendChild(el('div', {class:'loading'}, 'Loading settings from plug...'));

  const s = await readSettings();

  root.innerHTML = '';

  // Header
  root.appendChild(el('div', {class:'header'},
    el('h1', {}, '⚡ Melacha Plug'),
    el('div', {class:'status'},
      s.internetStatus ? el('span', {class:'badge ' + (s.internetStatus.includes('Connected') ? 'ok' : 'err')}, s.internetStatus) : null,
      ' ',
      s.hebrewDate ? el('span', {class:'badge'}, s.hebrewDate) : null
    )
  ));

  // Setup wizard
  const form = el('div', {class:'wizard'});

  // 1. Location
  form.appendChild(card('📍 Location',
    field('Location Info', el('div', {id:'loc-info', class:'info-box'}, s.location || 'Not set')),
    field('Latitude', input('number', 'set-lat', s.lat)),
    field('Longitude', input('number', 'set-lon', s.lon)),
    el('div', {class:'row'},
      btn('🔍 Auto-Detect', async () => {
        await detectLocation();
        setTimeout(async () => {
          const ns = await readSettings();
          document.getElementById('set-lat').value = ns.lat;
          document.getElementById('set-lon').value = ns.lon;
          document.getElementById('loc-info').textContent = ns.location;
        }, 3000);
      }),
      btn('Save Location', async () => {
        await saveSettings({
          lat: parseFloat(document.getElementById('set-lat').value),
          lon: parseFloat(document.getElementById('set-lon').value)
        });
        flash('Location saved');
      }, true)
    )
  ));

  // 2. Timezone
  const tzOptions = [
    'Auto-Detect', 'Eastern (EST/EDT)', 'Central (CST/CDT)',
    'Mountain (MST/MDT)', 'Mountain - No DST (Arizona)',
    'Pacific (PST/PDT)', 'Alaska (AKST/AKDT)',
    'Hawaii - No DST (HST)', 'Indiana - No DST (EST)',
    'Israel (IST/IDT)', 'UK (GMT/BST)', 'Central Europe (CET/CEST)'
  ];
  form.appendChild(card('🕐 Timezone',
    field('Current Timezone', el('div', {class:'info-box'}, s.timezone || 'Not set')),
    field('Select Timezone', select('set-tz', tzOptions, s.tzSelect || 'Auto-Detect')),
    btn('Save Timezone', async () => {
      await saveSettings({tzSelect: document.getElementById('set-tz').value});
      flash('Timezone saved');
    }, true)
  ));

  // 3. Zmanim
  form.appendChild(card('📜 Zmanim (Halachic Times)',
    field('Shabbos Start Offset (minutes before sunset)', input('number', 'set-offset-start', s.minOffsetStart)),
    field('Shabbos End Offset (minutes after sunset/degree)', input('number', 'set-offset-end', s.minOffsetEnd)),
    field('Degree Shabbos Starts', input('number', 'set-deg-starts', s.degStarts)),
    field('Degree Shabbos Ends', input('number', 'set-deg-ends', s.degEnds)),
    el('div', {class:'row'},
      btn('Set Alter Rebbe Zmanim', async () => {
        await setZmanim('alter Rebbe');
        flash('Alter Rebbe zmanim applied');
        setTimeout(async () => {
          const ns = await readSettings();
          document.getElementById('set-deg-starts').value = ns.degStarts;
          document.getElementById('set-deg-ends').value = ns.degEnds;
        }, 1000);
      }),
      btn('Set R\' Moshe Feinstein Zmanim', async () => {
        await setZmanim('r Moshe');
        flash('R\' Moshe zmanim applied');
        setTimeout(async () => {
          const ns = await readSettings();
          document.getElementById('set-deg-starts').value = ns.degStarts;
          document.getElementById('set-deg-ends').value = ns.degEnds;
          document.getElementById('set-offset-end').value = ns.minOffsetEnd;
        }, 1000);
      })
    ),
    el('div', {class:'row'},
      btn('Save Zmanim', async () => {
        await saveSettings({
          minOffsetStart: parseFloat(document.getElementById('set-offset-start').value),
          minOffsetEnd: parseFloat(document.getElementById('set-offset-end').value),
          degStarts: parseFloat(document.getElementById('set-deg-starts').value),
          degEnds: parseFloat(document.getElementById('set-deg-ends').value)
        });
        flash('Zmanim saved');
      }, true)
    )
  ));

  // 4. Mode
  form.appendChild(card('⚙️ Mode',
    field('Inverted Shabbos Mode (plug ON during Shabbos)', toggle('set-inverted', s.inverted)),
    field('Early Shabbos (accept Shabbos at Plag HaMincha)', toggle('set-early', s.earlyShabbos)),
    field('Eretz Yisrael (1-day Yom Tov)', toggle('set-ey', s.eretzYisrael)),
    field('Override Shabbos Mode (manual control)', toggle('set-override', s.override)),
    btn('Save Mode', async () => {
      await saveSettings({
        inverted: document.getElementById('set-inverted').checked,
        earlyShabbos: document.getElementById('set-early').checked,
        eretzYisrael: document.getElementById('set-ey').checked,
        override: document.getElementById('set-override').checked
      });
      flash('Mode saved');
    }, true)
  ));

  // 5. Local NTP (offline time sync)
  form.appendChild(card('🕒 Local NTP (Offline Time Sync)',
    el('p', {class:'hint'}, 'If your internet goes down, the plug can get time from your local router. Enter your router\'s IP (e.g., 192.168.1.1) and enable "Local NTP First".'),
    field('Use Local NTP First', toggle('set-ntp-first', s.localNtpFirst)),
    el('div', {class:'row ip-row'},
      input('number', 'set-ntp-1', s.ntp1),
      el('span', {}, '.'),
      input('number', 'set-ntp-2', s.ntp2),
      el('span', {}, '.'),
      input('number', 'set-ntp-3', s.ntp3),
      el('span', {}, '.'),
      input('number', 'set-ntp-4', s.ntp4)
    ),
    btn('Save NTP', async () => {
      await saveSettings({
        localNtpFirst: document.getElementById('set-ntp-first').checked,
        ntp1: parseInt(document.getElementById('set-ntp-1').value),
        ntp2: parseInt(document.getElementById('set-ntp-2').value),
        ntp3: parseInt(document.getElementById('set-ntp-3').value),
        ntp4: parseInt(document.getElementById('set-ntp-4').value)
      });
      flash('NTP settings saved');
    }, true)
  ));

  // 6. Status info
  if (s.checkTime) {
    form.appendChild(card('ℹ️ Current Status',
      el('div', {class:'info-box'}, 'Next melacha check time: ' + s.checkTime),
      el('div', {class:'info-box'}, 'Shabbos Mode: ' + (s.shabbosMode ? 'ACTIVE' : 'Inactive'))
    ));
  }

  root.appendChild(form);

  // Flash message container
  const flashEl = el('div', {id:'flash', class:'flash'});
  root.appendChild(flashEl);
}

function flash(msg) {
  const f = document.getElementById('flash');
  if (!f) return;
  f.textContent = msg;
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 2000);
}

// Inject CSS
const style = document.createElement('style');
style.textContent = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#333;padding:16px;max-width:600px;margin:0 auto}
.header{text-align:center;padding:20px 0}
.header h1{font-size:1.8em;color:#2c3e50}
.status{margin-top:8px}
.badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:0.85em;background:#e0e0e0;margin:2px}
.badge.ok{background:#c8e6c9;color:#2e7d32}
.badge.err{background:#ffcdd2;color:#c62828}
.loading{text-align:center;padding:40px;color:#888}
.wizard{display:flex;flex-direction:column;gap:16px}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.card h2{font-size:1.2em;color:#2c3e50;margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:8px}
.field{margin-bottom:12px}
.field label{display:block;font-size:0.9em;color:#666;margin-bottom:4px}
.input{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:1em}
.input:focus{outline:none;border-color:#3498db}
.info-box{background:#f8f9fa;padding:10px;border-radius:8px;font-size:0.9em;color:#555;margin-bottom:8px}
.hint{font-size:0.85em;color:#888;margin-bottom:12px;line-height:1.4}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ip-row input{width:50px;text-align:center}
.btn{padding:10px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:0.95em}
.btn:hover{background:#f0f0f0}
.btn.primary{background:#3498db;color:#fff;border-color:#3498db}
.btn.primary:hover{background:#2980b9}
.toggle{position:relative;display:inline-block;width:48px;height:26px;cursor:pointer}
.toggle input{opacity:0;width:0;height:0}
.slider{position:absolute;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:26px;transition:.3s}
.slider:before{content:"";position:absolute;height:20px;width:20px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
.toggle input:checked+.slider{background:#3498db}
.toggle input:checked+.slider:before{transform:translateX(22px)}
.flash{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:8px;opacity:0;transition:opacity 0.3s;pointer-events:none}
.flash.show{opacity:1}
@media(max-width:400px){.card{padding:16px}.ip-row input{width:40px}}
`;
document.head.appendChild(style);

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();