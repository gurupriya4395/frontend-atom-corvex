import { CATEGORY_LABELS } from '../labels.js'
import { ALERT_TYPE_LABELS, IMPACT_ORDER, STATUS_LABELS, isActiveStatus } from './model.js'
import { agendaDateKey, formatGroupHeading, formatWeekLabel, overlapsRange, weekKeyFromDateKey } from './dates.js'

export const defaultUpcomingFilters = () => ({
  preset: '7',
  custom: { from: '', to: '' },
  query: '',
  location: '',
  impact: '',
  affectingAssets: false,
  categories: [],
  alertTypes: [],
  statuses: [],
})

export function applyUpcomingFilters(records, filters, range) {
  const q = filters.query.trim().toLowerCase()
  return records.filter((e) => {
    if (!overlapsRange(e, range)) return false
    if (q) {
      const hay = `${e.title} ${e.place} ${e.locationKey}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.location && e.locationKey !== filters.location) return false
    if (filters.impact && e.severity !== filters.impact) return false
    if (filters.affectingAssets && !(e.exposures?.length > 0)) return false
    if (filters.categories.length && !filters.categories.includes(e.category)) return false
    if (filters.alertTypes.length && !filters.alertTypes.includes(e.alertType)) return false
    if (filters.statuses.length && !filters.statuses.includes(e.eventStatus)) return false
    return true
  })
}

export function sortWithinDay(a, b) {
  const impact = (IMPACT_ORDER[b.severity] || 0) - (IMPACT_ORDER[a.severity] || 0)
  if (impact) return impact
  const exp = (b.exposures?.length || 0) - (a.exposures?.length || 0)
  if (exp) return exp
  return a.startsAt - b.startsAt || a.title.localeCompare(b.title)
}

export function sortChronological(a, b) {
  return a.startsAt - b.startsAt || sortWithinDay(a, b)
}

export function activeCount(events) {
  return events.filter((e) => isActiveStatus(e.eventStatus)).length
}

export function exposureCount(events) {
  return events.filter((e) => e.exposures?.length > 0).length
}

export function locationOptions(records) {
  return [...new Set(records.map((e) => e.locationKey).filter(Boolean))].sort()
}

export function groupByDate(events, range, now = Date.now()) {
  const map = new Map()
  for (const event of events) {
    const key = agendaDateKey(event, range, now)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(event)
  }
  const keys = [...map.keys()].sort()
  return keys.map((dateKey) => {
    const items = map.get(dateKey).slice().sort(sortWithinDay)
    return {
      dateKey,
      heading: formatGroupHeading(dateKey, new Date(now)),
      events: items,
      active: activeCount(items),
      exposures: exposureCount(items),
    }
  })
}

export function groupByWeekThenDate(events, range, now = Date.now()) {
  const days = groupByDate(events, range, now)
  const weeks = new Map()
  for (const day of days) {
    const wk = weekKeyFromDateKey(day.dateKey)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk).push(day)
  }
  return [...weeks.keys()].sort().map((weekKey) => {
    const dateGroups = weeks.get(weekKey)
    const flat = dateGroups.flatMap((d) => d.events)
    return {
      weekKey,
      label: formatWeekLabel(weekKey),
      dateGroups,
      active: activeCount(flat),
      exposures: exposureCount(flat),
    }
  })
}

export function activeFilterChips(filters) {
  const chips = []
  if (filters.preset === 'custom' && (filters.custom.from || filters.custom.to)) {
    chips.push({ id: 'dates', label: `${filters.custom.from || '…'} → ${filters.custom.to || '…'}` })
  } else if (filters.preset !== '7') {
    chips.push({ id: 'preset', label: `${filters.preset} days` })
  }
  if (filters.query.trim()) chips.push({ id: 'query', label: `Search: ${filters.query.trim()}` })
  if (filters.location) chips.push({ id: 'location', label: filters.location })
  if (filters.impact) chips.push({ id: 'impact', label: `${filters.impact} impact` })
  if (filters.affectingAssets) chips.push({ id: 'assets', label: 'Affecting my assets' })
  for (const c of filters.categories) chips.push({ id: `cat:${c}`, label: CATEGORY_LABELS[c] || c })
  for (const t of filters.alertTypes) chips.push({ id: `alert:${t}`, label: ALERT_TYPE_LABELS[t] || t })
  for (const s of filters.statuses) chips.push({ id: `status:${s}`, label: STATUS_LABELS[s] || s })
  return chips
}

export function filtersAreActive(filters) {
  return activeFilterChips(filters).length > 0
}

export function clearChip(filters, chipId) {
  if (chipId === 'dates' || chipId === 'preset') {
    return { ...filters, preset: '7', custom: { from: '', to: '' } }
  }
  if (chipId === 'query') return { ...filters, query: '' }
  if (chipId === 'location') return { ...filters, location: '' }
  if (chipId === 'impact') return { ...filters, impact: '' }
  if (chipId === 'assets') return { ...filters, affectingAssets: false }
  if (chipId.startsWith('cat:')) {
    const v = chipId.slice(4)
    return { ...filters, categories: filters.categories.filter((x) => x !== v) }
  }
  if (chipId.startsWith('alert:')) {
    const v = chipId.slice(6)
    return { ...filters, alertTypes: filters.alertTypes.filter((x) => x !== v) }
  }
  if (chipId.startsWith('status:')) {
    const v = chipId.slice(7)
    return { ...filters, statuses: filters.statuses.filter((x) => x !== v) }
  }
  return filters
}
