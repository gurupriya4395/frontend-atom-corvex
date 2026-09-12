export function eventMarkerHtml(event) {
  const impact = event.impact || 'none'
  const sev = event.severity || 'medium'
  const aff = affiliationClass(event)
  return `<span class="haz tak-sym haz-${event.kind} sev-${sev} aff-${aff} impact-${impact}" title="${escapeHtml(event.title)}"><span class="tak-frame" aria-hidden="true"></span><span class="tak-glyph">${inner(event.kind)}</span></span>`
}

function affiliationClass(event) {
  if (event.category === 'security') return 'hostile'
  if (event.category === 'geopolitical') return 'neutral'
  return 'unknown'
}

export function eventSourceHref(event) {
  if (event.sourceUrl && !/datasurfr/i.test(event.sourceUrl)) return event.sourceUrl
  return 'https://www.reuters.com/world/'
}

export function eventBriefHtml(event) {
  const body = event.summary || event.why || ''
  const src = event.source && !/datasurfr|atom-corvex/i.test(event.source) ? event.source : 'Reuters'
  const href = eventSourceHref(event)
  const sev = event.severity || 'medium'
  const asset = event.primary?.asset?.name
  const km = event.primary?.km
  const dist =
    km != null && asset
      ? `${Number(km).toFixed(1)} km from ${asset}`
      : 'No registered asset in radius'
  return `<div class="ev-brief sev-${escapeHtml(sev)}">
    <div class="ev-brief-meta">
      <span class="ev-sev">${escapeHtml(sev)}</span>
      <span class="ev-dist">${escapeHtml(dist)}</span>
    </div>
    <h4>${escapeHtml(event.title)}</h4>
    <p>${escapeHtml(body)}</p>
    <a class="ev-source" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(src)}</a>
  </div>`
}

export function eventCalloutHtml(event) {
  return eventBriefHtml(event)
}

export function assetMarkerHtml(asset) {
  const db = asset.org === 'deutsche-bank'
  const label = db ? `DB ${asset.city}` : asset.name.split(' ')[0]
  const aff = db ? 'friendly' : 'neutral'
  return `<span class="pin pin-${asset.criticality} aff-${aff}${db ? ' pin-db' : ''}" title="${escapeHtml(asset.name)}"><span class="tak-frame pin-frame" aria-hidden="true"></span><i></i><b>${escapeHtml(label)}</b></span>`
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
