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
const RANK = { none: 0, low: 1, medium: 2, high: 3 }

export function riskFromEvent(event) {
  if (event?.severity === 'high' || event?.severity === 'medium' || event?.severity === 'low') return event.severity
  return 'low'
}

export function exposureFromHits(hits) {
  if (!hits?.length) return { level: 'none', primary: null, hits: [] }
  const primary = hits[0]
  const km = primary.km
  const crit = primary.asset.criticality
  const frac = km / Math.max(primary.asset.radiusKm, 0.001)
  let level = 'low'
  if (km <= 3 || (crit === 'high' && km <= 5) || frac <= 0.2) level = 'high'
  else if (crit === 'high' || km <= 8 || frac <= 0.5) level = 'medium'
  else level = 'low'
  return { level, primary, hits }
}

export function alertPriority(risk, exposure) {
  if (exposure === 'none') return 'none'
  const r = RANK[risk] || 0
  const x = RANK[exposure] || 0
  if (x >= 3 && r >= 2) return 'high'
  if (r + x >= 5) return 'high'
  if (r + x >= 4) return 'medium'
  if (r + x >= 3) return 'low'
  return 'none'
}

export function needsAttention(priority) {
  return priority === 'high' || priority === 'medium'
}

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
  if (!hqs?.length || !event.coords) return null
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

function emptyCorrelation(event) {
  const risk = riskFromEvent(event)
  return {
    linked: false,
    hits: [],
    primary: null,
    impact: null,
    raw: 0,
    factors: null,
    risk,
    exposure: 'none',
    alertPriority: 'none',
    alert: false,
  }
}

export function correlate(event, assets) {
  const risk = riskFromEvent(event)
  if (!event.coords) return emptyCorrelation(event)

  const hits = assets
    .filter((asset) => Array.isArray(asset.coords))
    .map((asset) => {
      const km = haversineKm(event.coords, asset.coords)
      return { asset, km, inside: km <= asset.radiusKm }
    })
    .filter((h) => h.inside)
    .sort((a, b) => a.km - b.km)

  const exp = exposureFromHits(hits)
  const priority = alertPriority(risk, exp.level)

  if (!hits.length) {
    return { ...emptyCorrelation(event), risk, exposure: 'none', alertPriority: 'none', alert: false }
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
    risk,
    exposure: exp.level,
    alertPriority: priority,
  }

  return {
    linked: true,
    hits,
    primary,
    impact,
    raw,
    factors,
    risk,
    exposure: exp.level,
    alertPriority: priority,
    alert: needsAttention(priority),
  }
}

export function soWhat(event) {
  const risk = event.risk || riskFromEvent(event)
  const exposure = event.exposure || 'none'
  const priority = event.alertPriority || 'none'
  if (priority === 'none' || !event.alert) {
    return {
      verdict: exposure === 'none' ? 'event' : 'low',
      line:
        exposure === 'none'
          ? `Event yes · Risk ${risk} · Exposure none · not an alert`
          : `Event yes · Risk ${risk} · Exposure ${exposure} · Alert ${priority}`,
      why: event.why || 'Nobody needs to be paged until this sits on one of our assets.',
      scoreWhy: 'Alert requires both risk and exposure. A serious event with no ATOM footprint stays an event.',
    }
  }
  const asset = event.primary?.asset
  const km = event.primary ? `${event.primary.km.toFixed(1)} km` : '—'
  return {
    verdict: 'alert',
    line: `Alert ${priority} · Risk ${risk} · Exposure ${exposure}${asset ? ` · ${asset.name} ${km}` : ''}`,
    why: event.why || `${asset?.name || 'An asset'} is exposed. Somebody needs to pay attention.`,
    scoreWhy: `Factal-style proximity: verified event × ${exposure} exposure on a ${asset?.criticality || 'registered'} site. Dataminr-style correlation turns that into an alert, not another headline.`,
  }
}

export function hqLine(event) {
  if (!event.db) return null
  const side = event.db.inside ? 'inside HQ fence' : 'outside HQ fence'
  return `${event.db.hq.name} · ${event.db.km.toFixed(1)} km · ${event.db.travel.label} · ${side}`
}

export function searchHay(event) {
  return [
    event.title,
    event.place,
    event.domain,
    event.kind,
    event.category,
    event.why,
    event.primary?.asset?.name,
    event.primary?.asset?.city,
    event.db?.hq?.name,
    event.db?.hq?.city,
    event.db ? `DB ${event.db.hq.city}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
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
