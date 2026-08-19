import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import EventFeed from './EventFeed'
import EventDetail from './EventDetail'
import SideRail from './SideRail'
import ImpactStage from './ImpactStage'
import { ASSETS, DEMO, EVENTS, INCOMING } from './data'
import { DESK_BEATS } from './sequence'
import { enrich, clock, searchHay, soWhat } from './scoring'
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
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [acked, setAcked] = useState(() => new Set())
  const [boot, setBoot] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [latencyMs, setLatencyMs] = useState(86)
  const [log, setLog] = useState(['Desk open · waiting on ATOM-CORVEX'])
  const [freshId, setFreshId] = useState(null)
  const [toast, setToast] = useState(null)
  const [cue, setCue] = useState(null)
  const [mapMode, setMapMode] = useState('globe')
  const [briefOpen, setBriefOpen] = useState(false)
  const [scene, setScene] = useState({
    pulse: false,
    flood: false,
    warehouse: false,
    distance: false,
    scoring: false,
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
    if (timeMode === 'forecast') return e.forecast || e.eventAt > Date.now()
    if (timeMode === 'history') return e.publishedAt < Date.now() - 4 * 3600 * 1000 && !e.forecast
    return !e.forecast
  })

  const needle = q.trim().toLowerCase()
  const catsOn = Object.values(cats).some(Boolean)
  const sevsOn = Object.values(sevs).some(Boolean)

  const filtered = timed.filter((e) => {
    if (!cats[e.category] || !sevs[e.severity]) return false
    if (needle && !searchHay(e).includes(needle)) return false
    if (siteFilterId) return e.linked && e.primary.asset.id === siteFilterId
    if (feedMode === 'watchlist') return e.alert || e.impact === 'high'
    if (feedMode === 'proximity') return e.linked
    if (affectsOnly) return e.linked
    return true
  })

  const counts = {
    geo: timed.filter((e) => cats[e.category] && sevs[e.severity]).length,
    prox: timed.filter((e) => e.linked && cats[e.category] && sevs[e.severity]).length,
    watch: timed.filter((e) => (e.alert || e.impact === 'high') && cats[e.category] && sevs[e.severity]).length,
  }

  const selectedEvent = enriched.find((e) => e.id === selectedId)
  const selected =
    selectedId != null
      ? { type: 'event', id: selectedId }
      : selectedAssetId
        ? { type: 'asset', id: selectedAssetId }
        : null
  const alerts = enriched.filter((e) => e.alert && !acked.has(e.id))
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
    if (timeMode === 'forecast') return 'No forecast items in this cut.'
    if (siteFilterId) return `No live hits on ${siteName}. Open Geo or pick another site.`
    if (feedMode === 'proximity') return 'Nothing near our sites. Open Geo, or switch off “Near our sites”.'
    if (feedMode === 'watchlist') return 'No watch alerts in this cut.'
    return 'Nothing in this cut.'
  })()

  const pickEvent = (id, opts = {}) => {
    setSelectedId(id)
    setSelectedAssetId(null)
    setSiteFilterId(null)
    setPage('operations')
    setBriefOpen(opts.brief !== false)
  }

  const pickAsset = (id) => {
    setSelectedAssetId(id)
    setSelectedId(null)
    setSiteFilterId(id)
    setPage('operations')
    setAffectsOnly(false)
    setFeedMode('geographical')
    setBriefOpen(false)
  }

  const resetScene = () =>
    setScene({ pulse: false, flood: false, warehouse: false, distance: false, scoring: false })

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
    setAlertsOpen(false)
    setBriefOpen(false)
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
          setCue(beat.cue)
          if (beat.mapMode) setMapMode(beat.mapMode)
          setScene((s) => ({
            pulse: beat.pulse ?? s.pulse,
            flood: beat.flood ?? s.flood,
            warehouse: beat.warehouse ?? s.warehouse,
            distance: beat.distance ?? s.distance,
            scoring: beat.scoring ?? s.scoring,
          }))
          if (beat.select) pickEvent(DEMO.eventId, { brief: false })
          if (beat.brief) {
            pickEvent(DEMO.eventId, { brief: true })
            setScene((s) => ({ ...s, scoring: false }))
          }
          if (beat.alerts) setAlertsOpen(true)
        }, beat.at),
      )
    })
  }

  const ack = (id) => {
    const next = new Set(acked).add(id)
    const left = enriched.filter((e) => e.alert && !next.has(e.id)).length
    setAcked(next)
    setAlertsOpen(false)
    setToast({ title: left ? `Bell · ${left} still open` : 'Bell clear', place: 'Acknowledged' })
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
        setBriefOpen(false)
        setAlertsOpen(false)
        setCue(null)
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
          <button
            className={`bell ${alerts.length ? 'has' : ''} ${alertsOpen ? 'open' : ''}`}
            onClick={() => setAlertsOpen((v) => !v)}
            aria-label="Alerts"
          >
            {alerts.length > 0 && <span className="n">{alerts.length}</span>}
            ▴
          </button>
        </div>
      </header>

      {alertsOpen && (
        <div className="alerts-pop">
          <header>
            Still open <em>{alerts.length}</em>
          </header>
          {alerts.length === 0 && <div className="empty">All quiet. Acknowledged alerts drop off the bell.</div>}
          {alerts.map((a) => (
            <div key={a.id} className="alert-row">
              <button
                className="item"
                onClick={() => {
                  pickEvent(a.id)
                  setAlertsOpen(false)
                }}
              >
                <strong>{(a.impact || 'alert').toUpperCase()}</strong>
                <div className="so-line">{soWhat(a).line}</div>
                <div className="stamp">{a.title}</div>
              </button>
              <button className="ack-mini" type="button" onClick={() => ack(a.id)}>
                Ack
              </button>
            </div>
          ))}
        </div>
      )}

      {page === 'assets' ? (
        <div className="assets-page">
          <header className="assets-head">
            <div>
              <h2>Registered sites</h2>
              <p className="stamp">Exposure on the book — click a site to throw its fence and filter the desk.</p>
            </div>
            <span className="stamp">{ASSETS.length} assets</span>
          </header>
          <div className="site-grid">
            {ASSETS.map((a) => {
              const hits = enriched.filter((e) => e.linked && e.primary.asset.id === a.id)
              const hot = hits.find((e) => e.alert && !acked.has(e.id))
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
                if (sel.type === 'event') pickEvent(sel.id)
                if (sel.type === 'asset') pickAsset(sel.id)
              }}
              showRadiusFor={showRadius}
              acked={acked}
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
            acked={acked}
            onPickSite={pickAsset}
            siteFilterId={siteFilterId}
          />

          <EventFeed
            events={filtered}
            mode={feedMode}
            onMode={(m) => {
              setFeedMode(m)
              setSiteFilterId(null)
              if (m === 'proximity') setAffectsOnly(true)
              if (m === 'geographical') setAffectsOnly(false)
            }}
            selectedId={selectedId}
            onSelect={pickEvent}
            now={now}
            counts={counts}
            freshId={freshId}
            acked={acked}
            timeMode={timeMode}
            siteName={siteName}
            emptyHint={emptyHint}
          />

          {cue && <div className="desk-cue">{cue}</div>}

          {scene.scoring && selectedEvent && <ImpactStage event={selectedEvent} />}

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

      {page === 'operations' && selectedEvent && briefOpen && (
        <EventDetail
          event={selectedEvent}
          onClose={() => {
            setSelectedId(null)
            setBriefOpen(false)
          }}
          acknowledged={acked}
          onAck={ack}
        />
      )}
    </div>
  )
}
