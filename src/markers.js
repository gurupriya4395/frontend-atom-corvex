export function eventMarkerHtml(event) {
  const impact = event.impact || 'none'
  return `<span class="haz haz-${event.kind} impact-${impact}" title="${escapeHtml(event.title)}">${inner(event.kind)}</span>`
}

export function eventCalloutHtml(event) {
  const sev = event.severity || 'low'
  const km = event.linked ? `${event.primary.km.toFixed(1)} km` : 'Unlinked'
  const site = event.linked ? event.primary.asset.name : event.place.split(',')[0]
  return `<div class="ev-callout sev-${sev}"><em>${escapeHtml(sev)}</em><b>${escapeHtml(km)}</b><span>${escapeHtml(site)}</span></div>`
}

export function assetMarkerHtml(asset) {
  const db = asset.org === 'deutsche-bank'
  const label = db ? `DB ${asset.city}` : asset.name.split(' ')[0]
  return `<span class="pin pin-${asset.criticality}${db ? ' pin-db' : ''}" title="${escapeHtml(asset.name)}"><i></i><b>${escapeHtml(label)}</b></span>`
}

function inner(kind) {
  switch (kind) {
    case 'fire':
      return `<span class="flame"><i></i><i></i><i></i></span><span class="glow"></span>`
    case 'flood':
      return `<span class="ripples"><i></i><i></i><i></i></span><span class="drop"></span>`
    case 'storm':
      return `<span class="cyclone"><svg viewBox="0 0 64 64"><path d="M32 8c8 6 14 10 18 18 3 7-1 14-8 16-9 3-16-2-18-10-1-6 3-10 8-11 4 0 6 3 6 6 0 2-1 4-4 4"/></svg></span>`
    case 'protest':
      return `<span class="crowd"><i></i><i></i><i></i></span>`
    case 'quake':
      return `<span class="shock"><i></i><i></i><i></i></span>`
    case 'security':
      return `<span class="siren"><i></i><b></b></span>`
    case 'haze':
      return `<span class="smoke"><i></i><i></i><i></i></span>`
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
