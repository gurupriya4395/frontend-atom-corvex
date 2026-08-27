import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import EventFeed from './EventFeed'
import SideRail from './SideRail'
import { ASSETS, DEMO, EVENTS, GLOBE_ASSETS, INDIA_ASSETS, INCOMING } from './data'
import { DESK_BEATS } from './sequence'
import { enrich, clock, searchHay } from './scoring'
import './index.css'
import './markers.css'

const GlobeMap = lazy(() => import('./GlobeMap'))

export default function App() {
  const [raw, setRaw] = useState(EVENTS)
  const enriched = useMemo(() => enrich(raw, ASSETS), [raw])
  const [page, setPage] = useState('operations')
  const [timeMode, setTimeMode] = useState('live')
  const [feedMode, setFeedMode] = useState('proximity')
  const [q, setQ] = useState('')
  const [affectsOnly, setAffectsOnly] = useState(true)
  const [cats, setCats] = useState({ geopolitical: true, environmental: true, security: true })
  const [sevs, setSevs] = useState({ high: true, medium: true, low: true })
  const [selectedId, setSelectedId] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [siteFilterId, setSiteFilterId] = useState(null)
  const [boot, setBoot] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [latencyMs, setLatencyMs] = useState(86)
  const [log, setLog] = useState(['Desk open · waiting on ATOM-CORVEX'])
  const [freshId, setFreshId] = useState(null)
  const [toast, setToast] = useState(null)
  const [mapMode, setMapMode] = useState('globe')
  const [scene, setScene] = useState({
    pulse: false,
    flood: false,
    warehouse: false,
    distance: false,
  })
  const searchRef = useRef(null)
  const cueTimers = useRef([])

  useEffect(() => {
    const t = setTimeout(() => setBoot(false), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setLatencyMs(70 + Math.floor(Math.random() * 55)), 2800)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      if (i >= INCOMING.length) return
      const item = INCOMING[i]
      i += 1
      const at = Date.now()
      if (item.threadId) {
        setRaw((prev) =>
          prev.map((e) =>
            e.id === item.threadId
              ? { ...e, publishedAt: at, updates: [...(e.updates || []), { at, text: item.text }] }
              : e,
          ),
        )
        setFreshId(item.threadId)
        setToast({ title: 'Watch update', place: item.text })
        setLog((lines) => [`Update · ${item.threadId}`, ...lines].slice(0, 6))
        return
      }
      const next = { ...item, publishedAt: at, eventAt: at }
      setRaw((prev) => [next, ...prev.filter((e) => e.id !== next.id)])
      setFreshId(next.id)
      setToast({ title: next.title, place: next.place })
      setLog((lines) => [`${next.place.split(',')[0]} · ${next.kind}`, ...lines].slice(0, 6))
    }, 11000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!freshId && !toast) return
    const t = setTimeout(() => {
      setFreshId(null)
      setToast(null)
    }, 4200)
    return () => clearTimeout(t)
  }, [freshId, toast])

  const TWO_DAYS_MS = 2 * 86400 * 1000
  const isForecastEvent = (e) => Boolean(e.forecast) || e.eventAt > Date.now()
  const inNextTwoDays = (e) => {
    const at = e.eventAt || e.publishedAt
    return at > Date.now() && at <= Date.now() + TWO_DAYS_MS
  }

  const timed = enriched.filter((e) => {
    if (timeMode === 'forecast') return isForecastEvent(e) && inNextTwoDays(e)
    return !isForecastEvent(e)
  })

  const needle = q.trim().toLowerCase()
  const catsOn = Object.values(cats).some(Boolean)
  const sevsOn = Object.values(sevs).some(Boolean)

  const listed = timed.filter((e) => {
    if (e.flag !== 'IN') return false
    if (!cats[e.category] || !sevs[e.severity]) return false
    if (needle && !searchHay(e).includes(needle)) return false
    return true
  })
  const globeEvents = listed
  const filtered = listed

  const counts = {
    geo: timed.filter((e) => e.flag === 'IN' && cats[e.category] && sevs[e.severity]).length,
    prox: listed.length,
    live: enriched.filter((e) => e.flag === 'IN' && !isForecastEvent(e) && cats[e.category] && sevs[e.severity]).length,
    forecast: enriched.filter(
      (e) => e.flag === 'IN' && isForecastEvent(e) && inNextTwoDays(e) && cats[e.category] && sevs[e.severity],
    ).length,
    watch: timed.filter((e) => e.flag === 'IN' && (e.alert || e.impact === 'high') && cats[e.category] && sevs[e.severity])
      .length,
  }

  const selectedEvent = enriched.find((e) => e.id === selectedId)
  const selected =
    selectedId != null
      ? { type: 'event', id: selectedId }
      : selectedAssetId
        ? { type: 'asset', id: selectedAssetId }
        : null
  const showRadius = scene.warehouse
    ? DEMO.assetId
    : selectedEvent?.linked
      ? selectedEvent.primary.asset.id
      : selectedAssetId

  const selectedAsset = selectedAssetId ? ASSETS.find((a) => a.id === selectedAssetId) : null
  const focusPoint = selectedEvent?.coords
    ? {
        lat: selectedEvent.coords[1],
        lng: selectedEvent.coords[0],
        label: selectedEvent.place?.split(',')[0] || selectedEvent.title,
        type: 'event',
      }
    : selectedAsset?.coords
      ? {
          lat: selectedAsset.coords[1],
          lng: selectedAsset.coords[0],
          label: selectedAsset.name,
          type: 'asset',
        }
      : null

  const emptyHint = (() => {
    if (!catsOn || !sevsOn) return 'Turn a Desk or Weight chip back on.'
    if (needle) return `No match for “${q}”. Try a city, HQ, or kind (flood, fire).`
    if (timeMode === 'forecast') return 'No forecast events in the next 2 days.'
    return 'No live events on the desk right now.'
  })()

  const pickEvent = (id, opts = {}) => {
    setSelectedId(id)
    setSelectedAssetId(null)
    setPage('operations')
    if (opts.map) setMapMode('map')
  }

  const pickAsset = (id, opts = {}) => {
    setSelectedAssetId(id)
    setSelectedId(null)
    setSiteFilterId(id)
    setPage('operations')
    setFeedMode('proximity')
    if (opts.map) setMapMode('map')
  }

  useEffect(() => {
    if (mapMode !== 'map' || selectedId || selectedAssetId) return
    const first = filtered.find((e) => e.linked) || filtered[0]
    if (first) setSelectedId(first.id)
  }, [mapMode, filtered, selectedId, selectedAssetId])

  const clearSelection = () => {
    setSelectedId(null)
    setSelectedAssetId(null)
    setSiteFilterId(null)
    setScene((s) => ({ ...s, pulse: false, warehouse: false }))
  }

  const resetScene = () =>
    setScene({ pulse: false, flood: false, warehouse: false, distance: false })

  const clearCueTimers = () => {
    cueTimers.current.forEach(clearTimeout)
    cueTimers.current = []
  }

  const runDesk = () => {
    clearCueTimers()
    setPage('operations')
    setTimeMode('live')
    setFeedMode('proximity')
    setAffectsOnly(true)
    setSiteFilterId(null)
    setSelectedId(null)
    setSelectedAssetId(null)
    setQ('')
    setCats({ geopolitical: true, environmental: true, security: true })
    setSevs({ high: true, medium: true, low: true })
    setMapMode('globe')
    resetScene()
    DESK_BEATS.forEach((beat) => {
      cueTimers.current.push(
        window.setTimeout(() => {
          if (beat.mapMode) setMapMode(beat.mapMode)
          setScene((s) => ({
            pulse: beat.pulse ?? s.pulse,
            flood: beat.flood ?? s.flood,
            warehouse: beat.warehouse ?? s.warehouse,
            distance: beat.distance ?? s.distance,
          }))
          if (beat.select) pickEvent(DEMO.eventId, { map: beat.mapMode === 'map' })
          if (beat.brief) pickEvent(DEMO.eventId, { map: true })
        }, beat.at),
      )
    })
  }

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        clearCueTimers()
        resetScene()
        setSelectedId(null)
        searchRef.current?.blur()
      }
      if ((e.key === 'r' || e.key === 'R') && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        runDesk()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enriched])

  return (
    <div className="app">
      {boot && (
        <div className="boot">
          <div className="boot-inner">
            <span className="boot-tag">GSOC · DEMO</span>
            <h1>ATOM-CORVEX</h1>
            <p>Raising the desk · CORVEX on the wire</p>
            <ol className="boot-steps">
              <li>Ingest</li>
              <li>Correlate</li>
              <li>Score</li>
              <li>Alert</li>
            </ol>
            <div className="scan">
              <i />
            </div>
          </div>
        </div>
      )}

      <header className="topbar ops-topbar">
        <div className="brand">
          <span className="brand-mark">ATOM-CORVEX</span>
          <span className="ops-mode-badge">SATELLITE</span>
        </div>
        <div className="topbar-coords" aria-live="polite">
          {focusPoint ? (
            <>
              <span className="topbar-coords-label">TARGET · {focusPoint.label}</span>
              <span className="topbar-coords-val">LAT {focusPoint.lat.toFixed(5)}°</span>
              <span className="topbar-coords-val">LON {focusPoint.lng.toFixed(5)}°</span>
            </>
          ) : (
            <span className="topbar-coords-hint">Select an event or site for latitude / longitude</span>
          )}
        </div>
        <div className="top-right">
          <span className="ops-live-pill">
            <span className="live-dot" />
            LIVE DESK
          </span>
          <button className="ghost run-desk" type="button" onClick={runDesk}>
            Run desk
          </button>
          <input
            ref={searchRef}
            className="search ops-search"
            placeholder="Search city, HQ, flood…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) pickEvent(filtered[0].id)
            }}
          />
          <span className="stamp ops-clock">{clock(now.getTime())}</span>
        </div>
      </header>

      <div className="ops">
          <Suspense fallback={<div className="map-wrap globe-msg">Raising the globe…</div>}>
            <GlobeMap
              events={globeEvents}
              assets={GLOBE_ASSETS}
              mapEvents={filtered}
              mapAssets={INDIA_ASSETS}
              selected={selected}
              onSelect={(sel) => {
                if (!sel) {
                  clearSelection()
                  return
                }
                if (sel.type === 'event') pickEvent(sel.id, { map: true })
                if (sel.type === 'asset') pickAsset(sel.id, { map: true })
              }}
              showRadiusFor={showRadius}
              timeMode={timeMode}
              mapMode={mapMode}
              onMapMode={setMapMode}
              scene={scene}
              pulseEventId={scene.pulse ? DEMO.eventId : null}
              highlightAssetId={scene.warehouse ? DEMO.assetId : null}
              focusPoint={focusPoint}
            />
          </Suspense>

          <SideRail
            now={now}
            cats={cats}
            sevs={sevs}
            setCats={setCats}
            setSevs={setSevs}
            filteredCount={filtered.length}
            latencyMs={latencyMs}
            log={log}
            focusPoint={focusPoint}
            counts={{
              live: counts.live,
              forecast: counts.forecast,
              geo: enriched.filter((e) => e.flag === 'IN' && e.category === 'geopolitical').length,
              env: enriched.filter((e) => e.flag === 'IN' && e.category === 'environmental').length,
              sec: enriched.filter((e) => e.flag === 'IN' && e.category === 'security').length,
            }}
          />

          <EventFeed
            events={filtered}
            selectedId={selectedId}
            onSelect={(id) => pickEvent(id, { map: true })}
            now={now}
            counts={counts}
            freshId={freshId}
            timeMode={timeMode}
            emptyHint={emptyHint}
          />

          {toast && (
            <div className="wire-toast">
              <span>ON WIRE</span>
              <b>{toast.title}</b>
              <em>{toast.place}</em>
            </div>
          )}

          <div className="time-strip">
            <button type="button" className="ghost" onClick={runDesk}>
              Replay
            </button>
            <div
              className="track"
              onClick={(e) => {
                const x = e.nativeEvent.offsetX / e.currentTarget.clientWidth
                setTimeMode(x > 0.5 ? 'forecast' : 'live')
              }}
            >
              <i className={`head ${timeMode}`} />
              <span className="t0">now</span>
              <span className="t2">+2d</span>
            </div>
            <div className="time-dock">
              {['live', 'forecast'].map((m) => (
                <button key={m} type="button" className={timeMode === m ? 'active' : ''} onClick={() => setTimeMode(m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
    </div>
  )
}
