export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const SEV = { high: 3, medium: 2, low: 1 }
const CRIT = { high: 3, medium: 2, low: 1 }
const CAT = { environmental: 0.15, security: 0.2, geopolitical: 0.1 }

export function travelFromHq(km) {
  if (km < 0.4) return { label: 'on the campus', mins: 1, mode: 'on-site' }
  if (km <= 80) {
    const mins = Math.max(8, Math.round((km / 28) * 60))
    return { label: `${mins} min ground`, mins, mode: 'ground' }
  }
  const mins = Math.round(75 + (km / 780) * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { label: m ? `${h}h ${m}m air` : `${h}h air`, mins, mode: 'air' }
}

export function nearestHq(event, hqs) {
  if (!hqs?.length) return null
  const ranked = hqs
    .map((hq) => ({ hq, km: haversineKm(event.coords, hq.coords) }))
    .sort((a, b) => a.km - b.km)
  const n = ranked[0]
  return {
    hq: n.hq,
    km: n.km,
    inside: n.km <= n.hq.radiusKm,
    travel: travelFromHq(n.km),
  }
}

export function correlate(event, assets) {
  const hits = assets
    .map((asset) => {
      const km = haversineKm(event.coords, asset.coords)
      return { asset, km, inside: km <= asset.radiusKm }
    })
    .filter((h) => h.inside)
    .sort((a, b) => a.km - b.km)

  if (!hits.length) {
    return { linked: false, hits: [], impact: null, raw: 0, factors: null, alert: false }
  }

  const primary = hits[0]
  const distFactor = 1 - primary.km / primary.asset.radiusKm
  const raw =
    SEV[event.severity] * 0.35 +
    CRIT[primary.asset.criticality] * 0.35 +
    distFactor * 3 * 0.2 +
    (CAT[event.category] || 0.1) * 3

  let impact = 'low'
  if (raw >= 2.15) impact = 'high'
  else if (raw >= 1.55) impact = 'medium'

  const factors = {
    severity: event.severity,
    distance: `${primary.km.toFixed(1)} km`,
    inside: `Inside ${primary.asset.radiusKm} km radius`,
    criticality: primary.asset.criticality,
    category: event.domain,
  }

  const alert = impact === 'high' || (impact === 'medium' && primary.asset.criticality === 'high')

  return { linked: true, hits, primary, impact, raw, factors, alert }
}

export function enrich(events, assets) {
  const hqs = assets.filter((a) => a.org === 'deutsche-bank')
  return events.map((ev) => {
    const c = correlate(ev, assets)
    const db = nearestHq(ev, hqs)
    return { ...ev, ...c, db }
  })
}

export function relativeTime(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (ts > Date.now()) {
    const ahead = Math.round((ts - Date.now()) / 3600000)
    if (ahead < 48) return `in ${ahead}h`
    return `in ${Math.round(ahead / 24)}d`
  }
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function clock(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
