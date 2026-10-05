import { ASSETS, DEMO, EVENTS, GLOBE_ASSETS, INDIA_ASSETS, INCOMING } from './data.js'
import { DESK_BEATS } from './sequence.js'
import { enrich, clock, searchHay } from './scoring.js'
import { fmtLat, fmtLng, fmtPair } from './coords.js'
import { VIEW_LABELS, TIME_WINDOW_LABELS, CATEGORY_LABELS, SEVERITY_LABELS, FOCUS_TYPE_LABELS, WORKSPACE_LABELS } from './labels.js'
import { defaultAlertCopy, headcountOf, peopleNearEvent } from './dispatch.js'

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
const LIVE_MS = 24 * 3600 * 1000
const eventStamp = (e) => e.eventAt || e.publishedAt || 0
const isUpcomingEvent = (e) => Boolean(e.forecast) || eventStamp(e) > Date.now()
const isForecastEvent = isUpcomingEvent
const isHistoryEvent = (e) => !isUpcomingEvent(e) && eventStamp(e) < Date.now() - LIVE_MS
const isLiveEvent = (e) => !isUpcomingEvent(e) && !isHistoryEvent(e)
const inNextTwoDays = (e) => {
  const at = eventStamp(e)
  return at > Date.now() && at <= Date.now() + TWO_DAYS_MS
}

const EVENT_CITIES = [
  { name: 'Mumbai, Maharashtra, India', coords: [72.869, 19.089] },
  { name: 'Pune, Maharashtra, India', coords: [73.841, 18.531] },
  { name: 'Nashik, Maharashtra, India', coords: [73.7898, 19.9975] },
  { name: 'Chennai, Tamil Nadu, India', coords: [80.29, 13.1] },
  { name: 'Gurugram, Haryana, India', coords: [77.072, 28.47] },
  { name: 'Kochi, Kerala, India', coords: [76.2673, 9.9312] },
]

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
  log: ['Desk ready · waiting for situations'],
  freshId: null,
  toast: null,
  latencyMs: 86,
  incomingIdx: 0,
  notifyRadiusKm: 10,
  selectedPeople: {},
  draftMessage: '',
  sentAlerts: [],
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
    if (state.timeMode === 'forecast') return isUpcomingEvent(e)
    if (state.timeMode === 'history') return isHistoryEvent(e)
    return isLiveEvent(e)
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

function nearbyFor(event) {
  return peopleNearEvent(event, state.notifyRadiusKm)
}

function selectedRecipients(people) {
  return people.filter((person) => state.selectedPeople[person.id] !== false)
}

function syncPeopleSelection(people) {
  const next = {}
  for (const person of people) {
    next[person.id] = state.selectedPeople[person.id] !== false
  }
  state.selectedPeople = next
}

function pickEvent(id, opts = {}) {
  const changed = state.selectedId !== id
  state.selectedId = id
  state.selectedAssetId = null
  if (opts.map) state.mapMode = 'map'
  if (changed) {
    const event = enrich(state.raw, ASSETS).find((e) => e.id === id)
    const people = nearbyFor(event)
    state.selectedPeople = Object.fromEntries(people.map((p) => [p.id, true]))
    state.draftMessage = defaultAlertCopy(event, people)
  }
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

  document.querySelectorAll('.menu-nav button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.workspace === state.workspace)
  })
  document.querySelectorAll('.monitor-windows button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.window === state.monitorWindow)
  })
  document.querySelectorAll('.monitor-present button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.present === state.presentation)
  })
  const note = $('#workspace-note')
  if (note) {
    const text = WORKSPACE_LABELS[state.workspace] || ''
    note.textContent = text
    note.hidden = !text
  }
  const monitorBar = $('#monitor-bar')
  if (monitorBar) monitorBar.hidden = state.workspace !== 'monitor'
  if ($('#view-badge')) $('#view-badge').textContent = VIEW_LABELS[state.mapMode] || VIEW_LABELS.globe
  document.querySelectorAll('#time-windows button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.timeMode)
  })

  if (!$('#alert-cells')) return

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
  if (d.focusPoint) {
    coordStrip.innerHTML = `<div class="coord-strip-head"><span class="coord-strip-tag">${FOCUS_TYPE_LABELS[d.focusPoint.type]}</span><span class="coord-strip-name">${d.focusPoint.label}</span></div><div class="coord-strip-geo"><div class="coord-strip-cell"><span>Latitude</span><strong>${fmtLat(d.focusPoint.lat)}</strong></div><div class="coord-strip-cell"><span>Longitude</span><strong>${fmtLng(d.focusPoint.lng)}</strong></div><div class="coord-strip-cell dd"><span>Coordinates</span><strong>${fmtPair(d.focusPoint.lat, d.focusPoint.lng)}</strong></div></div>`
  } else {
    coordStrip.innerHTML = `<span class="coord-strip-empty">Select an event or site to view coordinates</span>`
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
  if (!$('#utc-clock')) return
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

function renderFeed(d) {
  const n = d.filtered.length
  $('#feed-count').textContent = n
  if ($('#feed-mode')) {
    $('#feed-mode').textContent =
      state.timeMode === 'forecast' ? 'Upcoming' : state.timeMode === 'history' ? 'History' : 'Live'
  }
  if ($('#feed-clock')) $('#feed-clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false })

  if (!d.filtered.length) {
    const empty =
      state.q
        ? `No match for “${state.q}”.`
        : state.timeMode === 'forecast'
          ? 'No upcoming signals. Log one, or add forecast: true in js/data.js.'
          : state.timeMode === 'history'
            ? 'No closed cases in this window. Log one, or set eventAt with daysAgo() in js/data.js.'
            : 'No live situations on the desk.'
    $('#event-cards').innerHTML = `<div class="empty">${empty}</div>`
    return
  }
  $('#event-cards').innerHTML = d.filtered
    .map((ev, i) => {
      const windowKind = isUpcomingEvent(ev) ? 'forecast' : isHistoryEvent(ev) ? 'history' : 'live'
      const windowLabel = windowKind === 'forecast' ? 'upcoming' : windowKind
      const when = clock(ev.eventAt || ev.publishedAt)
      const assetName = ev.primary?.asset?.name
      const place = (ev.place || '').split(',')[0]
      return `<button type="button" class="card kind-${ev.kind} sev-${ev.severity} ${state.selectedId === ev.id ? 'selected' : ''} ${state.freshId === ev.id ? 'fresh' : ''}" data-id="${ev.id}" style="animation-delay:${Math.min(i, 8) * 40}ms"><span class="card-body"><div class="card-kicker"><i class="pip ${ev.severity}"></i><span class="place">${place}</span><span class="chip ${windowKind === 'live' ? 'ok' : windowKind}">${windowLabel}</span><span class="ago">${when}</span></div><h3>${ev.title}</h3>${assetName ? `<p class="asset-hit">${assetName} in range</p>` : ''}</span></button>`
    })
    .join('')
  $('#event-cards').querySelectorAll('.card').forEach((btn) => {
    btn.onclick = () => {
      forceGlobeFly = true
      pickEvent(btn.dataset.id)
    }
  })
}

function renderDispatch(d) {
  const panel = $('#dispatch-panel')
  if (!panel) return
  const event = d.selectedEvent
  if (!event) {
    panel.innerHTML = `<p class="dispatch-empty">Select a situation. You will only message people who sit inside that radius.</p>`
    return
  }
  const people = nearbyFor(event)
  syncPeopleSelection(people)
  const chosen = selectedRecipients(people)
  const n = headcountOf(chosen)
  const radii = [5, 10, 25]
  if (!people.length) {
    panel.innerHTML = `<div class="dispatch-label">Exposure</div>
      <p class="dispatch-place"><strong>${event.place.split(',')[0]}</strong></p>
      <div class="radius-row">${radii.map((km) => `<button type="button" data-radius="${km}" class="${state.notifyRadiusKm === km ? 'on' : ''}">${km} km</button>`).join('')}</div>
      <div class="nobody">No registered people sit inside ${state.notifyRadiusKm} km. Do not broadcast city-wide. Widen the radius or pick another situation.</div>`
    bindDispatch(panel)
    return
  }
  panel.innerHTML = `<div class="dispatch-label">Exposure</div>
    <p class="dispatch-place"><strong>${event.place.split(',')[0]}</strong> · ${n} in ${state.notifyRadiusKm} km</p>
    <div class="radius-row">${radii.map((km) => `<button type="button" data-radius="${km}" class="${state.notifyRadiusKm === km ? 'on' : ''}">${km} km</button>`).join('')}</div>
    <div class="people-list">${people
      .map((person) => {
        const on = state.selectedPeople[person.id] !== false
        const count = person.headcount || 1
        return `<button type="button" class="person ${on ? '' : 'off'}" data-person="${person.id}">
          <input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" />
          <span><b>${person.name}</b><span>${person.role} · ${person.site.name}</span></span>
          <em>${person.km.toFixed(1)} km${count > 1 ? ` · ${count}` : ''}</em>
        </button>`
      })
      .join('')}</div>
    <textarea id="dispatch-copy" class="dispatch-copy">${state.draftMessage || defaultAlertCopy(event, chosen)}</textarea>
    <button type="button" class="send-alert" ${n ? '' : 'disabled'} data-send="1">Issue notice to ${n} ${n === 1 ? 'person' : 'people'}</button>
    <p class="send-note">Only the checked group is notified. Nobody else on the map receives this.</p>
    ${
      state.sentAlerts.length
        ? `<div class="sent-log"><h4>Notices sent</h4><ul>${state.sentAlerts
            .slice(0, 4)
            .map((row) => `<li>${row.n} people · ${row.place} · ${clock(row.at)}</li>`)
            .join('')}</ul></div>`
        : ''
    }`
  bindDispatch(panel)
}

function bindDispatch(panel) {
  panel.querySelectorAll('[data-radius]').forEach((btn) => {
    btn.onclick = () => {
      state.notifyRadiusKm = Number(btn.dataset.radius)
      const event = enrich(state.raw, ASSETS).find((e) => e.id === state.selectedId)
      const people = nearbyFor(event)
      state.selectedPeople = Object.fromEntries(people.map((p) => [p.id, true]))
      state.draftMessage = defaultAlertCopy(event, people)
      render()
    }
  })
  panel.querySelectorAll('[data-person]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.person
      state.selectedPeople = { ...state.selectedPeople, [id]: state.selectedPeople[id] === false }
      const copy = $('#dispatch-copy')
      if (copy) state.draftMessage = copy.value
      render()
    }
  })
  const copy = $('#dispatch-copy')
  if (copy) {
    copy.oninput = () => {
      state.draftMessage = copy.value
    }
  }
  const send = panel.querySelector('[data-send]')
  if (send) {
    send.onclick = () => {
      const event = enrich(state.raw, ASSETS).find((e) => e.id === state.selectedId)
      const people = selectedRecipients(nearbyFor(event))
      const n = headcountOf(people)
      if (!n) return
      const message = ($('#dispatch-copy')?.value || '').trim()
      state.sentAlerts = [
        {
          at: Date.now(),
          eventId: event.id,
          place: event.place.split(',')[0],
          n,
          names: people.map((p) => p.name),
          message,
        },
        ...state.sentAlerts,
      ]
      state.log = [`Notice issued · ${n} nearby · ${event.place.split(',')[0]}`, ...state.log].slice(0, 6)
      state.toast = { title: `Notice issued to ${n} nearby`, place: event.place }
      render()
      setTimeout(() => {
        state.toast = null
        render()
      }, 4200)
    }
  }
}

function renderMaps(d) {
  const wrap = $('#map-wrap')
  if (!wrap) return
  wrap.className = `map-wrap ${state.mapMode === 'map' ? 'is-imagery' : 'is-satellite'}`
  const globeStage = $('#globe-stage')
  const mapStage = $('#map-stage')
  if (globeStage) globeStage.className = `globe-stage ${state.mapMode === 'globe' ? 'on' : 'off'}`
  if (mapStage) mapStage.className = `map-stage ${state.mapMode === 'map' ? 'on' : 'off'}`
  const btnGlobe = $('#btn-globe')
  const btnMap = $('#btn-map')
  if (btnGlobe) btnGlobe.classList.toggle('active', state.mapMode === 'globe')
  if (btnMap) btnMap.classList.toggle('active', state.mapMode === 'map')
  if ($('#globe-tools')) $('#globe-tools').hidden = state.mapMode !== 'globe'

  const pulseEventId = state.scene.pulse ? DEMO.eventId : null
  const highlightAssetId = state.scene.warehouse ? DEMO.assetId : null

  globe?.setPaused(state.mapMode !== 'globe')
  try {
    globe?.setData({ events: d.filtered, assets: GLOBE_ASSETS, showRadiusFor: d.showRadiusFor, pulseEventId, highlightAssetId })
  } catch (err) {
    console.warn('Globe data failed', err)
    showGlobeFallback()
  }
  if (state.mapMode === 'globe') {
    globe?.resize()
    const flyKey = d.selected ? `${d.selected.type}:${d.selected.id}` : pulseEventId ? `pulse:${pulseEventId}` : ''
    if (forceGlobeFly || (flyKey && flyKey !== lastGlobeFlyKey)) {
      forceGlobeFly = false
      lastGlobeFlyKey = flyKey
      if (pulseEventId && !d.selected) {
        const ev = d.filtered.find((e) => e.id === pulseEventId)
        if (ev?.coords) globe?.flyTo(ev.coords[1], ev.coords[0], true)
      } else if (d.selected) {
        const target =
          d.selected.type === 'event'
            ? d.filtered.find((e) => e.id === d.selected.id)
            : GLOBE_ASSETS.find((a) => a.id === d.selected.id)
        if (target?.coords) globe?.flyTo(target.coords[1], target.coords[0], true)
      }
    }
    const pov = globe?.pointOfView()
    const tel = $('#globe-telemetry')
    if (pov && tel) {
      if (d.focusPoint) {
        tel.innerHTML = `<span>Camera</span><b class="telemetry-target">${d.focusPoint.label}</b><span class="telemetry-sub">${fmtLat(pov.lat)} ${fmtLng(pov.lng)} · alt ${pov.alt.toFixed(1)}</span><i></i>`
      } else {
        tel.innerHTML = `<span>Camera</span><b>${fmtLat(pov.lat)} ${fmtLng(pov.lng)}</b><span>Alt ${pov.alt.toFixed(1)} · select a pin for details</span><i></i>`
      }
    }
  }

  deskMap?.setActive(state.mapMode === 'map')
  deskMap?.update({
    events: d.filtered,
    assets: INDIA_ASSETS,
    selected: d.selected,
    showRadiusFor: d.showRadiusFor,
    scene: state.scene,
    highlightAssetId,
    timeMode: state.timeMode,
    focusPoint: d.focusPoint,
  })

  const toast = $('#wire-toast')
  if (toast) {
    if (state.toast) {
      toast.hidden = false
      toast.innerHTML = `<span>Desk</span><b>${state.toast.title}</b><em>${state.toast.place}</em>`
    } else toast.hidden = true
  }

  document.querySelectorAll('.time-dock button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.timeMode)
    btn.onclick = () => {
      state.timeMode = btn.dataset.mode
      render()
    }
  })
  if ($('#time-head')) $('#time-head').className = `head ${state.timeMode}`
}

function render() {
  const d = derive()
  if (state.selectedId && !d.filtered.some((e) => e.id === state.selectedId)) {
    state.selectedId = null
    state.selectedAssetId = null
    state.selectedPeople = {}
    state.draftMessage = ''
  }
  if (!state.selectedId && !state.selectedAssetId) {
    const first = d.filtered.find((e) => e.linked) || d.filtered[0]
    if (first) {
      state.selectedId = first.id
      const people = nearbyFor(first)
      state.selectedPeople = Object.fromEntries(people.map((p) => [p.id, true]))
      state.draftMessage = defaultAlertCopy(first, people)
    }
  }
  const d2 = derive()
  renderChrome(d2)
  renderRail(d2)
  renderFeed(d2)
  renderDispatch(d2)
  renderMaps(d2)
}

function addCustomEvent({ title, place, window, severity, category }) {
  const city = EVENT_CITIES.find((c) => c.name === place) || EVENT_CITIES[0]
  const now = Date.now()
  const eventAt =
    window === 'forecast' ? now + 36 * 3600 * 1000 : window === 'history' ? now - 5 * 86400 * 1000 : now - 15 * 60 * 1000
  const kind = category === 'environmental' ? 'storm' : category === 'security' ? 'security' : 'protest'
  const next = {
    id: `ev-custom-${now}`,
    kind,
    category,
    domain: 'Operator',
    title: title.trim(),
    summary: 'Added from the authority desk.',
    place: city.name,
    flag: 'IN',
    coords: city.coords,
    severity,
    source: 'Authority desk',
    publishedAt: window === 'forecast' ? now : eventAt,
    eventAt,
    forecast: window === 'forecast',
    why: 'Operator-added event.',
  }
  state.raw = [next, ...state.raw]
  state.timeMode = window === 'forecast' ? 'forecast' : window === 'history' ? 'history' : 'live'
  state.q = ''
  const search = $('#search')
  if (search) search.value = ''
  pickEvent(next.id)
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

function showGlobeFallback() {
  const el = $('#globe-stage')
  if (!el || el.querySelector('.globe-fallback')) return
  el.querySelectorAll('canvas, .globe-labels').forEach((node) => node.remove())
  el.insertAdjacentHTML(
    'beforeend',
    `<div class="globe-fallback"><strong>Affected area</strong><p>The globe could not start in this browser. Pick an event on the right — you can still notify people nearby. Use Map for satellite imagery.</p></div>`,
  )
}

function onMapSelect(sel) {
  if (!sel) {
    clearSelection()
    return
  }
  if (sel.type === 'event') pickEvent(sel.id)
  if (sel.type === 'asset') pickAsset(sel.id)
}

export function initApp() {
  const boot = $('#boot')
  if (boot) boot.hidden = true
  state.boot = false
  try {
    render()
  } catch (err) {
    console.warn('Initial render failed', err)
  }

  import('./globe.js')
    .then(({ createGlobe }) => {
      try {
        const host = $('#globe-stage')
        if (!host) return
        globe = createGlobe(host, onMapSelect)
        globe?.resize()
        render()
      } catch (err) {
        console.warn('Globe unavailable', err)
        showGlobeFallback()
      }
    })
    .catch((err) => {
      console.warn('Globe failed to load', err)
      showGlobeFallback()
    })

  setTimeout(() => {
    const host = $('#globe-stage')
    if (host && !host.querySelector('canvas') && !host.querySelector('.globe-fallback')) showGlobeFallback()
  }, 2500)

  if ($('#globe-stage')) new ResizeObserver(() => globe?.resize()).observe($('#globe-stage'))
  setInterval(() => {
    if (state.mapMode !== 'globe') return
    try {
      renderMaps(derive())
    } catch (err) {
      console.warn('Globe tick failed', err)
    }
  }, 240)

  import('./map.js')
    .then(({ DeskMap }) => {
      deskMap = new DeskMap($('#terrain-canvas'), $('#desk-hud'), onMapSelect)
      if ($('#terrain-canvas')) new ResizeObserver(() => deskMap?.resize()).observe($('#terrain-canvas'))
      render()
    })
    .catch((err) => console.warn('Map failed to load', err))

  $('#search')?.addEventListener('input', (e) => {
    state.q = e.target.value
    render()
  })
  $('#search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const d = derive()
      if (d.filtered[0]) pickEvent(d.filtered[0].id)
    }
  })
  if ($('#btn-demo')) $('#btn-demo').onclick = runDesk
  if ($('#btn-replay')) $('#btn-replay').onclick = runDesk
  const btnGlobe = $('#btn-globe')
  if (btnGlobe) {
    btnGlobe.onclick = () => {
      state.mapMode = 'globe'
      render()
    }
  }
  const btnMap = $('#btn-map')
  if (btnMap) {
    btnMap.onclick = () => {
      state.mapMode = 'map'
      deskMap?.boot()
      render()
    }
  }
  document.querySelectorAll('#time-windows button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.timeMode = btn.dataset.mode
      if (btn.dataset.mode === 'live') state.monitorWindow = 'live'
      if (btn.dataset.mode === 'forecast') state.monitorWindow = 'upcoming'
      if (btn.dataset.mode === 'history') state.monitorWindow = 'history'
      render()
    })
  })
  const addBtn = $('#btn-add-event')
  const addForm = $('#add-event-form')
  if (addBtn && addForm) {
    addBtn.onclick = () => {
      addForm.hidden = !addForm.hidden
    }
    addForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const title = addForm.title.value.trim()
      if (!title) return
      addCustomEvent({
        title,
        place: addForm.place.value,
        window: addForm.when.value,
        severity: addForm.severity.value,
        category: addForm.category.value,
      })
      addForm.reset()
      addForm.hidden = true
    })
  }
  document.querySelectorAll('.menu-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.workspace = btn.dataset.workspace
      render()
    })
  })
  document.querySelectorAll('.monitor-windows button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.monitorWindow = btn.dataset.window
      if (btn.dataset.window === 'live') state.timeMode = 'live'
      if (btn.dataset.window === 'upcoming') state.timeMode = 'forecast'
      if (btn.dataset.window === 'history') state.timeMode = 'history'
      render()
    })
  })
  document.querySelectorAll('.monitor-present button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.presentation = btn.dataset.present
      if (btn.dataset.present === 'map') {
        /* keep current globe/map; no panel layout change */
      }
      render()
    })
  })

  const zoomGlobe = $('#btn-zoom-globe')
  if (zoomGlobe) {
    zoomGlobe.onclick = () => {
      clearSelection()
      globe?.zoomOut()
    }
  }
  const zoomMap = $('#btn-zoom-map')
  if (zoomMap) zoomMap.onclick = () => deskMap?.zoomOut()

  const timeTrack = $('#time-track')
  if (timeTrack) {
    timeTrack.onclick = (e) => {
      const x = e.offsetX / e.currentTarget.clientWidth
      state.timeMode = x > 0.5 ? 'forecast' : 'live'
      render()
    }
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
      state.toast = { title: 'Watch update', place: item.text }
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
      $('#search')?.focus()
    }
    if (e.key === 'Escape') {
      cueTimers.forEach(clearTimeout)
      state.scene = { pulse: false, flood: false, warehouse: false, distance: false }
      state.selectedId = null
      $('#search')?.blur()
      render()
    }
    if ((e.key === 'r' || e.key === 'R') && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      runDesk()
    }
  })

  try {
    render()
  } catch (err) {
    console.warn('Render failed', err)
  }
}
