const EVENTS = [
  {
    id: 'mumbai-flood',
    title: 'Mumbai monsoon flooding',
    place: 'Mumbai',
    severity: 'high',
    lat: 19.076,
    lng: 72.8777,
    summary: 'Heavy rainfall and waterlogging near BKC and Lower Parel.',
  },
  {
    id: 'thane-fire',
    title: 'Warehouse fire — Thane',
    place: 'Thane',
    severity: 'medium',
    lat: 19.2183,
    lng: 72.9781,
    summary: 'Industrial unit blaze; smoke plume visible on satellite pass.',
  },
  {
    id: 'delhi-haze',
    title: 'Delhi air quality alert',
    place: 'New Delhi',
    severity: 'low',
    lat: 28.6139,
    lng: 77.209,
    summary: 'AQI in severe band; visibility reduced across NCR.',
  },
]

const ALERT_CELLS = [
  { label: 'All', value: 6 },
  { label: 'Near assets', value: 3 },
  { label: 'Upcoming', value: 1 },
  { label: 'High', value: 2 },
  { label: 'Medium', value: 2 },
  { label: 'Low', value: 2 },
]

function fmtLat(lat) {
  const hemi = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(4)}°${hemi}`
}

function fmtLng(lng) {
  const hemi = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(4)}°${hemi}`
}

function fmtPair(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function renderAlerts() {
  const host = document.getElementById('alert-cells')
  host.innerHTML = ALERT_CELLS
    .map(
      (c, i) => `
      <button type="button" class="alerts-cell${i === 0 ? ' active' : ''}">
        <em>${c.value}</em><span>${c.label}</span>
      </button>`,
    )
    .join('')
}

function renderCards(selectedId) {
  const host = document.getElementById('event-cards')
  host.innerHTML = EVENTS
    .map(
      (ev) => `
      <button type="button" class="card${selectedId === ev.id ? ' selected' : ''}" data-id="${ev.id}">
        <div class="card-kicker">
          <span class="chip ok">live</span>
          <span class="chip ${ev.severity}">${ev.severity}</span>
        </div>
        <h3>${ev.title}</h3>
        <p>${ev.summary}</p>
      </button>`,
    )
    .join('')

  host.querySelectorAll('.card').forEach((btn) => {
    btn.addEventListener('click', () => selectEvent(btn.dataset.id))
  })
}

function selectEvent(id) {
  const ev = EVENTS.find((e) => e.id === id)
  if (!ev) return

  document.getElementById('coords-panel').innerHTML = `
    <span class="topbar-coords-label">${ev.place}</span>
    <span class="topbar-coords-val"><em>Lat</em> ${fmtLat(ev.lat)}</span>
    <span class="topbar-coords-val"><em>Long</em> ${fmtLng(ev.lng)}</span>`

  document.getElementById('coord-strip').innerHTML = `
    <div class="coord-strip-head">
      <span class="coord-strip-tag">Event</span>
      <span class="coord-strip-name">${ev.title}</span>
    </div>
    <div class="coord-strip-geo">
      <div class="coord-strip-cell"><span>Latitude</span><strong>${fmtLat(ev.lat)}</strong></div>
      <div class="coord-strip-cell"><span>Longitude</span><strong>${fmtLng(ev.lng)}</strong></div>
      <div class="coord-strip-cell"><span>Coordinates</span><strong>${fmtPair(ev.lat, ev.lng)}</strong></div>
    </div>`

  document.getElementById('risk-row').innerHTML = `
    <span class="risk-row-tag">Risk score</span>
    <div class="risk-score-main"><strong>${ev.severity === 'high' ? '2.41' : ev.severity === 'medium' ? '1.62' : '0.88'}</strong><span>of 3</span></div>
    <div class="risk-factors">
      <span class="risk-chip impact-${ev.severity}">${ev.severity} impact</span>
      <span class="risk-chip">${ev.place}</span>
    </div>`

  renderCards(id)
}

function tickClock() {
  const now = new Date()
  const local = now.toLocaleTimeString('en-GB', { hour12: false })
  const utc = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
  document.getElementById('clock').textContent = local
  document.getElementById('feed-clock').textContent = local
  document.getElementById('utc-clock').textContent = `${utc} UTC`
}

document.querySelectorAll('.view-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-toggle button').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    const globe = btn.dataset.view === 'globe'
    document.getElementById('view-badge').textContent = globe ? 'Globe view' : 'Map view'
    document.querySelector('.map-wrap').classList.toggle('is-satellite', globe)
    document.querySelector('.map-wrap').classList.toggle('is-imagery', !globe)
  })
})

renderAlerts()
renderCards(EVENTS[0].id)
selectEvent(EVENTS[0].id)
tickClock()
setInterval(tickClock, 1000)
