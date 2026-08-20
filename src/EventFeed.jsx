import { eventMarkerHtml } from './markers'
import { clock } from './scoring'

function isForecastEvent(ev) {
  return Boolean(ev.forecast) || ev.eventAt > Date.now()
}

export default function EventFeed({
  events,
  selectedId,
  onSelect,
  now,
  counts,
  freshId,
  timeMode,
  emptyHint,
}) {
  const modeLabel = timeMode === 'forecast' ? 'Forecast' : timeMode === 'history' ? 'History' : 'Live'
  const n = timeMode === 'forecast' ? counts.forecast : timeMode === 'history' ? events.length : counts.live

  return (
    <aside className="feed">
      <div className="feed-head">
        <div className="feed-title">
          <h2>Proximity</h2>
          <em>{n ?? events.length}</em>
        </div>
        <div className="feed-meta">
          <span className="live-dot" />
          <span>{modeLabel} events</span>
          <span>{now.toLocaleTimeString('en-GB', { hour12: false })}</span>
        </div>
      </div>
      <div className="cards">
        {events.length === 0 && <div className="empty">{emptyHint}</div>}
        {events.map((ev, i) => {
          const assetName = ev.primary?.asset?.name
          const when = clock(ev.eventAt || ev.publishedAt)
          const forecast = isForecastEvent(ev)
          return (
            <button
              key={ev.id}
              className={`card kind-${ev.kind} ${selectedId === ev.id ? 'selected' : ''} ${freshId === ev.id ? 'fresh' : ''}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              onClick={() => onSelect(ev.id)}
            >
              <span className="card-mark" dangerouslySetInnerHTML={{ __html: eventMarkerHtml(ev) }} />
              <span className="card-body">
                <div className="card-kicker">
                  <span className={`chip ${forecast ? 'forecast' : 'ok'}`}>{forecast ? 'forecast' : 'live'}</span>
                  <span className={`chip ${ev.severity}`}>{ev.severity}</span>
                  <span className="ago">{when}</span>
                </div>
                <h3>{ev.title}</h3>
                <p className="why">{ev.summary || ev.why}</p>
                {assetName && <p className="asset-hit">Asset affected · {assetName}</p>}
                <p className="card-date">{when}</p>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
