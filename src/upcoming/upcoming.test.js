import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adaptLiveEvent, loadUpcomingRecords } from './adapter.js'
import {
  addDays,
  overlapsRange,
  rangeFromPreset,
  startOfLocalDay,
} from './dates.js'
import { applyUpcomingFilters, defaultUpcomingFilters, sortWithinDay } from './filters.js'

describe('upcoming date overlap', () => {
  it('includes events that start before the range and end inside it', () => {
    const start = startOfLocalDay(new Date('2026-09-08T12:00:00'))
    const range = { start, end: addDays(start, 7) }
    const event = {
      startsAt: addDays(start, -2).getTime(),
      endsAt: addDays(start, 1).getTime(),
    }
    assert.equal(overlapsRange(event, range), true)
  })

  it('includes date-only events with missing end as an instant on start', () => {
    const start = startOfLocalDay(new Date('2026-09-08T12:00:00'))
    const range = { start, end: addDays(start, 7) }
    const event = { startsAt: addDays(start, 3).getTime(), endsAt: null }
    assert.equal(overlapsRange(event, range), true)
  })

  it('excludes events that end before the range starts', () => {
    const start = startOfLocalDay(new Date('2026-09-08T12:00:00'))
    const range = { start, end: addDays(start, 7) }
    const event = {
      startsAt: addDays(start, -5).getTime(),
      endsAt: addDays(start, -1).getTime() - 1,
    }
    assert.equal(overlapsRange(event, range), false)
  })

  it('builds a 7-day preset from local start of today', () => {
    const now = new Date('2026-09-08T15:30:00')
    const range = rangeFromPreset('7', {}, now)
    assert.equal(range.start.getHours(), 0)
    assert.ok(range.end.getTime() > range.start.getTime())
  })
})

describe('upcoming sort and filters', () => {
  it('prioritizes higher impact then asset exposure within a day', () => {
    const low = { severity: 'low', exposures: [{ id: 1 }], startsAt: 2, title: 'a' }
    const highBare = { severity: 'high', exposures: [], startsAt: 3, title: 'b' }
    const highExp = { severity: 'high', exposures: [{ id: 1 }], startsAt: 9, title: 'c' }
    const sorted = [low, highBare, highExp].sort(sortWithinDay)
    assert.equal(sorted[0], highExp)
    assert.equal(sorted[1], highBare)
    assert.equal(sorted[2], low)
  })

  it('filters by scheduled overlap not publication', () => {
    const start = startOfLocalDay(new Date('2026-09-08T12:00:00'))
    const range = { start, end: addDays(start, 7) }
    const records = [
      { title: 'In', place: 'Pune', locationKey: 'Pune', startsAt: addDays(start, 1).getTime(), endsAt: null, severity: 'low', exposures: [], category: 'security', alertType: 'intelligence', eventStatus: 'scheduled' },
      { title: 'Out', place: 'Pune', locationKey: 'Pune', startsAt: addDays(start, 20).getTime(), endsAt: null, severity: 'high', exposures: [], category: 'security', alertType: 'intelligence', eventStatus: 'scheduled' },
    ]
    const filters = { ...defaultUpcomingFilters(), query: 'pune' }
    const out = applyUpcomingFilters(records, filters, range)
    assert.equal(out.length, 1)
    assert.equal(out[0].title, 'In')
  })
})

describe('upcoming adapter isolation', () => {
  it('uses demo fixtures when live events have no schedule model', () => {
    const live = [{ id: 'ev-1', title: 'Live flood', forecast: true, eventAt: Date.now() + 86400000 }]
    const demo = [{ id: 'demo-1', startsAt: Date.now() + 86400000, endsAt: null }]
    const loaded = loadUpcomingRecords({ liveEnriched: live, demoFixtures: demo })
    assert.equal(loaded.origin, 'demo')
    assert.equal(loaded.mixed, false)
    assert.equal(loaded.records[0].id, 'demo-1')
  })

  it('uses only live records when a schedule model is present', () => {
    const live = [
      {
        id: 'ev-live',
        title: 'Scheduled live',
        place: 'Pune',
        eventAt: Date.now() + 86400000,
        startsAt: Date.now() + 86400000,
        eventStatus: 'scheduled',
        severity: 'low',
        category: 'security',
      },
    ]
    const demo = [{ id: 'demo-1', startsAt: Date.now() + 86400000 }]
    const loaded = loadUpcomingRecords({ liveEnriched: live, demoFixtures: demo })
    assert.equal(loaded.origin, 'live')
    assert.equal(loaded.records.length, 1)
    assert.equal(loaded.records[0].id, 'ev-live')
    assert.equal(loaded.records[0].dataOrigin, 'live')
  })

  it('maps live source fields without inventing probabilities', () => {
    const adapted = adaptLiveEvent({
      id: 'x',
      title: 'T',
      place: 'Mumbai, India',
      eventAt: 1,
      publishedAt: 1,
      severity: 'high',
      category: 'environmental',
      source: 'Reuters',
      sourceUrl: 'https://example.invalid',
      hits: [{ asset: { id: 'a', name: 'Mumbai Warehouse' }, km: 2.2 }],
      why: 'Gate delay.',
    })
    assert.equal(adapted.alertType, 'informative')
    assert.equal(adapted.exposures[0].evidence, 'potential')
    assert.equal(adapted.eventStatus, 'scheduled')
    assert.ok(!('probability' in adapted))
  })
})
