import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import EventFeed from './EventFeed'
import EventDetail from './EventDetail'
import SideRail from './SideRail'
import { ASSETS, EVENTS, INCOMING } from './data'
import { enrich, clock } from './scoring'
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
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [acked, setAcked] = useState(() => new Set())
  const [boot, setBoot] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [latencyMs, setLatencyMs] = useState(86)
  const [log, setLog] = useState(['Desk open · waiting on ATOM-CORVEX'])
  const [freshId, setFreshId] = useState(null)
  const [toast, setToast] = useState(null)

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
    if (timeMode === 'history') return e.publishedAt < Date.now() - 6 * 3600 * 1000 && !e.forecast
    return !e.forecast
  })

  const filtered = timed.filter((e) => {
    if (!cats[e.category]) return false
    if (!sevs[e.severity]) return false
    if (q && !`${e.title} ${e.place} ${e.domain}`.toLowerCase().includes(q.toLowerCase())) return false
    if (feedMode === 'proximity' || affectsOnly) return e.linked
    if (feedMode === 'watchlist') return e.alert || e.impact === 'high'
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
  const showRadius = selectedEvent?.linked ? selectedEvent.primary.asset.id : selectedAssetId

  const pickEvent = (id) => {
    setSelectedId(id)
    setSelectedAssetId(null)
    setPage('operations')
  }

  const pickAsset = (id) => {
    setSelectedAssetId(id)
    setSelectedId(null)
    setPage('operations')
    setAffectsOnly(false)
    setFeedMode('geographical')
  }

  const runDesk = () => {
    setPage('operations')
    setTimeMode('live')
    setFeedMode('proximity')
    setAffectsOnly(true)
    setAlertsOpen(false)
    pickEvent('ev-flood-mum')
    window.setTimeout(() => pickEvent('ev-fire-thane'), 2400)
    window.setTimeout(() => setAlertsOpen(true), 4800)
  }

  const ack = (id) => {
    setAcked((s) => new Set(s).add(id))
    setAlertsOpen(false)
  }

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
          <input className="search" placeholder="Search a city or event" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="stamp">{clock(now.getTime())}</span>
          <button className={`bell ${alerts.length ? 'has' : ''} ${alertsOpen ? 'open' : ''}`} onClick={() => setAlertsOpen((v) => !v)} aria-label="Alerts">
            {alerts.length > 0 && <span className="n">{alerts.length}</span>}
            ▴
          </button>
        </div>
      </header>

      {alertsOpen && (
        <div className="alerts-pop">
          <header>Still open</header>
          {alerts.length === 0 && <div className="empty">All quiet. Acknowledged alerts drop off the bell.</div>}
          {alerts.map((a) => (
            <button
              key={a.id}
              className="item"
              onClick={() => {
                pickEvent(a.id)
                setAlertsOpen(false)
              }}
            >
              <strong>{a.impact?.toUpperCase()}</strong>
              <div>{a.title}</div>
              <div className="stamp">
                {a.linked ? `${a.primary.asset.name} · ${a.primary.km.toFixed(1)} km` : 'unlinked'}
              </div>
            </button>
          ))}
        </div>
      )}

      {page === 'assets' ? (
        <div className="assets-page">
          <header className="assets-head">
            <div>
              <h2>Registered sites</h2>
              <p className="stamp">Click a site to throw the fence on the globe.</p>
            </div>
            <span className="stamp">{ASSETS.length} assets on the book</span>
          </header>
          <div className="site-grid">
            {ASSETS.map((a) => {
              const hits = enriched.filter((e) => e.linked && e.primary.asset.id === a.id)
              const hot = hits.some((e) => e.alert && !acked.has(e.id))
              return (
                <article
                  key={a.id}
                  className={`site-card ${hot ? 'hot' : ''}`}
                  onClick={() => pickAsset(a.id)}
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
              setAffectsOnly((v) => !v)
              setFeedMode((m) => (m === 'proximity' && affectsOnly ? 'geographical' : m))
            }}
            allEvents={enriched}
            assets={ASSETS}
            filteredCount={filtered.length}
            latencyMs={latencyMs}
            log={log}
            acked={acked}
            onPickSite={pickAsset}
          />

          <EventFeed
            events={filtered}
            mode={feedMode}
            onMode={(m) => {
              setFeedMode(m)
              if (m === 'proximity') setAffectsOnly(true)
              if (m === 'geographical') setAffectsOnly(false)
            }}
            selectedId={selectedId}
            onSelect={pickEvent}
            now={now}
            counts={counts}
            freshId={freshId}
            acked={acked}
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

      {page === 'operations' && selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedId(null)}
          acknowledged={acked}
          onAck={ack}
        />
      )}
    </div>
  )
}
