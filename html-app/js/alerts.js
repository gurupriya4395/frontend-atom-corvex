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
  new: 'New',
  ack: 'Acknowledged',
  investigating: 'Investigating',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  snoozed: 'Snoozed',
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function defaultMeta() {
  return { status: ALERT_STATUS.new, unread: true, snoozeUntil: null, updatedAt: Date.now() }
}

export function ensureAlertMeta(events, meta) {
  const next = { ...meta }
  for (const event of events) {
    if (!event.linked) continue
    if (!next[event.id]) next[event.id] = defaultMeta()
  }
  return next
}

function sortQueue(items) {
  return items.sort((a, b) => {
    if (a.meta.unread !== b.meta.unread) return a.meta.unread ? -1 : 1
    if ((a.meta.status === 'new') !== (b.meta.status === 'new')) return a.meta.status === 'new' ? -1 : 1
    return (b.event.publishedAt || 0) - (a.event.publishedAt || 0)
  })
}

export function buildQueues(events, alertMeta) {
  const act = []
  const watch = []
  const closed = []
  for (const event of events) {
    if (!event.linked || event.flag !== 'IN') continue
    const meta = alertMeta[event.id] || defaultMeta()
    const row = { event, meta }
    if (CLOSED_STATUSES.has(meta.status)) closed.push(row)
    else if (event.alert) act.push(row)
    else watch.push(row)
  }
  return {
    act: sortQueue(act),
    watch: sortQueue(watch),
    closed: sortQueue(closed),
  }
}

export function newActCount(queues) {
  return queues.act.filter((row) => row.meta.status === ALERT_STATUS.new).length
}

export function isAccelerating(event) {
  const updates = event.updates || []
  if (updates.length < 2) return false
  const windowMs = 6 * 3600 * 1000
  return updates.filter((u) => Date.now() - u.at < windowMs).length >= 2
}

export function storyBadge(event, meta) {
  if (meta.unread && meta.status === ALERT_STATUS.new) return 'NEW'
  if (isAccelerating(event)) return 'ACCELERATING'
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
  if (event.alert && event.impact === 'high') return 'crit'
  if (event.alert) return 'high'
  if (event.impact === 'medium') return 'med'
  return 'low'
}

export function inboxRowHtml(row, selectedId) {
  const { event, meta } = row
  const badge = storyBadge(event, meta)
  const asset = event.primary?.asset
  const hit = asset ? `${event.primary.km.toFixed(1)} km · ${asset.name}` : 'Linked asset'
  const n = event.updates?.length || 0
  const selected = selectedId === event.id ? 'selected' : ''
  const unread = meta.unread ? 'unread' : ''
  return `<button type="button" class="alert-row ${selected} ${unread} urg-${urgencyClass(event)}" data-id="${esc(event.id)}">
    <i class="alert-row-bar" aria-hidden="true"></i>
    <span class="alert-row-main">
      <span class="alert-row-kicker">
        <span class="alert-type">${event.alert ? 'Alert' : 'Watch'}</span>
        <span class="alert-rid">${esc(ridFor(event))}</span>
        <span class="alert-ago">${esc(relativeTime(event.publishedAt))}</span>
      </span>
      <strong>${esc(event.title)}</strong>
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
  const canInvestigate = status === ALERT_STATUS.new || status === ALERT_STATUS.ack
  const openCase = !CLOSED_STATUSES.has(status)

  const prop = (k, v) => `<div class="gotham-prop"><span>${k}</span><b>${v}</b></div>`

  return `<header class="alert-drawer-head">
    <div>
      <span class="gotham-kicker">${event.alert ? 'Alert object' : 'Watch object'}</span>
      <h2>${esc(event.title)}</h2>
      <code class="gotham-rid">${esc(ridFor(event))}</code>
    </div>
    <button type="button" class="alert-drawer-close" data-alert-close title="Close object">×</button>
  </header>
  <div class="alert-drawer-scroll">
  <div class="alert-drawer-stamps">
    <span class="alert-status st-${status}">${STATUS_LABELS[status]}</span>
    <span class="alert-sev ${event.severity}">${esc(event.severity)}</span>
    ${event.alert && status === ALERT_STATUS.new ? '<span class="alert-stamp new">NEEDS ACTION</span>' : ''}
  </div>
  <p class="alert-brief">${esc(brief.line)}</p>
  <section class="gotham-section">
    <h3>Properties</h3>
    <div class="gotham-props">
      ${prop('Location', esc(event.place))}
      ${prop('Published', esc(clock(event.publishedAt)))}
      ${prop('Impact', esc(event.impact || '—'))}
      ${prop('Score', event.raw != null ? `${event.raw.toFixed(2)} / 3` : '—')}
      ${prop('Source', esc(event.source || '—'))}
      ${prop('Domain', esc(event.domain || '—'))}
    </div>
  </section>
  <section class="gotham-section">
    <h3>Linked objects</h3>
    ${
      asset
        ? `<button type="button" class="gotham-object" data-alert-asset="${esc(asset.id)}">
            <span class="gotham-kicker">Asset</span>
            <strong>${esc(asset.name)}</strong>
            <em>${event.primary.km.toFixed(1)} km · ${esc(asset.criticality)} criticality</em>
          </button>`
        : '<p class="gotham-empty">No linked asset object.</p>'
    }
    <div class="gotham-object is-static">
      <span class="gotham-kicker">Event</span>
      <strong>${esc(event.id)}</strong>
      <em>${esc(event.kind)} · ${esc(event.category)}</em>
    </div>
  </section>
  <section class="gotham-section">
    <h3>History</h3>
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
    <button type="button" data-alert-action="ack" ${canAck ? '' : 'disabled'}>Acknowledge</button>
    <button type="button" data-alert-action="investigating" ${canInvestigate ? '' : 'disabled'}>Investigate</button>
    <button type="button" data-alert-action="snoozed" ${openCase ? '' : 'disabled'}>Snooze</button>
    <button type="button" class="danger" data-alert-action="dismissed" ${openCase ? '' : 'disabled'}>Dismiss</button>
    <button type="button" class="primary" data-alert-action="resolved" ${openCase ? '' : 'disabled'}>Resolve</button>
  </footer>`
}
