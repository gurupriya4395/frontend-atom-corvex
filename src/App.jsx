import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import EventFeed from './EventFeed'
import SideRail from './SideRail'
import { ASSETS, DEMO, EVENTS, INCOMING } from './data'
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
  const [horizon, setHorizon] = useState('all')
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

  const timed = enriched.filter((e) => {
    const isForecast = Boolean(e.forecast) || e.eventAt > Date.now()
    if (timeMode === 'history') return e.publishedAt < Date.now() - 4 * 3600 * 1000 && !isForecast
    if (timeMode === 'forecast') return isForecast
    return true
  })

  const needle = q.trim().toLowerCase()
  const catsOn = Object.values(cats).some(Boolean)
  const sevsOn = Object.values(sevs).some(Boolean)

  const prox = timed.filter((e) => {
    if (!cats[e.category] || !sevs[e.severity]) return false
    if (needle && !searchHay(e).includes(needle)) return false
    if (siteFilterId) return e.linked && e.primary.asset.id === siteFilterId
    return e.linked
  })

  const isForecastEvent = (e) => Boolean(e.forecast) || e.eventAt > Date.now()
  const filtered = prox.filter((e) => {
    if (horizon === 'live') return !isForecastEvent(e)
    if (horizon === 'forecast') return isForecastEvent(e)
    return true
  })

  const counts = {
    geo: timed.filter((e) => cats[e.category] && sevs[e.severity]).length,
    prox: prox.length,
    live: prox.filter((e) => !isForecastEvent(e)).length,
    forecast: prox.filter((e) => isForecastEvent(e)).length,
    watch: timed.filter((e) => (e.alert || e.impact === 'high') && cats[e.category] && sevs[e.severity]).length,
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
  const siteName = siteFilterId ? ASSETS.find((a) => a.id === siteFilterId)?.name : null

  const emptyHint = (() => {
    if (!catsOn || !sevsOn) return 'Turn a Desk or Weight chip back on.'
    if (needle) return `No match for “${q}”. Try a city, HQ, or kind (flood, fire).`
    if (timeMode === 'history') return 'Nothing older than 4h in this desk cut. Switch to Live.'
    if (horizon === 'forecast') return 'No forecast events near our sites in this cut.'
    if (horizon === 'live') return 'No live events near our sites in this cut.'
    if (siteFilterId) return `No hits on ${siteName}.`
    return 'No live or forecast events near our sites in this cut.'
  })()

  const pickEvent = (id, opts = {}) => {
    setSelectedId(id)
    setSelectedAssetId(null)
    setSiteFilterId(null)
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

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">ATOM-CORVEX</span>
          <span className="brand-sub">Eyes on operations</span>
        </div>
        <nav className="nav">
          <button className={page === 'operations' ? 'active' : ''} onClick={() => setPage('operations')}>
            Floor
          </button>
          <button className={page === 'assets' ? 'active' : ''} onClick={() => setPage('assets')}>
            Sites
          </button>
        </nav>
        <div className="top-right">
          <button className="ghost run-desk" type="button" onClick={runDesk}>
            Run desk
          </button>
          <input
            ref={searchRef}
            className="search"
            placeholder="Search city, HQ, flood…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) pickEvent(filtered[0].id)
            }}
          />
          <span className="stamp">{clock(now.getTime())}</span>
        </div>
      </header>

      {page === 'assets' ? (
        <div className="assets-page">
          <header className="assets-head">
            <div>
              <h2>Registered sites</h2>
              <p className="stamp">Exposure on the book — click a site to throw its fence and filter the desk.</p>
            </div>
            <span className="stamp">{ASSETS.length} assets · DB HQs worldwide</span>
          </header>
          <div className="site-grid">
            {ASSETS.map((a) => {
              const hits = enriched.filter((e) => e.linked && e.primary.asset.id === a.id)
              const hot = hits.find((e) => e.alert)
              return (
                <article
                  key={a.id}
                  className={`site-card ${hot ? 'hot' : ''}`}
                  onClick={() => pickAsset(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      pickAsset(a.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="site-ring" aria-hidden>
                    <i style={{ '--r': `${Math.min(100, a.radiusKm * 2.2)}%` }} />
                  </div>
                  <div className="site-body">
                    <div className="meta">
                      <span className={`chip ${a.criticality}`}>{a.criticality}</span>
                      <span className="chip">{a.type}</span>
                    </div>
                    <h3>{a.name}</h3>
                    <p>
                      {a.city}, {a.country}
                    </p>
                    {hot ? (
                      <p className="site-hotline">
                        {hot.kind} · {hot.primary.km.toFixed(1)} km · {hot.title}
                      </p>
                    ) : (
                      <p className="site-hotline quiet">Quiet — no open alert</p>
                    )}
                    <div className="site-stats">
                      <span>
                        Fence <b>{a.radiusKm} km</b>
                      </span>
                      <span>
                        Hits <b>{hits.length}</b>
                      </span>
                      <span className={hot ? 'hot' : ''}>
                        <span className={`status-dot ${hot ? 'hot' : ''}`} />
                        {hot ? 'Hot' : 'Quiet'}
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="ops">
          <Suspense fallback={<div className="map-wrap globe-msg">Raising the globe…</div>}>
            <GlobeMap
              events={filtered}
              assets={ASSETS}
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
            />
          </Suspense>

          <SideRail
            now={now}
            cats={cats}
            sevs={sevs}
            setCats={setCats}
            setSevs={setSevs}
            affectsOnly={affectsOnly}
            onAffects={() => {
              setAffectsOnly((v) => {
                const next = !v
                setFeedMode((m) => {
                  if (next) return 'proximity'
                  if (m === 'proximity') return 'geographical'
                  return m
                })
                return next
              })
            }}
            allEvents={enriched}
            assets={ASSETS}
            filteredCount={filtered.length}
            latencyMs={latencyMs}
            log={log}
            onPickSite={pickAsset}
            siteFilterId={siteFilterId}
          />

          <EventFeed
            events={filtered}
            selectedId={selectedId}
            onSelect={(id) => pickEvent(id, { map: true })}
            now={now}
            counts={counts}
            freshId={freshId}
            timeMode={timeMode}
            siteName={siteName}
            emptyHint={emptyHint}
            horizon={horizon}
            onHorizon={setHorizon}
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
                if (x < 0.36) setTimeMode('history')
                else if (x > 0.64) setTimeMode('forecast')
                else setTimeMode('live')
              }}
            >
              <i className={`head ${timeMode}`} />
              <span className="t0">−24h</span>
              <span className="t1">now</span>
              <span className="t2">+90d</span>
            </div>
            <div className="time-dock">
              {['live', 'forecast', 'history'].map((m) => (
                <button key={m} className={timeMode === m ? 'active' : ''} onClick={() => setTimeMode(m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
