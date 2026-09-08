export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exposurePayload(e) {
  return (e.exposures || []).map((x) => ({
    assetId: x.assetId,
    assetName: x.assetName,
    evidence: x.evidence || 'potential',
    reason: x.reason,
  }))
}

export function eventBrief(event) {
  return {
    format: 'atom-corvex-upcoming-brief',
    mimeHint: 'application/json',
    exportedAt: new Date().toISOString(),
    event: {
      id: event.id,
      dataOrigin: event.dataOrigin,
      title: event.title,
      place: event.place,
      timezone: event.timezone,
      startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : null,
      endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : null,
      timeConfirmed: event.timeConfirmed,
      eventStatus: event.eventStatus,
      severity: event.severity,
      category: event.category,
      alertType: event.alertType,
      expectedImpact: event.expectedImpact,
      exposures: exposurePayload(event),
      preparation: event.preparation,
      sources: event.sources,
      lastVerifiedAt: event.lastVerifiedAt ? new Date(event.lastVerifiedAt).toISOString() : null,
      updatedAt: event.updatedAt ? new Date(event.updatedAt).toISOString() : null,
      history: event.history,
      summary: event.summary,
    },
  }
}

export function filteredSetExport(events, filters) {
  return {
    format: 'atom-corvex-upcoming-set',
    mimeHint: 'application/json',
    exportedAt: new Date().toISOString(),
    filters,
    events: events.map((e) => eventBrief(e).event),
  }
}

export function slugTitle(title) {
  return String(title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}
