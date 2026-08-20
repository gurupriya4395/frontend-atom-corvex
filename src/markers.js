export function eventMarkerHtml(event) {
  const impact = event.impact || 'none'
  return `<span class="haz haz-${event.kind} impact-${impact}" title="${escapeHtml(event.title)}">${inner(event.kind)}</span>`
}

export function eventSourceHref(event) {
  if (event.sourceUrl) return event.sourceUrl
  const q = encodeURIComponent(`${event.place || ''} ${event.title}`)
  return `https://news.google.com/search?q=${q}&hl=en`
}

export function eventBriefHtml(event) {
  const sev = (event.severity || 'low').toUpperCase()
  const impact = (event.impact || 'none').toUpperCase()
  const km = event.linked ? `${event.primary.km.toFixed(1)} km to ${event.primary.asset.name}` : 'Not linked to a site'
  const body = event.summary || event.why || ''
  const src = event.source || 'ATOM-CORVEX'
  const href = eventSourceHref(event)
  return `<div class="ev-brief sev-${event.severity || 'low'}">
    <div class="ev-brief-meta">
      <span>${escapeHtml(sev)}</span>
      <span>${escapeHtml(impact)} impact</span>
    </div>
    <h4>${escapeHtml(event.title)}</h4>
    <p class="ev-brief-dist">${escapeHtml(km)}</p>
    <p>${escapeHtml(body)}</p>
    <a class="ev-source" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Source · ${escapeHtml(src)}</a>
  </div>`
}

export function eventCalloutHtml(event) {
  return eventBriefHtml(event)
}

export function assetMarkerHtml(asset) {
  const db = asset.org === 'deutsche-bank'
  const label = db ? `DB ${asset.city}` : asset.name.split(' ')[0]
  return `<span class="pin pin-${asset.criticality}${db ? ' pin-db' : ''}" title="${escapeHtml(asset.name)}"><i></i><b>${escapeHtml(label)}</b></span>`
}

function inner(kind) {
  switch (kind) {
    case 'fire':
      return `<span class="flame"><i></i></span>`
    case 'flood':
      return `<span class="drop"></span>`
    case 'storm':
      return `<span class="cyclone"><svg viewBox="0 0 64 64"><path d="M32 8c8 6 14 10 18 18 3 7-1 14-8 16-9 3-16-2-18-10-1-6 3-10 8-11 4 0 6 3 6 6 0 2-1 4-4 4"/></svg></span>`
    case 'protest':
      return `<span class="crowd"><i></i><i></i><i></i></span>`
    case 'quake':
      return `<span class="quake-dot"></span>`
    case 'security':
      return `<span class="siren"><i></i></span>`
    case 'haze':
      return `<span class="smoke"><i></i></span>`
    default:
      return `<span class="dot"></span>`
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}
