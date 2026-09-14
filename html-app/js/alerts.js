import { clock, relativeTime, soWhat } from './scoring.js'

export const ALERT_STATUS = {
  new: 'new',
  ack: 'ack',
  investigating: 'investigating',
  resolved: 'resolved',
  dismissed: 'dismissed',
  snoozed: 'snoozed',
}

export const CLOSED_STATUSES = new Set(['resolved', 'dismissed', 'snoozed'])

export const STATUS_LABELS = {
  new: 'Unacked',
  ack: 'Watching',
  investigating: 'Incident',
  resolved: 'Closed',
  dismissed: 'Dropped',
  snoozed: 'Parked',
}

const LEVEL_LABELS = { none: 'None', low: 'Low', medium: 'Medium', high: 'High' }

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function defaultMeta() {
  return { status: ALERT_STATUS.new, unread: true, snoozeUntil: null, updatedAt: Date.now() }
}

export function ensureAlertMeta(events, meta) {
  const next = { ...meta }
  for (const event of events) {
    if (!event.alert) continue
    if (!next[event.id]) next[event.id] = defaultMeta()
  }
  return next
}

function sortQueue(items) {
  const rank = { high: 0, medium: 1, low: 2, none: 3 }
  return items.sort((a, b) => {
    const pa = rank[a.event.alertPriority] ?? 3
    const pb = rank[b.event.alertPriority] ?? 3
    if (pa !== pb) return pa - pb
    if (a.meta.unread !== b.meta.unread) return a.meta.unread ? -1 : 1
    return (b.event.publishedAt || 0) - (a.event.publishedAt || 0)
  })
}

export function buildQueues(events, alertMeta) {
  const alerts = []
  const incidents = []
  const closed = []
  for (const event of events) {
    if (!event.alert && !alertMeta[event.id]) continue
    const meta = alertMeta[event.id] || defaultMeta()
    const row = { event, meta }
    if (CLOSED_STATUSES.has(meta.status)) closed.push(row)
    else if (meta.status === ALERT_STATUS.investigating) incidents.push(row)
    else if (event.alert) alerts.push(row)
  }
  return {
    alerts: sortQueue(alerts),
    incidents: sortQueue(incidents),
    closed: sortQueue(closed),
  }
}

export function newActCount(queues) {
  return queues.alerts.filter((row) => row.meta.status === ALERT_STATUS.new && row.event.alertPriority === 'high').length
}

export function isAccelerating(event) {
  const updates = event.updates || []
  if (updates.length < 2) return false
  const windowMs = 6 * 3600 * 1000
  return updates.filter((u) => Date.now() - u.at < windowMs).length >= 2
}

export function storyBadge(event, meta) {
  if (meta.unread && meta.status === ALERT_STATUS.new) return 'NEW'
  if (isAccelerating(event)) return 'UPDATING'
  return null
}

export function ridFor(event) {
  return `ri.alert.${event.id}`
}

export function setAlertStatus(meta, id, status) {
  const prev = meta[id] || defaultMeta()
  return {
    ...meta,
    [id]: {
      ...prev,
      status,
      unread: status === ALERT_STATUS.new,
      updatedAt: Date.now(),
      snoozeUntil: status === ALERT_STATUS.snoozed ? Date.now() + 4 * 3600 * 1000 : null,
    },
  }
}

export function markAlertRead(meta, id) {
  const prev = meta[id] || defaultMeta()
  if (!prev.unread) return meta
  return { ...meta, [id]: { ...prev, unread: false, updatedAt: Date.now() } }
}

export function markAlertUnread(meta, id) {
  const prev = meta[id] || defaultMeta()
  return { ...meta, [id]: { ...prev, unread: true, updatedAt: Date.now() } }
}

function urgencyClass(event) {
  if (event.alertPriority === 'high') return 'crit'
  if (event.alertPriority === 'medium') return 'high'
  return 'med'
}

function pipeChip(kind, level, label) {
  const lv = level || 'none'
  return `<span class="pipe-chip ${kind}-${lv}">${esc(label)}</span>`
}

export function pipelineHtml(event) {
  const risk = event.risk || 'low'
  const exposure = event.exposure || 'none'
  const priority = event.alert ? event.alertPriority : 'none'
  return `<div class="pipe-row">
    ${pipeChip('event', 'yes', 'Event')}
    ${pipeChip('risk', risk, `Risk ${LEVEL_LABELS[risk] || risk}`)}
    ${pipeChip('exp', exposure, `Exposure ${LEVEL_LABELS[exposure] || exposure}`)}
    ${pipeChip('al', priority, priority === 'none' ? 'Not an alert' : `Alert ${LEVEL_LABELS[priority]}`)}
  </div>`
}

export function inboxRowHtml(row, selectedId) {
  const { event, meta } = row
  const badge = storyBadge(event, meta)
  const asset = event.primary?.asset
  const hit = asset ? `${event.primary.km.toFixed(1)} km · ${asset.name}` : 'No ATOM asset in radius'
  const n = event.updates?.length || 0
  const selected = selectedId === event.id ? 'selected' : ''
  const unread = meta.unread ? 'unread' : ''
  const kind = meta.status === ALERT_STATUS.investigating ? 'Incident' : 'Alert'
  return `<button type="button" class="alert-row ${selected} ${unread} urg-${urgencyClass(event)}" data-id="${esc(event.id)}">
    <i class="alert-row-bar" aria-hidden="true"></i>
    <span class="alert-row-main">
      <span class="alert-row-kicker">
        <span class="alert-type">${kind}</span>
        <span class="alert-rid">${esc(ridFor(event))}</span>
        <span class="alert-ago">${esc(relativeTime(event.publishedAt))}</span>
      </span>
      <strong>${esc(event.title)}</strong>
      ${pipelineHtml(event)}
      <span class="alert-row-meta">
        <span>${esc(hit)}</span>
        ${badge ? `<em class="alert-stamp ${badge === 'NEW' ? 'new' : 'accel'}">${badge}</em>` : ''}
        ${n ? `<span class="alert-updates">x${n} updates</span>` : ''}
        <span class="alert-status st-${meta.status}">${STATUS_LABELS[meta.status]}</span>
      </span>
    </span>
  </button>`
}

export function drawerHtml(event, meta) {
  const brief = soWhat(event)
  const asset = event.primary?.asset
  const status = meta.status
  const updates = [...(event.updates || [])].sort((a, b) => b.at - a.at)
  const canAck = status === ALERT_STATUS.new
  const canIncident = status === ALERT_STATUS.new || status === ALERT_STATUS.ack
  const openCase = !CLOSED_STATUSES.has(status)
  const isIncident = status === ALERT_STATUS.investigating
  const prop = (k, v) => `<div class="gotham-prop"><span>${k}</span><b>${v}</b></div>`
  const risk = event.risk || 'low'
  const exposure = event.exposure || 'none'
  const priority = event.alertPriority || 'none'

  return `<header class="alert-drawer-head">
    <div>
      <span class="gotham-kicker">${isIncident ? 'Incident' : 'Alert'}</span>
      <h2>${esc(event.title)}</h2>
      <code class="gotham-rid">${esc(ridFor(event))}</code>
    </div>
    <button type="button" class="alert-drawer-close" data-alert-close title="Close">×</button>
  </header>
  <div class="alert-drawer-scroll">
  <div class="alert-drawer-stamps">
    <span class="alert-status st-${status}">${STATUS_LABELS[status]}</span>
    <span class="alert-sev ${priority}">${esc(priority === 'none' ? 'not an alert' : `${priority} priority`)}</span>
  </div>
  <p class="alert-brief">${esc(brief.line)}</p>
  <section class="gotham-section">
    <h3>Why this is ${isIncident ? 'an incident' : event.alert ? 'an alert' : 'an event'}</h3>
    <div class="gotham-props pipeline-props">
      ${prop('Event', 'Yes · something is happening')}
      ${prop('Risk', `${LEVEL_LABELS[risk]} · how serious it could become`)}
      ${prop('Exposure', exposure === 'none' ? 'None · no ATOM asset in radius' : `${LEVEL_LABELS[exposure]} · ${asset ? `${event.primary.km.toFixed(1)} km · ${asset.name}` : 'linked site'}`)}
      ${prop('Alert', event.alert ? `${LEVEL_LABELS[priority]} · somebody needs to pay attention` : 'No · does not page the desk')}
      ${prop('Incident', isIncident ? 'Yes · the organization is responding' : 'No · response not opened')}
    </div>
  </section>
  <section class="gotham-section">
    <h3>Record</h3>
    <div class="gotham-props">
      ${prop('Location', esc(event.place))}
      ${prop('Published', esc(clock(event.publishedAt)))}
      ${prop('Source', esc(event.source || '—'))}
      ${prop('Domain', esc(event.domain || '—'))}
    </div>
  </section>
  <section class="gotham-section">
    <h3>Exposed asset</h3>
    ${
      asset
        ? `<button type="button" class="gotham-object" data-alert-asset="${esc(asset.id)}">
            <span class="gotham-kicker">Asset</span>
            <strong>${esc(asset.name)}</strong>
            <em>${event.primary.km.toFixed(1)} km · ${esc(asset.criticality)} criticality</em>
          </button>`
        : '<p class="gotham-empty">No registered site sits inside this radius. High risk without exposure is not an alert.</p>'
    }
  </section>
  <section class="gotham-section">
    <h3>Track</h3>
    ${
      updates.length
        ? `<ol class="alert-history">${updates
            .map((u) => `<li><time>${esc(clock(u.at))}</time><span>${esc(u.text)}</span></li>`)
            .join('')}</ol>`
        : `<p class="gotham-empty">${esc(brief.why)}</p>`
    }
  </section>
  </div>
  <footer class="alert-actions">
    <button type="button" data-alert-action="ack" ${canAck ? '' : 'disabled'}>Ack</button>
    <button type="button" data-alert-action="investigating" ${canIncident ? '' : 'disabled'}>Open incident</button>
    <button type="button" data-alert-action="snoozed" ${openCase ? '' : 'disabled'}>Park</button>
    <button type="button" class="danger" data-alert-action="dismissed" ${openCase ? '' : 'disabled'}>Drop</button>
    <button type="button" class="primary" data-alert-action="resolved" ${openCase ? '' : 'disabled'}>Close</button>
  </footer>`
}

export { LEVEL_LABELS }
