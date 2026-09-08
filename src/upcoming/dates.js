export function startOfLocalDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfLocalDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function toDateInputValue(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateInput(value, end = false) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return end ? endOfLocalDay(dt) : startOfLocalDay(dt)
}

/** Wall-clock in `timeZone` → UTC millis. India has no DST; other zones use a one-pass offset. */
export function zonedTimestamp(year, monthIndex, day, hour, minute, timeZone) {
  const utc = Date.UTC(year, monthIndex, day, hour, minute, 0)
  const offset = tzClockOffsetMs(new Date(utc), timeZone)
  return utc - offset
}

export function daysFromNowZoned(daysAhead, hour, minute, timeZone) {
  const base = startOfLocalDay(new Date())
  base.setDate(base.getDate() + daysAhead)
  return zonedTimestamp(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, timeZone)
}

function tzClockOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

export function rangeFromPreset(preset, custom, now = new Date()) {
  const start = startOfLocalDay(now)
  if (preset === '7') return { start, end: endOfLocalDay(addDays(start, 6)) }
  if (preset === '30') return { start, end: endOfLocalDay(addDays(start, 29)) }
  if (preset === '90') return { start, end: endOfLocalDay(addDays(start, 89)) }
  const from = parseDateInput(custom?.from) || start
  const to = parseDateInput(custom?.to, true) || endOfLocalDay(addDays(start, 6))
  return from.getTime() <= to.getTime() ? { start: from, end: to } : { start: to, end: endOfLocalDay(from) }
}

export function overlapsRange(event, range) {
  const a = Number(event.startsAt)
  const b = event.endsAt == null ? a : Number(event.endsAt)
  return a <= range.end.getTime() && b >= range.start.getTime()
}

export function isOngoing(event, now = Date.now()) {
  const a = Number(event.startsAt)
  const b = event.endsAt == null ? a : Number(event.endsAt)
  return a <= now && b >= now
}

export function localDateKey(ts, timeZone) {
  const d = new Date(ts)
  if (timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(d)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    )
    return `${parts.year}-${parts.month}-${parts.day}`
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function agendaDateKey(event, range, now = Date.now()) {
  if (isOngoing(event, now)) {
    const today = localDateKey(now, event.timezone)
    const todayTs = parseDateKey(today).getTime()
    if (todayTs >= range.start.getTime() && todayTs <= range.end.getTime()) return today
    return localDateKey(range.start.getTime(), event.timezone)
  }
  return localDateKey(event.startsAt, event.timezone)
}

export function formatGroupHeading(dateKey, now = new Date()) {
  const date = parseDateKey(dateKey)
  const todayKey = localDateKey(now.getTime())
  const tomorrowKey = localDateKey(addDays(startOfLocalDay(now), 1).getTime())
  const weekday = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (dateKey === todayKey) return `Today · ${weekday}`
  if (dateKey === tomorrowKey) return `Tomorrow · ${weekday}`
  return weekday
}

export function startOfWeekMonday(date) {
  const d = startOfLocalDay(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

export function weekKeyFromDateKey(dateKey) {
  return toDateInputValue(startOfWeekMonday(parseDateKey(dateKey)))
}

export function formatWeekLabel(weekStartKey) {
  const start = parseDateKey(weekStartKey)
  const end = addDays(start, 6)
  const a = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const b = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `Week of ${a} – ${b}`
}

function tzName(ts, timeZone) {
  if (!timeZone) return ''
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(new Date(ts))
    .find((p) => p.type === 'timeZoneName')?.value
  return name ? ` ${name}` : ''
}

function formatClock(ts, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

function formatDay(ts, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || undefined,
    day: 'numeric',
    month: 'long',
  }).format(new Date(ts))
}

export function formatSchedule(event) {
  const tz = event.timezone || undefined
  const day = formatDay(event.startsAt, tz)
  const zone = tzName(event.startsAt, event.timezone)
  if (!event.timeConfirmed) return `${day} · Time not confirmed.`
  if (event.endsAt == null) {
    return `${day}, ${formatClock(event.startsAt, tz)}${zone}`
  }
  const sameDay = localDateKey(event.startsAt, event.timezone) === localDateKey(event.endsAt, event.timezone)
  if (sameDay) {
    return `${day}, ${formatClock(event.startsAt, tz)}–${formatClock(event.endsAt, tz)}${zone}`
  }
  return `${day}, ${formatClock(event.startsAt, tz)} – ${formatDay(event.endsAt, tz)}, ${formatClock(event.endsAt, tz)}${zone}`
}

export function formatDateTime(ts, timeZone) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || undefined,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: timeZone ? 'short' : undefined,
  }).format(new Date(ts))
}
