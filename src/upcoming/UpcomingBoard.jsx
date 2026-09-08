import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadUpcomingRecords } from './adapter'
import { UPCOMING_DEMO_EVENTS, UPCOMING_DEMO_NOTE } from './fixtures'
import {
  activeFilterChips,
  applyUpcomingFilters,
  clearChip,
  defaultUpcomingFilters,
  filtersAreActive,
  groupByDate,
  groupByWeekThenDate,
  locationOptions,
} from './filters'
import { rangeFromPreset } from './dates'
import { downloadJson, filteredSetExport } from './exportBrief'
import { readFollowed, toggleFollow } from './follow'
import UpcomingToolbar, { UpcomingFilterChips } from './UpcomingToolbar'
import UpcomingAgenda from './UpcomingAgenda'
import UpcomingEventDrawer from './UpcomingEventDrawer'
import UpcomingFiltersDrawer from './UpcomingFiltersDrawer'
import './upcoming.css'

export default function UpcomingBoard({ liveEnriched, onViewMap, nowTs }) {
  const [filters, setFilters] = useState(defaultUpcomingFilters)
  const [moreOpen, setMoreOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [followed, setFollowed] = useState(() => readFollowed())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const scrollerRef = useRef(null)
  const moreBtnRestore = useRef(null)

  const loaded = useMemo(
    () => loadUpcomingRecords({ liveEnriched, demoFixtures: UPCOMING_DEMO_EVENTS, now: nowTs || Date.now() }),
    [liveEnriched, nowTs],
  )

  useEffect(() => {
    setStatus('loading')
    setError(null)
    const t = setTimeout(() => {
      try {
        if (!loaded.records) throw new Error('missing')
        setStatus('ready')
      } catch (err) {
        setError(err)
        setStatus('error')
      }
    }, 40)
    return () => clearTimeout(t)
  }, [loaded])

  const range = useMemo(
    () => rangeFromPreset(filters.preset, filters.custom),
    [filters.preset, filters.custom],
  )

  const visible = useMemo(
    () => applyUpcomingFilters(loaded.records, filters, range),
    [loaded.records, filters, range],
  )

  const dateGroups = useMemo(() => groupByDate(visible, range), [visible, range])
  const weekGroups = useMemo(() => groupByWeekThenDate(visible, range), [visible, range])
  const locations = useMemo(() => locationOptions(loaded.records), [loaded.records])
  const chips = useMemo(() => activeFilterChips(filters), [filters])
  const selected = visible.find((e) => e.id === selectedId) || loaded.records.find((e) => e.id === selectedId)

  const agendaStatus = status === 'ready' && visible.length === 0 ? 'empty' : status

  const closeDrawer = useCallback(() => {
    const id = selectedId
    setSelectedId(null)
    requestAnimationFrame(() => {
      document.getElementById(`upcoming-row-${id}`)?.focus()
    })
  }, [selectedId])

  const openMore = () => {
    moreBtnRestore.current = document.activeElement
    setMoreOpen(true)
  }

  const closeMore = () => {
    setMoreOpen(false)
    requestAnimationFrame(() => {
      if (moreBtnRestore.current && typeof moreBtnRestore.current.focus === 'function') {
        moreBtnRestore.current.focus()
      }
    })
  }

  const exportSet = () => {
    downloadJson('upcoming-events.json', filteredSetExport(visible, {
      ...filters,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
    }))
  }

  return (
    <section className="upcoming-board" aria-label="Upcoming events">
      <header className="upcoming-head">
        <div>
          <h1>Upcoming</h1>
          <p>Events and disruptions to prepare for</p>
        </div>
        <button type="button" className="ghost" onClick={exportSet}>
          Export JSON
        </button>
      </header>

      {loaded.origin === 'demo' && <p className="upcoming-banner">{UPCOMING_DEMO_NOTE}</p>}

      <UpcomingToolbar
        filters={filters}
        locations={locations}
        onChange={setFilters}
        onOpenMore={openMore}
        moreOpen={moreOpen}
      />

      {filtersAreActive(filters) && (
        <UpcomingFilterChips
          chips={chips}
          onClearChip={(id) => setFilters((f) => clearChip(f, id))}
          onClearAll={() => setFilters(defaultUpcomingFilters())}
        />
      )}

      <UpcomingAgenda
        status={agendaStatus}
        emptyHint={
          error
            ? 'Could not load upcoming events.'
            : 'No events overlap this date range and filter set.'
        }
        preset={filters.preset}
        dateGroups={dateGroups}
        weekGroups={weekGroups}
        selectedId={selectedId}
        onSelect={setSelectedId}
        scrollerRef={scrollerRef}
      />

      {moreOpen && (
        <UpcomingFiltersDrawer filters={filters} onChange={setFilters} onClose={closeMore} />
      )}

      {selected && (
        <UpcomingEventDrawer
          event={selected}
          followed={followed.has(selected.id)}
          onFollow={() => setFollowed(toggleFollow(selected.id))}
          onViewMap={onViewMap}
          onClose={closeDrawer}
        />
      )}
    </section>
  )
}
