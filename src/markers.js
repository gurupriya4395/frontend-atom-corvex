export function eventMarkerHtml(event) {
  const impact = event.impact || 'none'
  const kind = event.kind || 'default'
  const label = kindLabel(kind)
  return `<span class="haz haz-badge haz-${kind} impact-${impact}" title="${escapeHtml(event.title)}">${kindSvg(kind)}</span><span class="map-label">${escapeHtml(label)}</span>`
}

export function eventSourceHref(event) {
  if (event.sourceUrl) return event.sourceUrl
  const q = encodeURIComponent(`${event.place || ''} ${event.title}`)
  return `https://news.google.com/search?q=${q}&hl=en`
}

export function eventBriefHtml(event) {
  const sev = event.severity || 'low'
  const impact = event.impact || 'none'
  const km = event.linked ? `${event.primary.km.toFixed(1)} km` : '—'
  const site = event.linked ? event.primary.asset.name : 'No linked site'
  const fence = event.linked
    ? event.primary.inside
      ? `Inside ${event.primary.asset.radiusKm} km fence`
      : `Outside ${event.primary.asset.radiusKm} km fence`
    : 'Not correlated to a registered asset'
  const body = event.summary || event.why || 'No description on file.'
  const src = event.source || 'ATOM-CORVEX'
  const href = eventSourceHref(event)
  return `<div class="ev-brief sev-${sev}">
    <div class="ev-brief-kicker">${escapeHtml(kindLabel(event.kind))} · ${escapeHtml(event.place || '')}</div>
    <h4>${escapeHtml(event.title)}</h4>
    <p class="ev-brief-copy">${escapeHtml(body)}</p>
    <div class="ev-brief-grid">
      <div><em>Severity</em><b>${escapeHtml(sev)}</b></div>
      <div><em>Distance</em><b>${escapeHtml(km)}</b></div>
      <div><em>Impact</em><b>${escapeHtml(impact)}</b></div>
    </div>
    <p class="ev-brief-dist">${escapeHtml(site)} · ${escapeHtml(fence)}</p>
    <a class="ev-source" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Source · ${escapeHtml(src)}</a>
  </div>`
}

export function eventCalloutHtml(event) {
  return eventBriefHtml(event)
}

export function assetMarkerHtml(asset, { selected = false } = {}) {
  const db = asset.org === 'deutsche-bank'
  const label = db ? `DB ${asset.city}` : asset.name
  const extra = selected ? assetBriefHtml(asset) : ''
  return `<span class="pin pin-${asset.criticality}${db ? ' pin-db' : ''}${selected ? ' is-on' : ''}" title="${escapeHtml(asset.name)}"><i></i><b>${escapeHtml(label)}</b></span>${extra}`
}

export function assetBriefHtml(asset) {
  return `<div class="ev-brief asset-brief">
    <div class="ev-brief-kicker">Registered site</div>
    <h4>${escapeHtml(asset.name)}</h4>
    <p class="ev-brief-copy">${escapeHtml(asset.type || 'Site')} in ${escapeHtml(asset.city || '')}${asset.country ? `, ${escapeHtml(asset.country)}` : ''}.</p>
    <div class="ev-brief-grid">
      <div><em>Fence</em><b>${asset.radiusKm} km</b></div>
      <div><em>Criticality</em><b>${escapeHtml(asset.criticality || '—')}</b></div>
      <div><em>Type</em><b>${escapeHtml(asset.type || 'Site')}</b></div>
    </div>
  </div>`
}

function kindLabel(kind) {
  if (kind === 'fire') return 'Fire'
  if (kind === 'flood') return 'Flood'
  if (kind === 'storm') return 'Storm'
  if (kind === 'protest') return 'Protest'
  if (kind === 'quake') return 'Quake'
  if (kind === 'security') return 'Security'
  if (kind === 'haze') return 'Haze'
  return 'Event'
}

function kindSvg(kind) {
  switch (kind) {
    case 'fire':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2s3 4 3 7a3 3 0 0 1-3 3 3 3 0 0 1-1-.17C12.6 13.5 14 15.2 14 17a2 2 0 0 1-4 0c0-2.4 3-4.2 3-7.5C13 7.8 12 6 12 2Zm0 9c.8-1.2 1.5-2.7 1.5-4.2 1.4 1.6 2.5 3.5 2.5 5.2A4 4 0 0 1 12 20a4 4 0 0 1-4-4c0-1.8 1-3.5 2.2-4.9.2 1.2.9 2.3 1.8 2.9Z"/></svg>`
    case 'flood':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c.4 1.8 2 3.4 3.8 4.4C18.4 9 20 11.2 20 14a8 8 0 0 1-16 0c0-2.8 1.6-5 4.2-6.6C10 6.4 11.6 4.8 12 3Zm0 5.2C9.6 9.4 8 11.5 8 14a4 4 0 0 0 8 0c0-2.5-1.6-4.6-4-5.8Z"/></svg>`
    case 'storm':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5 10a5.5 5.5 0 0 1 10.4-2.5A4.5 4.5 0 0 1 18 16.5H8.5A4.5 4.5 0 0 1 7.5 10Zm5.2 7 1.8 4h-2.2l-1.3-3H9.2l2.2-5h1.6l-1.8 4h1.5Z"/></svg>`
    case 'protest':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm8 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM4 20v-1.2c0-2 3-3.3 6-3.3.6 0 1.2 0 1.7.1A4.8 4.8 0 0 0 10 18.8V20H4Zm8 0v-1.2A3.8 3.8 0 0 1 16 15.5c3 0 6 1.3 6 3.3V20h-10Z"/></svg>`
    case 'quake':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 13h3l2-5 2.5 8 2-6 1.5 3H21v-2h-5.2L14.2 7h-2.1L9.8 14 8 9H6.2L4.8 11H3v2Z"/></svg>`
    case 'security':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 5 5v6c0 4.5 3.1 8.7 7 9.7 3.9-1 7-5.2 7-9.7V5l-7-3Zm0 3.1 5 2.1v4.8c0 3.3-2.2 6.4-5 7.3-2.8-.9-5-4-5-7.3V7.2l5-2.1Z"/></svg>`
    case 'haze':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 8h16v2H4V8Zm0 4h16v2H4v-2Zm2 4h12v2H6v-2Z"/></svg>`
    default:
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>`
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}
