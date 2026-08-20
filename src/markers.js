export function eventMarkerHtml(event) {
  const impact = event.impact || 'none'
  return `<span class="haz haz-${event.kind} impact-${impact}" title="${escapeHtml(event.title)}">${inner(event.kind)}</span>`
}

export function eventSourceHref(event) {
  if (event.sourceUrl && !/datasurfr/i.test(event.sourceUrl)) return event.sourceUrl
  return 'https://www.reuters.com/world/'
}

export function eventBriefHtml(event) {
  const body = event.summary || event.why || ''
  const src = event.source && !/datasurfr|atom-corvex/i.test(event.source) ? event.source : 'Reuters'
  const href = eventSourceHref(event)
  const when = event.eventAt || event.publishedAt
  const date = when
    ? new Date(when).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  const asset = event.primary?.asset?.name
  return `<div class="ev-brief">
    <h4>${escapeHtml(event.title)}</h4>
    <p>${escapeHtml(body)}</p>
    ${asset ? `<p class="ev-brief-asset">Asset affected · ${escapeHtml(asset)}</p>` : ''}
    ${date ? `<p class="ev-brief-date">${escapeHtml(date)}</p>` : ''}
    <a class="ev-source" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(src)}</a>
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
