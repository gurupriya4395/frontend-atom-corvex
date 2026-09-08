import { categoryToAlertType } from './model.js'

export function adaptLiveEvent(event) {
  const start = event.startsAt ?? event.eventAt ?? event.publishedAt
  const locationKey = (event.place || '').split(',')[0].trim()
  const exposures = (event.hits || []).map((h) => ({
    assetId: h.asset.id,
    assetName: h.asset.name,
    evidence: 'potential',
    reason: event.why || `${h.km.toFixed(1)} km inside the ${h.asset.name} modeled radius.`,
  }))

  return {
    id: event.id,
    dataOrigin: 'live',
    title: event.title,
    place: event.place,
    locationKey,
    coords: event.coords || null,
    timezone: event.timezone || null,
    startsAt: start,
    endsAt: event.endsAt ?? null,
    timeConfirmed: event.timeConfirmed ?? Boolean(event.eventAt),
    eventStatus: event.eventStatus || 'scheduled',
    severity: event.severity,
    category: event.category,
    alertType: event.alertType || categoryToAlertType(event.category),
    expectedImpact: event.expectedImpact || {
      disruption: event.summary,
      activities: [],
    },
    exposures,
    preparation: event.preparation || (event.why ? { kind: 'suggested', items: [event.why] } : null),
    sources: event.source
      ? [{ title: event.source, url: event.sourceUrl || null, publishedAt: event.publishedAt }]
      : [],
    lastVerifiedAt: event.lastVerifiedAt || event.publishedAt,
    updatedAt: event.updatedAt || event.publishedAt,
    history: (event.updates || []).map((u) => ({
      at: u.at,
      kind: 'advisory',
      text: u.text,
    })),
    summary: event.summary,
    linked: event.linked,
    rawEvent: event,
  }
}

function isScheduleComplete(event) {
  return Boolean(event.startsAt || event.eventStatus || event.endsAt || event.timezone)
}

export function isUpcomingRecord(record, now = Date.now()) {
  const end = record.endsAt ?? record.startsAt
  return end >= now || record.startsAt >= now
}

/**
 * Live upcoming records are used only when source events already carry a schedule model
 * (startsAt / eventStatus / timezone). Sparse `forecast` flags on the ops feed are not
 * treated as that API. Demo fixtures are never concatenated with live rows.
 */
export function loadUpcomingRecords({ liveEnriched, demoFixtures, now = Date.now() }) {
  const completeLive = (liveEnriched || []).filter(isScheduleComplete)
  const live = completeLive.map(adaptLiveEvent).filter((e) => isUpcomingRecord(e, now))
  if (live.length > 0) {
    return { records: live, origin: 'live', mixed: false }
  }
  return { records: demoFixtures || [], origin: 'demo', mixed: false }
}
