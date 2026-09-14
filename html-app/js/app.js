import { ASSETS, DEMO, EVENTS, GLOBE_ASSETS, INDIA_ASSETS, INCOMING } from './data.js'
import { DESK_BEATS } from './sequence.js'
import { enrich, clock, searchHay } from './scoring.js'
import { fmtLat, fmtLng, fmtPair } from './coords.js'
import { VIEW_LABELS, TIME_WINDOW_LABELS, FOCUS_TYPE_LABELS } from './labels.js'
import { eventMarkerHtml } from './markers.js'
import { createGlobe } from './globe.js'
import { DeskMap } from './map.js'
import {
  ALERT_STATUS,
  buildQueues,
  drawerHtml,
  ensureAlertMeta,
  inboxRowHtml,
  markAlertRead,
  markAlertUnread,
  newActCount,
  setAlertStatus,
} from './alerts.js'

const ALERT_FILTERS = {
  total: 'total',
  nearSites: 'nearSites',
  upcoming: 'upcoming',
  crucial: 'crucial',
  warning: 'warning',
  notification: 'notification',
  informative: 'informative',
  intelligence: 'intelligence',
}

const TWO_DAYS_MS = 2 * 86400 * 1000
const isForecastEvent = (e) => Boolean(e.forecast) || e.eventAt > Date.now()
const inNextTwoDays = (e) => {
  const at = e.eventAt || e.publishedAt
  return at > Date.now() && at <= Date.now() + TWO_DAYS_MS
}

const state = {
  raw: [...EVENTS],
  timeMode: 'live',
  workspace: 'monitor',
  monitorWindow: 'live',
  presentation: 'map',
  q: '',
  cats: { geopolitical: true, environmental: true, security: true },
  sevs: { high: true, medium: true, low: true },
  selectedId: null,
  selectedAssetId: null,
  boot: true,
  stripFilter: null,
  mapMode: 'globe',
  scene: { pulse: false, flood: false, warehouse: false, distance: false },
  log: ['Desk ready · waiting for events'],
  freshId: null,
  toast: null,
  latencyMs: 86,
  incomingIdx: 0,
  alertsOpen: false,
  alertChannel: 'act',
  alertCaseId: null,
  alertMeta: {},
  prevMapMode: 'globe',
}

let globe = null
let deskMap = null
let cueTimers = []
let forceGlobeFly = false
let lastGlobeFlyKey = ''

const $ = (sel) => document.querySelector(sel)

function enriched() {
  return enrich(state.raw, ASSETS)
}

function derive() {
  const pool = enriched()
  const timed = pool.filter((e) => {
    if (state.timeMode === 'forecast') return isForecastEvent(e) && inNextTwoDays(e)
    if (state.timeMode === 'history') return !isForecastEvent(e)
    return !isForecastEvent(e)
  })
  const needle = state.q.trim().toLowerCase()
  const listed = timed.filter((e) => {
    if (e.flag !== 'IN') return false
    if (!state.cats[e.category] || !state.sevs[e.severity]) return false
    if (needle && !searchHay(e).includes(needle)) return false
    return true
  })
  const filtered = listed.filter((e) => {
    if (!state.stripFilter) return true
    switch (state.stripFilter) {
      case ALERT_FILTERS.total:
        return state.timeMode === 'forecast' ? isForecastEvent(e) : !isForecastEvent(e)
      case ALERT_FILTERS.nearSites:
        return e.linked
      case ALERT_FILTERS.upcoming:
        return isForecastEvent(e) && inNextTwoDays(e)
      case ALERT_FILTERS.crucial:
        return e.severity === 'high'
      case ALERT_FILTERS.warning:
        return e.severity === 'medium'
      case ALERT_FILTERS.notification:
        return e.severity === 'low'
      case ALERT_FILTERS.informative:
        return e.category === 'environmental'
      case ALERT_FILTERS.intelligence:
        return e.category === 'security' || e.category === 'geopolitical'
      default:
        return true
    }
  })
  const indiaPool = pool.filter((e) => e.flag === 'IN' && state.cats[e.category] && state.sevs[e.severity])
  const selectedEvent = pool.find((e) => e.id === state.selectedId)
  const selectedAsset = state.selectedAssetId ? ASSETS.find((a) => a.id === state.selectedAssetId) : null
  const selected =
    state.selectedId != null ? { type: 'event', id: state.selectedId } : state.selectedAssetId ? { type: 'asset', id: state.selectedAssetId } : null
  const showRadiusFor = state.scene.warehouse ? DEMO.assetId : selectedEvent?.linked ? selectedEvent.primary.asset.id : state.selectedAssetId
  const focusPoint = selectedEvent?.coords
    ? { lat: selectedEvent.coords[1], lng: selectedEvent.coords[0], label: selectedEvent.place?.split(',')[0] || selectedEvent.title, type: 'event' }
    : selectedAsset?.coords
      ? { lat: selectedAsset.coords[1], lng: selectedAsset.coords[0], label: selectedAsset.name, type: 'asset' }
      : null
  return { pool, filtered, indiaPool, selectedEvent, selectedAsset, selected, showRadiusFor, focusPoint }
}

function pickEvent(id, opts = {}) {
  state.selectedId = id
  state.selectedAssetId = null
  if (opts.map) state.mapMode = 'map'
  render()
}

function pickAsset(id, opts = {}) {
  state.selectedAssetId = id
  state.selectedId = null
  if (opts.map) state.mapMode = 'map'
  render()
}

function clearSelection() {
  state.selectedId = null
  state.selectedAssetId = null
  state.scene.pulse = false
  state.scene.warehouse = false
  render()
}

function renderChrome(d) {
  const coords = $('#topbar-coords')
  if (coords) {
    if (d.focusPoint) {
      coords.innerHTML = `<span class="topbar-coords-label">${d.focusPoint.label}</span><span class="topbar-coords-val"><em>Lat</em> ${fmtLat(d.focusPoint.lat)}</span><span class="topbar-coords-val"><em>Long</em> ${fmtLng(d.focusPoint.lng)}</span>`
    } else {
      coords.innerHTML = `<span class="topbar-coords-hint">Select an event or site to see coordinates</span>`
    }
  }
  if ($('#ops-clock')) $('#ops-clock').textContent = clock(Date.now())

  document.querySelectorAll('.nav-tabs button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-tabs button').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      if (btn.dataset.nav === 'critical' && state.alertsOpen) closeAlerts()
    }
  })
  document.querySelectorAll('.mode-cluster button[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.timeMode)
  })
  document.querySelectorAll('.view-cluster button[data-present]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.present === state.presentation)
  })
  if ($('#view-badge')) $('#view-badge').textContent = VIEW_LABELS[state.mapMode] || VIEW_LABELS.globe

  const stats = {
    total: state.timeMode === 'forecast' ? d.indiaPool.filter((e) => isForecastEvent(e) && inNextTwoDays(e)).length : d.indiaPool.filter((e) => !isForecastEvent(e)).length,
    nearSites: d.indiaPool.filter((e) => e.linked).length,
    upcoming: d.indiaPool.filter((e) => isForecastEvent(e) && inNextTwoDays(e)).length,
    crucial: d.indiaPool.filter((e) => e.severity === 'high').length,
    warning: d.indiaPool.filter((e) => e.severity === 'medium').length,
    notification: d.indiaPool.filter((e) => e.severity === 'low').length,
    informative: d.indiaPool.filter((e) => e.category === 'environmental').length,
    intelligence: d.indiaPool.filter((e) => e.category === 'security' || e.category === 'geopolitical').length,
  }
  const cell = (key, label, n, extra = '') =>
    `<button type="button" class="alerts-cell ${extra} ${state.stripFilter === ALERT_FILTERS[key] ? 'active' : ''}" data-filter="${key}"><em>${n}</em><span>${label}</span></button>`
  $('#alert-strip-window').textContent = TIME_WINDOW_LABELS[state.timeMode]
  $('#alert-cells').innerHTML = `<div class="alerts-group">${cell('total', 'All', stats.total)}${cell('nearSites', 'Near assets', stats.nearSites)}${cell('upcoming', 'Upcoming', stats.upcoming)}</div><div class="alerts-divider"></div><div class="alerts-group">${cell('crucial', 'High', stats.crucial, 'sev-crucial')}${cell('warning', 'Medium', stats.warning, 'sev-warning')}${cell('notification', 'Low', stats.notification, 'sev-notification')}</div><div class="alerts-divider"></div><div class="alerts-group">${cell('informative', 'Weather', stats.informative)}${cell('intelligence', 'Security', stats.intelligence)}</div>`
  $('#alert-cells').querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      const k = ALERT_FILTERS[btn.dataset.filter]
      state.stripFilter = state.stripFilter === k ? null : k
      render()
    }
  })

  const coordStrip = $('#coord-strip')
  if (coordStrip) {
    if (d.focusPoint) {
      coordStrip.innerHTML = `<div class="coord-strip-head"><span class="coord-strip-tag">${FOCUS_TYPE_LABELS[d.focusPoint.type]}</span><span class="coord-strip-name">${d.focusPoint.label}</span></div><div class="coord-strip-geo"><div class="coord-strip-cell"><span>Latitude</span><strong>${fmtLat(d.focusPoint.lat)}</strong></div><div class="coord-strip-cell"><span>Longitude</span><strong>${fmtLng(d.focusPoint.lng)}</strong></div><div class="coord-strip-cell dd"><span>Coordinates</span><strong>${fmtPair(d.focusPoint.lat, d.focusPoint.lng)}</strong></div></div>`
    } else {
      coordStrip.innerHTML = `<span class="coord-strip-empty">Select an event or site to view coordinates</span>`
    }
  }

  const risk = $('#risk-row')
  if (d.selectedEvent) {
    const raw = d.selectedEvent.raw ?? 0
    const pct = Math.min(100, (raw / 3) * 100)
    const asset = d.selectedEvent.primary?.asset
    risk.className = 'risk-row'
    risk.innerHTML = `<span class="risk-row-tag">Risk score</span><div class="risk-score-main"><strong>${raw.toFixed(2)}</strong><span>of 3</span></div><div class="risk-bar"><i style="width:${pct}%"></i></div><div class="risk-factors"><span class="risk-chip impact-${d.selectedEvent.impact || 'low'}">${{ high: 'High impact', medium: 'Medium impact', low: 'Low impact' }[d.selectedEvent.impact] || 'Low impact'}</span>${asset ? `<span class="risk-chip">${d.selectedEvent.primary.km.toFixed(1)} km · ${asset.name}</span>` : ''}${d.selectedEvent.alert ? '<span class="risk-chip alert">Needs attention</span>' : ''}</div>`
  } else {
    const linked = d.indiaPool.filter((e) => e.linked)
    const maxRaw = linked.reduce((m, e) => Math.max(m, e.raw || 0), 0)
    const hot = linked.filter((e) => e.alert).length
    risk.className = 'risk-row desk'
    risk.innerHTML = `<span class="risk-row-tag">Overview</span><div class="risk-score-main"><strong>${maxRaw.toFixed(2)}</strong><span>peak score</span></div><div class="risk-factors"><span class="risk-chip">${linked.length} near assets</span><span class="risk-chip alert">${hot} flagged</span><span class="risk-chip">${d.indiaPool.length} active</span></div>`
  }
}

function renderRail(d) {
  const utc = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
  $('#utc-clock').textContent = `${utc} UTC`
  $('#filtered-count').textContent = d.filtered.length
  $('#count-live').textContent = d.pool.filter((e) => e.flag === 'IN' && !isForecastEvent(e) && state.cats[e.category] && state.sevs[e.severity]).length
  $('#count-forecast').textContent = d.pool.filter((e) => e.flag === 'IN' && isForecastEvent(e) && inNextTwoDays(e) && state.cats[e.category] && state.sevs[e.severity]).length
  $('#latency').textContent = `${state.latencyMs} ms`
  $('#wire-log').innerHTML = state.log.map((line) => `<li>${line}</li>`).join('')
  const mix = {
    geopolitical: d.pool.filter((e) => e.flag === 'IN' && e.category === 'geopolitical').length,
    environmental: d.pool.filter((e) => e.flag === 'IN' && e.category === 'environmental').length,
    security: d.pool.filter((e) => e.flag === 'IN' && e.category === 'security').length,
  }
  const mixTotal = Math.max(1, mix.geopolitical + mix.environmental + mix.security)
  $('#mix-bar').innerHTML = `<i class="geo" style="width:${(mix.geopolitical / mixTotal) * 100}%"></i><i class="env" style="width:${(mix.environmental / mixTotal) * 100}%"></i><i class="sec" style="width:${(mix.security / mixTotal) * 100}%"></i>`
  $('#mix-keys').innerHTML = `<span>civil ${mix.geopolitical}</span><span>weather ${mix.environmental}</span><span>security ${mix.security}</span>`
  document.querySelectorAll('.fchip[data-cat]').forEach((btn) => {
    btn.classList.toggle('on', state.cats[btn.dataset.cat])
    btn.onclick = () => {
      state.cats[btn.dataset.cat] = !state.cats[btn.dataset.cat]
      render()
    }
  })
  document.querySelectorAll('.fchip[data-sev]').forEach((btn) => {
    btn.classList.toggle('on', state.sevs[btn.dataset.sev])
    btn.onclick = () => {
      state.sevs[btn.dataset.sev] = !state.sevs[btn.dataset.sev]
      render()
    }
  })
}

function alertEvents(d) {
  const needle = state.q.trim().toLowerCase()
  return d.pool.filter((e) => {
    if (e.flag !== 'IN' || !e.linked) return false
    if (needle && !searchHay(e).includes(needle)) return false
    return true
  })
}

function syncAlertMeta(d) {
  state.alertMeta = ensureAlertMeta(alertEvents(d), state.alertMeta)
}

function openAlerts() {
  if (!state.alertsOpen) state.prevMapMode = state.mapMode
  state.alertsOpen = true
  state.alertChannel = state.alertChannel || 'act'
  state.mapMode = 'map'
  render()
  deskMap?.boot()
  requestAnimationFrame(() => deskMap?.resize())
}

function closeAlerts() {
  state.alertsOpen = false
  state.alertCaseId = null
  state.mapMode = state.prevMapMode || 'globe'
  render()
}

function toggleAlerts() {
  if (state.alertsOpen) closeAlerts()
  else openAlerts()
}

function openAlertCase(id) {
  state.alertCaseId = id
  state.alertMeta = markAlertRead(state.alertMeta, id)
  forceGlobeFly = true
  pickEvent(id)
}

function applyAlertAction(action) {
  if (!state.alertCaseId) return
  const allowed = new Set(Object.values(ALERT_STATUS))
  if (!allowed.has(action)) return
  const id = state.alertCaseId
  state.alertMeta = setAlertStatus(state.alertMeta, id, action)
  const event = enrich(state.raw, ASSETS).find((e) => e.id === id)
  if (action === ALERT_STATUS.resolved || action === ALERT_STATUS.dismissed || action === ALERT_STATUS.snoozed) {
    state.alertChannel = 'closed'
  } else if (event?.alert) {
    state.alertChannel = 'act'
  }
  render()
}

function renderAlerts(d) {
  syncAlertMeta(d)
  const queues = buildQueues(alertEvents(d), state.alertMeta)
  const badgeN = newActCount(queues)
  const badge = $('#alert-badge')
  if (badgeN > 0) {
    badge.hidden = false
    badge.textContent = String(badgeN)
  } else {
    badge.hidden = true
  }

  const app = document.querySelector('.layout-mission')
  app.classList.toggle('alerts-open', state.alertsOpen)
  app.classList.toggle('alerts-case', Boolean(state.alertsOpen && state.alertCaseId))

  $('#rail-filters').classList.toggle('active', !state.alertsOpen)
  $('#rail-filters').setAttribute('aria-pressed', String(!state.alertsOpen))
  $('#rail-alerts').classList.toggle('active', state.alertsOpen)
  $('#rail-alerts').setAttribute('aria-pressed', String(state.alertsOpen))

  const inbox = $('#alerts-inbox')
  inbox.hidden = !state.alertsOpen
  const drawer = $('#alert-drawer')
  drawer.hidden = !(state.alertsOpen && state.alertCaseId)

  if (!state.alertsOpen) return

  $('#ch-act').textContent = queues.act.length
  $('#ch-watch').textContent = queues.watch.length
  $('#ch-closed').textContent = queues.closed.length
  $('#alert-inbox-meta').textContent = `${badgeN} active`
  document.querySelectorAll('.alert-channels button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.channel === state.alertChannel)
    btn.onclick = () => {
      state.alertChannel = btn.dataset.channel
      render()
    }
  })

  const rows = queues[state.alertChannel] || []
  const list = $('#alert-inbox-list')
  if (!rows.length) {
    const empty =
      state.alertChannel === 'act'
        ? 'No active targets in the tasking queue.'
        : state.alertChannel === 'watch'
          ? 'No hold tracks near registered assets.'
          : 'No closed tasking.'
    list.innerHTML = `<div class="alert-inbox-empty">${empty}</div>`
  } else {
    list.innerHTML = rows.map((row) => inboxRowHtml(row, state.alertCaseId)).join('')
    list.querySelectorAll('.alert-row').forEach((btn) => {
      btn.onclick = () => openAlertCase(btn.dataset.id)
    })
  }

  if (state.alertCaseId) {
    const event = d.pool.find((e) => e.id === state.alertCaseId)
    if (!event?.linked) {
      state.alertCaseId = null
      drawer.hidden = true
      app.classList.remove('alerts-case')
      return
    }
    const meta = state.alertMeta[event.id]
    drawer.innerHTML = drawerHtml(event, meta)
    drawer.querySelector('[data-alert-close]')?.addEventListener('click', () => {
      state.alertCaseId = null
      render()
    })
    drawer.querySelectorAll('[data-alert-action]').forEach((btn) => {
      btn.addEventListener('click', () => applyAlertAction(btn.dataset.alertAction))
    })
    drawer.querySelector('[data-alert-asset]')?.addEventListener('click', () => {
      forceGlobeFly = true
      pickAsset(drawer.querySelector('[data-alert-asset]').dataset.alertAsset)
    })
  }
}

function renderFeed(d) {
  const n = state.timeMode === 'forecast'
    ? d.pool.filter((e) => e.flag === 'IN' && isForecastEvent(e) && inNextTwoDays(e) && state.cats[e.category] && state.sevs[e.severity]).length
    : d.pool.filter((e) => e.flag === 'IN' && !isForecastEvent(e) && state.cats[e.category] && state.sevs[e.severity]).length
  $('#feed-count').textContent = n
  $('#feed-mode').textContent = state.timeMode === 'forecast' ? 'Forecast · 2 days' : 'Live feed'
  $('#feed-clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false })

  if (!d.filtered.length) {
    $('#event-cards').innerHTML = `<div class="empty">${state.q ? `No match for “${state.q}”.` : state.timeMode === 'forecast' ? 'No forecast events in the next 2 days.' : 'No live events on the desk right now.'}</div>`
    return
  }
  $('#event-cards').innerHTML = d.filtered
    .map((ev, i) => {
      const forecast = isForecastEvent(ev)
      const when = clock(ev.eventAt || ev.publishedAt)
      const assetName = ev.primary?.asset?.name
      return `<button type="button" class="card kind-${ev.kind} ${state.selectedId === ev.id ? 'selected' : ''} ${state.freshId === ev.id ? 'fresh' : ''}" data-id="${ev.id}" style="animation-delay:${Math.min(i, 8) * 40}ms"><span class="card-mark">${eventMarkerHtml(ev)}</span><span class="card-body"><div class="card-kicker"><span class="chip ${forecast ? 'forecast' : 'ok'}">${forecast ? 'forecast' : 'live'}</span><span class="chip ${ev.severity}">${ev.severity}</span><span class="ago">${when}</span></div><h3>${ev.title}</h3><p class="why">${ev.summary || ev.why || ''}</p>${assetName ? `<p class="asset-hit">Asset affected · ${assetName}</p>` : ''}<p class="card-date">${when}</p></span></button>`
    })
    .join('')
  $('#event-cards').querySelectorAll('.card').forEach((btn) => {
    btn.onclick = () => {
      forceGlobeFly = true
      pickEvent(btn.dataset.id)
    }
  })
}

function renderMaps(d) {
  const wrap = $('#map-wrap')
  wrap.className = `map-wrap ${state.mapMode === 'map' ? 'is-imagery sat-live' : 'is-satellite'}`
  const app = document.querySelector('.layout-mission')
  app.classList.toggle('is-sat', state.mapMode === 'map')
  $('#globe-stage').className = `globe-stage ${state.mapMode === 'globe' ? 'on' : 'off'}`
  $('#map-stage').className = `map-stage ${state.mapMode === 'map' ? 'on' : 'off'}`
  $('#btn-globe').classList.toggle('active', state.mapMode === 'globe')
  $('#btn-map').classList.toggle('active', state.mapMode === 'map')
  $('#globe-tools').hidden = state.mapMode !== 'globe'

  const satHud = $('#sat-hud')
  if (satHud) {
    satHud.hidden = state.mapMode !== 'map'
    const read = $('#sat-readout')
    if (state.mapMode === 'map' && read) {
      read.textContent = d.focusPoint
        ? `TGT ${d.focusPoint.label} · ${fmtLat(d.focusPoint.lat)} ${fmtLng(d.focusPoint.lng)} · EO`
        : 'SATCOM · WORLD IMAGERY · NO TGT'
    }
  }

  const pulseEventId = state.scene.pulse ? DEMO.eventId : null
  const highlightAssetId = state.scene.warehouse ? DEMO.assetId : null
  const globeEvents = state.alertsOpen
    ? d.pool.filter((e) => e.flag === 'IN' && e.linked)
    : d.filtered

  const mapEvents = state.alertsOpen
    ? d.pool.filter((e) => e.flag === 'IN' && e.linked)
    : d.filtered

  globe?.setPaused(state.mapMode !== 'globe')
  globe?.setData({ events: globeEvents, assets: GLOBE_ASSETS, showRadiusFor: d.showRadiusFor, pulseEventId, highlightAssetId })
  if (state.mapMode === 'globe') {
    globe?.resize()
    const flyKey = d.selected ? `${d.selected.type}:${d.selected.id}` : pulseEventId ? `pulse:${pulseEventId}` : ''
    if (forceGlobeFly) {
      forceGlobeFly = false
      lastGlobeFlyKey = flyKey
      if (pulseEventId && !d.selected) {
        const ev = d.filtered.find((e) => e.id === pulseEventId)
        if (ev?.coords) globe.flyTo(ev.coords[1], ev.coords[0], true)
      } else if (d.selected) {
        const target =
          d.selected.type === 'event'
            ? d.pool.find((e) => e.id === d.selected.id)
            : GLOBE_ASSETS.find((a) => a.id === d.selected.id)
        if (target?.coords) globe.flyTo(target.coords[1], target.coords[0], true)
      }
    } else if (flyKey) {
      lastGlobeFlyKey = flyKey
    }
    const pov = globe?.pointOfView()
    if (pov) {
      const tel = $('#globe-telemetry')
      if (d.focusPoint) {
        tel.innerHTML = `<span>Camera</span><b class="telemetry-target">${d.focusPoint.label}</b><span class="telemetry-sub">${fmtLat(pov.lat)} ${fmtLng(pov.lng)} · alt ${pov.alt.toFixed(1)}</span><i></i>`
      } else {
        tel.innerHTML = `<span>Camera</span><b>${fmtLat(pov.lat)} ${fmtLng(pov.lng)}</b><span>Alt ${pov.alt.toFixed(1)} · select a pin for details</span><i></i>`
      }
    }
  }

  deskMap?.setActive(state.mapMode === 'map')
  deskMap?.update({
    events: mapEvents,
    assets: INDIA_ASSETS,
    selected: d.selected,
    showRadiusFor: d.showRadiusFor,
    scene: state.scene,
    highlightAssetId,
    timeMode: state.timeMode,
    focusPoint: d.focusPoint,
    tactical: state.mapMode === 'map',
    caseOpen: Boolean(state.alertsOpen && state.alertCaseId),
  })

  const toast = $('#wire-toast')
  if (state.toast) {
    toast.hidden = false
    toast.classList.toggle('alert-toast', Boolean(state.toast.alert))
    toast.innerHTML = `<span>${state.toast.alert ? 'TGT' : 'New'}</span><b>${state.toast.title}</b><em>${state.toast.place}</em>`
  } else toast.hidden = true

  document.querySelectorAll('.time-dock button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.timeMode)
    btn.onclick = () => {
      state.timeMode = btn.dataset.mode
      render()
    }
  })
  $('#time-head').className = `head ${state.timeMode}`
}

function render() {
  const d = derive()
  if (!state.selectedId && !state.selectedAssetId) {
    const first = d.filtered.find((e) => e.linked) || d.filtered[0]
    if (first) state.selectedId = first.id
  }
  const d2 = derive()
  renderChrome(d2)
  renderRail(d2)
  renderFeed(d2)
  renderAlerts(d2)
  renderMaps(d2)
}

function runDesk() {
  cueTimers.forEach(clearTimeout)
  cueTimers = []
  state.timeMode = 'live'
  state.selectedId = null
  state.selectedAssetId = null
  state.q = ''
  state.cats = { geopolitical: true, environmental: true, security: true }
  state.sevs = { high: true, medium: true, low: true }
  state.mapMode = 'globe'
  state.scene = { pulse: false, flood: false, warehouse: false, distance: false }
  DESK_BEATS.forEach((beat) => {
    cueTimers.push(
      setTimeout(() => {
        if (beat.mapMode) state.mapMode = beat.mapMode
        state.scene = {
          pulse: beat.pulse ?? state.scene.pulse,
          flood: beat.flood ?? state.scene.flood,
          warehouse: beat.warehouse ?? state.scene.warehouse,
          distance: beat.distance ?? state.scene.distance,
        }
        if (beat.select) pickEvent(DEMO.eventId, { map: beat.mapMode === 'map' })
        if (beat.brief) pickEvent(DEMO.eventId, { map: true })
        render()
      }, beat.at),
    )
  })
  render()
}

export function initApp() {
  setTimeout(() => {
    state.boot = false
    $('#boot').hidden = true
  }, 1800)

  globe = createGlobe($('#globe-stage'), (sel) => {
    if (!sel) {
      clearSelection()
      globe?.zoomOut()
      return
    }
    forceGlobeFly = true
    if (sel.type === 'event') {
      const event = enrich(state.raw, ASSETS).find((e) => e.id === sel.id)
      if (state.alertsOpen && event?.linked) openAlertCase(sel.id)
      else pickEvent(sel.id)
    }
    if (sel.type === 'asset') pickAsset(sel.id)
  })
  new ResizeObserver(() => globe?.resize()).observe($('#globe-stage'))
  setInterval(() => {
    if (state.mapMode === 'globe') renderMaps(derive())
  }, 240)

  deskMap = new DeskMap($('#terrain-canvas'), $('#desk-hud'), (sel) => {
    if (!sel) {
      clearSelection()
      return
    }
    if (sel.type === 'event') pickEvent(sel.id, { map: true })
    if (sel.type === 'asset') pickAsset(sel.id, { map: true })
  })
  new ResizeObserver(() => deskMap?.resize()).observe($('#terrain-canvas'))

  $('#search').addEventListener('input', (e) => {
    state.q = e.target.value
    render()
  })
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const d = derive()
      if (d.filtered[0]) pickEvent(d.filtered[0].id)
    }
  })
  if ($('#btn-demo')) $('#btn-demo').onclick = runDesk
  $('#btn-replay').onclick = runDesk
  $('#rail-filters').onclick = () => {
    if (state.alertsOpen) closeAlerts()
  }
  $('#rail-alerts').onclick = toggleAlerts
  $('#btn-globe').onclick = () => {
    state.mapMode = 'globe'
    render()
  }
  $('#btn-map').onclick = () => {
    state.mapMode = 'map'
    render()
    deskMap.boot()
    requestAnimationFrame(() => deskMap?.resize())
  }
  document.querySelectorAll('.mode-cluster button[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.timeMode = btn.dataset.mode
      if (btn.dataset.mode === 'live') state.monitorWindow = 'live'
      if (btn.dataset.mode === 'forecast') state.monitorWindow = 'upcoming'
      if (btn.dataset.mode === 'history') state.monitorWindow = 'history'
      render()
    })
  })
  document.querySelectorAll('.view-cluster button[data-present]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.presentation = btn.dataset.present
      if (btn.dataset.present === 'map') {
        state.mapMode = 'map'
        render()
        deskMap.boot()
        requestAnimationFrame(() => deskMap?.resize())
        return
      }
      render()
    })
  })

  $('#btn-zoom-globe').onclick = () => {
    clearSelection()
    globe?.zoomOut()
  }
  $('#btn-zoom-map').onclick = () => deskMap?.zoomOut()

  $('#time-track').onclick = (e) => {
    const x = e.offsetX / e.currentTarget.clientWidth
    state.timeMode = x > 0.5 ? 'forecast' : 'live'
    render()
  }

  setInterval(() => renderChrome(derive()), 1000)
  setInterval(() => {
    state.latencyMs = 70 + Math.floor(Math.random() * 55)
    renderRail(derive())
  }, 2800)

  setInterval(() => {
    if (state.incomingIdx >= INCOMING.length) return
    const item = INCOMING[state.incomingIdx++]
    const at = Date.now()
    if (item.threadId) {
      state.raw = state.raw.map((e) =>
        e.id === item.threadId ? { ...e, publishedAt: at, updates: [...(e.updates || []), { at, text: item.text }] } : e,
      )
      state.freshId = item.threadId
      state.alertMeta = markAlertUnread(state.alertMeta, item.threadId)
      const host = enrich(state.raw, ASSETS).find((e) => e.id === item.threadId)
      state.toast = host?.alert
        ? { title: 'Target update', place: item.text, alert: true }
        : { title: 'Watch update', place: item.text }
      state.log = [`Update · ${item.threadId}`, ...state.log].slice(0, 6)
    } else {
      const next = { ...item, publishedAt: at, eventAt: at }
      state.raw = [next, ...state.raw.filter((e) => e.id !== next.id)]
      state.freshId = next.id
      state.toast = { title: next.title, place: next.place }
      state.log = [`${next.place.split(',')[0]} · ${next.kind}`, ...state.log].slice(0, 6)
    }
    render()
    setTimeout(() => {
      state.freshId = null
      state.toast = null
      render()
    }, 4200)
  }, 11000)

  window.addEventListener('keydown', (e) => {
    const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
    if (e.key === '/' && !typing) {
      e.preventDefault()
      $('#search').focus()
    }
    if (e.key === 'Escape') {
      if (state.alertsOpen && state.alertCaseId) {
        state.alertCaseId = null
        render()
        return
      }
      if (state.alertsOpen) {
        closeAlerts()
        return
      }
      cueTimers.forEach(clearTimeout)
      state.scene = { pulse: false, flood: false, warehouse: false, distance: false }
      state.selectedId = null
      $('#search').blur()
      render()
    }
    if ((e.key === 'r' || e.key === 'R') && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      runDesk()
    }
  })

  render()
}
