
// Simple PWA preview of GigPulse (no private APIs).
// Works offline after first load. Use Chrome > Add to Home screen to install.
// NOTE: Cannot read other apps' notifications in web. Use the "Simulate" buttons to mimic busyness.

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = {
  tab: 'Dashboard',
  center: { lat: 36.2077, lng: -119.3473 }, // Tulare
  hotspots: [
    { id: 1, name: 'Tulare Walmart', lat: 36.2077, lng: -119.3473, radius: 300, platform: 'DoorDash', busy: false, selected: true },
    { id: 2, name: 'Visalia Downtown', lat: 36.3302, lng: -119.2921, radius: 350, platform: 'UberEats', busy: false, selected: true },
  ],
  earnings: [],
  miles: 0,
  tracking: false,
  mpg: 24,
  fuel: 4.79,
  toastTimer: null
};

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

function setTab(tab) { state.tab = tab; render(); }

function formatMoney(n){ return '$' + (Math.round(n*100)/100).toFixed(2); }

function totals() {
  const totalE = state.earnings.reduce((s, e) => s + e.amount, 0);
  const gasCost = state.miles > 0 && state.mpg > 0 ? (state.miles / state.mpg) * state.fuel : 0;
  const net = totalE - gasCost;
  const dd = state.earnings.filter(e => e.platform === 'DoorDash').reduce((s, e) => s + e.amount, 0);
  const ue = state.earnings.filter(e => e.platform === 'UberEats').reduce((s, e) => s + e.amount, 0);
  return { totalE, gasCost, net, dd, ue };
}

let trackInterval = null;
function startTracking() {
  if (state.tracking) return;
  state.tracking = true;
  trackInterval = setInterval(() => {
    state.miles = +(state.miles + (Math.random()*0.08 + 0.02)).toFixed(3);
    const e = $('#milesVal'); if (e) e.textContent = state.miles.toFixed(2) + ' mi';
    const k = totals();
    const ne = $('#netVal'); if (ne) ne.textContent = formatMoney(k.net);
    const gc = $('#gasVal'); if (gc) gc.textContent = formatMoney(k.gasCost);
  }, 1000);
  render();
}
function stopTracking() {
  state.tracking = false;
  clearInterval(trackInterval);
  render();
}

function useMyLocation() {
  if (!navigator.geolocation) { showToast('Geolocation not available'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    state.center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    showToast('Centered on your location');
    render();
  }, () => showToast('Location blocked'));
}

function addHotspot(h) {
  const id = Date.now() + Math.random();
  state.hotspots.push({ id, name: h.name || 'New Hotspot', lat: h.lat, lng: h.lng, radius: h.radius || 300, platform: h.platform || 'DoorDash', busy: false, selected: true });
  render();
}

function triggerBusy(platform, busy) {
  state.hotspots = state.hotspots.map(h => h.platform === platform ? { ...h, busy } : h);
  const selected = state.hotspots.find(h => h.platform === platform && h.selected);
  if (busy && selected) showToast(`${platform}: Hotspot turned RED in ${selected.name}`);
  render();
}

function addEarning(platform, amount) {
  amount = Number(amount);
  if (amount > 0) state.earnings.push({ id: Date.now(), platform, amount, at: Date.now() });
  render();
}

function removeEarning(id) {
  state.earnings = state.earnings.filter(e => e.id !== id);
  render();
}

// Map box projection
function project(lat, lng, center, w, h) {
  const x = (lng - center.lng) * 10000;
  const y = (lat - center.lat) * -11000;
  return { x: w/2 + x, y: h/2 + y };
}
function unproject(x, y, center, w, h) {
  const dx = x - w/2, dy = y - h/2;
  const lng = center.lng + dx / 10000;
  const lat = center.lat - dy / 11000;
  return { lat, lng };
}

function mapBox() {
  const box = document.createElement('div');
  box.className = 'mapbox';
  const gl = document.createElement('div'); gl.className = 'gridlines'; box.appendChild(gl);
  const cd = document.createElement('div'); cd.className = 'centerdot'; box.appendChild(cd);

  function layoutPins() {
    box.querySelectorAll('.pinwrap').forEach(n => n.remove());
    const rect = box.getBoundingClientRect();
    state.hotspots.forEach(h => {
      const { x, y } = project(h.lat, h.lng, state.center, rect.width, rect.height);
      const wrap = document.createElement('div'); wrap.className = 'pinwrap'; wrap.style.position='absolute'; wrap.style.left=(x-6)+'px'; wrap.style.top=(y-6)+'px';
      const pin = document.createElement('div'); pin.className = 'pin' + (h.busy ? ' busy' : '');
      const label = document.createElement('div'); label.className = 'pinlabel'; label.textContent = h.name;
      wrap.appendChild(pin); wrap.appendChild(label); box.appendChild(wrap);
    });
  }

  const ro = new ResizeObserver(layoutPins);
  ro.observe(box);

  box.addEventListener('click', e => {
    const r = box.getBoundingClientRect();
    const { lat, lng } = unproject(e.clientX - r.left, e.clientY - r.top, state.center, r.width, r.height);
    addHotspot({ name: 'Custom Pin', lat, lng, platform: 'DoorDash', radius: 300 });
  });

  setTimeout(layoutPins, 0);
  return box;
}

function rowKV(label, value, bold=false){
  const r = document.createElement('div'); r.className='kv' + (bold ? ' bold' : '');
  const a=document.createElement('div'); a.textContent=label;
  const b=document.createElement('div'); b.textContent=value;
  r.appendChild(a); r.appendChild(b); return r;
}

function screenDashboard(){
  const k = totals();
  const wrap = document.createElement('div'); wrap.className='grid';
  const cards = document.createElement('div'); cards.className='grid cols-2';
  const c1 = document.createElement('div'); c1.className='card';
  c1.innerHTML = `<h3>Today Earnings</h3><div class="stat">${formatMoney(k.totalE)}</div><div class="row"><span class="badge">DD ${formatMoney(k.dd)}</span><span class="badge">UE ${formatMoney(k.ue)}</span></div>`;
  const c2 = document.createElement('div'); c2.className='card';
  c2.innerHTML = `<h3>Miles</h3><div id="milesVal" class="stat">${state.miles.toFixed(2)} mi</div><div class="badge">Cost est. <span id="gasVal">${formatMoney(k.gasCost)}</span></div>`;
  const c3 = document.createElement('div'); c3.className='card';
  c3.innerHTML = `<h3>Net (after gas)</h3><div id="netVal" class="stat">${formatMoney(k.net)}</div><div class="badge">${state.mpg} mpg • ${formatMoney(state.fuel)}/gal</div>`;
  cards.appendChild(c1); cards.appendChild(c2); cards.appendChild(c3);
  wrap.appendChild(cards);

  // map controls + map
  const ctl = document.createElement('div'); ctl.className='row';
  ctl.innerHTML = `<div class="badge">Live Map (tap to drop a hotspot)</div>`;
  const controls = document.createElement('div'); controls.className='controls';
  const btnLoc = document.createElement('button'); btnLoc.className='btn small'; btnLoc.textContent='Use my location'; btnLoc.onclick = useMyLocation;
  const btnTulare = document.createElement('button'); btnTulare.className='btn small alt'; btnTulare.textContent='Center: Tulare'; btnTulare.onclick = () => { state.center = { lat:36.2077, lng:-119.3473 }; render(); };
  controls.appendChild(btnLoc); controls.appendChild(btnTulare);
  ctl.appendChild(controls);
  wrap.appendChild(ctl);
  wrap.appendChild(mapBox());

  // simulate
  const sim = document.createElement('div'); sim.className='grid cols-2';
  const simA = document.createElement('div'); simA.className='card';
  simA.innerHTML = `<h3>Simulate Notifications</h3><div class="row"><span class="badge">TOS-safe preview</span></div>`;
  const btnsA = document.createElement('div'); btnsA.className='controls';
  [['DoorDash',true,'Very Busy'],['DoorDash',false,'Calm'],['UberEats',true,'Very Busy'],['UberEats',false,'Calm']].forEach(([p,b,label])=>{
    const bEl=document.createElement('button'); bEl.className='btn small ' + (b ? '' : 'alt'); bEl.textContent=`${p}: ${label}`; bEl.onclick=()=>triggerBusy(p,b); btnsA.appendChild(bEl);
  });
  simA.appendChild(btnsA);
  const simB = document.createElement('div'); simB.className='card';
  simB.innerHTML = `<h3>Quick Add Earning</h3>`;
  const ea = document.createElement('div'); ea.className='controls';
  const sel = document.createElement('select'); ['DoorDash','UberEats'].forEach(o=>{ const op=document.createElement('option'); op.textContent=o; sel.appendChild(op); })
  const amt = document.createElement('input'); amt.className='input'; amt.placeholder='$ Amount'; amt.inputMode='decimal';
  const add = document.createElement('button'); add.className='btn'; add.textContent='Add'; add.onclick=()=>{ if (Number(amt.value)>0){ addEarning(sel.value, amt.value); amt.value=''; } };
  ea.appendChild(sel); ea.appendChild(amt); ea.appendChild(add);
  simB.appendChild(ea);
  sim.appendChild(simA); sim.appendChild(simB);
  wrap.appendChild(sim);

  return wrap;
}

function screenHotspots(){
  const wrap = document.createElement('div'); wrap.className='grid';
  const form = document.createElement('div'); form.className='card';
  form.innerHTML = `<h3>Add Hotspot</h3>`;
  const controls = document.createElement('div'); controls.className='grid';
  const name = document.createElement('input'); name.className='input'; name.placeholder='Name';
  const plat = document.createElement('select'); ['DoorDash','UberEats'].forEach(o=>{ const op=document.createElement('option'); op.textContent=o; plat.appendChild(op); });
  const lat = document.createElement('input'); lat.className='input'; lat.placeholder='Latitude'; lat.inputMode='decimal'; lat.value = state.center.lat;
  const lng = document.createElement('input'); lng.className='input'; lng.placeholder='Longitude'; lng.inputMode='decimal'; lng.value = state.center.lng;
  const rad = document.createElement('input'); rad.className='input'; rad.placeholder='Radius (m)'; rad.inputMode='numeric'; rad.value = 300;
  const save = document.createElement('button'); save.className='btn'; save.textContent='Save'; save.onclick=()=>addHotspot({ name:name.value, platform:plat.value, lat:parseFloat(lat.value||0), lng:parseFloat(lng.value||0), radius:parseInt(rad.value||300,10) });
  controls.appendChild(name); controls.appendChild(plat); controls.appendChild(lat); controls.appendChild(lng); controls.appendChild(rad); controls.appendChild(save);
  form.appendChild(controls);

  const list = document.createElement('div'); list.className='card';
  list.innerHTML = `<h3>Your Hotspots</h3>`;
  const ul = document.createElement('div'); ul.className='list';
  state.hotspots.forEach(h => {
    const li = document.createElement('div'); li.className='listitem';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:600">${h.name}</div><div style="font-size:12px;color:var(--muted)">${h.platform} • ${h.lat.toFixed(4)}, ${h.lng.toFixed(4)} • ${h.radius}m</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='6px'; right.style.alignItems='center';
    const sel = document.createElement('input'); sel.type='checkbox'; sel.checked = !!h.selected; sel.onchange = (e)=>{ h.selected = e.target.checked; render(); };
    const badge = document.createElement('span'); badge.className = 'badge ' + (h.busy ? 'busy' : 'calm'); badge.textContent = h.busy ? 'BUSY' : 'CALM';
    const tog = document.createElement('button'); tog.className='btn small alt'; tog.textContent='Toggle'; tog.onclick=()=>{ h.busy = !h.busy; render(); };
    const del = document.createElement('button'); del.className='btn small alt'; del.textContent='Delete'; del.onclick=()=>{ state.hotspots = state.hotspots.filter(x=>x.id!==h.id); render(); };
    right.appendChild(document.createTextNode('Select')); right.appendChild(sel); right.appendChild(badge); right.appendChild(tog); right.appendChild(del);
    li.appendChild(left); li.appendChild(right);
    ul.appendChild(li);
  });
  list.appendChild(ul);

  const map = document.createElement('div'); map.className='card';
  map.innerHTML = `<h3>Map</h3>`;
  map.appendChild(mapBox());

  wrap.appendChild(form);
  wrap.appendChild(list);
  wrap.appendChild(map);
  return wrap;
}

function screenTrips(){
  const wrap = document.createElement('div'); wrap.className='grid cols-2';
  const a = document.createElement('div'); a.className='card';
  a.innerHTML = `<h3>Mileage Tracking</h3><div style="color:var(--muted);font-size:13px">Preview simulates miles increasing while tracking is ON.</div>`;
  const ctrls = document.createElement('div'); ctrls.className='controls';
  const btnStart = document.createElement('button'); btnStart.className='btn'; btnStart.textContent='Start'; btnStart.disabled = state.tracking; btnStart.onclick=startTracking;
  const btnStop = document.createElement('button'); btnStop.className='btn alt'; btnStop.textContent='Stop'; btnStop.onclick=stopTracking;
  const btnReset = document.createElement('button'); btnReset.className='btn alt'; btnReset.textContent='Reset Miles'; btnReset.onclick=()=>{ state.miles=0; render(); };
  ctrls.appendChild(btnStart); ctrls.appendChild(btnStop); ctrls.appendChild(btnReset);
  a.appendChild(ctrls);
  const milesVal = document.createElement('div'); milesVal.className='stat'; milesVal.id='milesVal'; milesVal.textContent=state.miles.toFixed(2)+' mi'; a.appendChild(milesVal);

  const b = document.createElement('div'); b.className='card';
  b.innerHTML = `<h3>Fuel Costs</h3>`;
  const g = document.createElement('div'); g.className='grid';
  const mpg = document.createElement('input'); mpg.className='input'; mpg.placeholder='MPG'; mpg.inputMode='decimal'; mpg.value = state.mpg; mpg.oninput = (e)=>{ state.mpg = parseFloat(e.target.value||0); render(); };
  const fuel = document.createElement('input'); fuel.className='input'; fuel.placeholder='$ per gallon'; fuel.inputMode='decimal'; fuel.value = state.fuel; fuel.oninput = (e)=>{ state.fuel = parseFloat(e.target.value||0); render(); };
  g.appendChild(mpg); g.appendChild(fuel);
  const k = totals();
  g.appendChild(rowKV('Gas Cost est.', formatMoney(k.gasCost)));
  g.appendChild(rowKV('Net (after gas)', formatMoney(k.net), true));
  b.appendChild(g);

  wrap.appendChild(a); wrap.appendChild(b);
  return wrap;
}

function screenEarnings(){
  const wrap = document.createElement('div'); wrap.className='grid cols-2';
  const a = document.createElement('div'); a.className='card';
  a.innerHTML = `<h3>Earnings</h3>`;
  const qa = document.createElement('div'); qa.className='controls';
  const sel = document.createElement('select'); ['DoorDash','UberEats'].forEach(o=>{ const op=document.createElement('option'); op.textContent=o; sel.appendChild(op); });
  const amt = document.createElement('input'); amt.className='input'; amt.placeholder='$ Amount'; amt.inputMode='decimal';
  const add = document.createElement('button'); add.className='btn'; add.textContent='Add'; add.onclick=()=>{ addEarning(sel.value, amt.value); amt.value=''; };
  qa.appendChild(sel); qa.appendChild(amt); qa.appendChild(add);
  a.appendChild(qa);
  const list = document.createElement('div'); list.className='list'; 
  if (state.earnings.length === 0){ const d=document.createElement('div'); d.style.color='var(--muted)'; d.textContent='No entries yet.'; list.appendChild(d); }
  state.earnings.forEach(e=>{
    const li = document.createElement('div'); li.className='listitem';
    const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:600">${formatMoney(e.amount)}</div><div style="font-size:12px;color:var(--muted)">${e.platform}</div>`;
    const del = document.createElement('button'); del.className='btn small alt'; del.textContent='Delete'; del.onclick=()=>removeEarning(e.id);
    li.appendChild(left); li.appendChild(del); list.appendChild(li);
  });
  a.appendChild(list);

  const b = document.createElement('div'); b.className='card';
  b.innerHTML = `<h3>Summary</h3>`;
  const k = totals(); 
  b.appendChild(rowKV('Total', formatMoney(k.totalE)));
  b.appendChild(rowKV('Gas Cost est.', formatMoney(k.gasCost)));
  b.appendChild(rowKV('Net', formatMoney(k.net), true));
  const split = document.createElement('div'); split.style.marginTop='8px'; split.style.fontSize='12px'; split.style.color='var(--muted)'; split.textContent = `Split: DD ${formatMoney(k.dd)} • UE ${formatMoney(k.ue)}`;
  b.appendChild(split);

  wrap.appendChild(a); wrap.appendChild(b);
  return wrap;
}

function screenSettings(){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `<h3>How this will work on Android</h3>
    <ul style="padding-left:16px; line-height:1.6; font-size:14px; color:var(--muted)">
      <li><b>Hotspot alerts:</b> A Notification Listener watches for “It’s busy / Dash Now / Peak Pay” phrases and toggles BUSY for selected hotspots.</li>
      <li><b>Miles:</b> Foreground location service accumulates distance.</li>
      <li><b>Gas & Net Profit:</b> You set MPG + $/gal → app computes net.</li>
      <li><b>Texts:</b> Optional device SMS or a cloud webhook (Twilio) to ping when selected hotspots turn RED.</li>
      <li><b>Data:</b> Local storage; CSV export in a later build.</li>
    </ul>`;
  return wrap;
}

function tabs(){
  const labels = ['Dashboard','Hotspots','Trips','Earnings','Settings'];
  const bar = $('#tabs'); bar.innerHTML='';
  labels.forEach(l => {
    const b = document.createElement('button'); b.className = 'tab' + (state.tab===l ? ' active' : ''); b.textContent = l; b.onclick=()=>setTab(l);
    bar.appendChild(b);
  });
}

function render(){
  tabs();
  const main = $('#screen');
  main.innerHTML = '';
  let node;
  if (state.tab === 'Dashboard') node = screenDashboard();
  else if (state.tab === 'Hotspots') node = screenHotspots();
  else if (state.tab === 'Trips') node = screenTrips();
  else if (state.tab === 'Earnings') node = screenEarnings();
  else node = screenSettings();
  main.appendChild(node);
}

render();
