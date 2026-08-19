import { eventMarkerHtml } from './markers'
import { relativeTime, soWhat } from './scoring'

export default function EventFeed({
  events,
  mode,
  onMode,
  selectedId,
  onSelect,
  now,
  counts,
  freshId,
  timeMode,
  siteName,
  emptyHint,
}) {
  const headline = events[0] ? soWhat(events[0]).line : 'Waiting on the wire…'

  return (
    <aside className="feed">
      <div className="feed-head">
        <div className="ticker" key={headline}>
          <span>ON WIRE</span>
          <p>{headline}</p>
        </div>
        <div className="feed-tabs">
          {[
            ['geographical', 'Geo', counts.geo],
            ['proximity', 'Prox', counts.prox],
            ['watchlist', 'Watch', counts.watch],
          ].map(([m, label, n]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => onMode(m)}>
              {label}
              <em>{n}</em>
            </button>
          ))}
        </div>
        <div className="feed-meta">
          <span className="live-dot" />
          <span>{siteName ? `Site · ${siteName}` : `${timeMode} desk`}</span>
          <span>{now.toLocaleTimeString('en-GB', { hour12: false })}</span>
        </div>
      </div>
      <div className="cards">
        {events.length === 0 && <div className="empty">{emptyHint}</div>}
        {events.map((ev, i) => {
          const sw = soWhat(ev)
          const latest = ev.updates?.length ? ev.updates[ev.updates.length - 1] : null
          return (
            <button
              key={ev.id}
              className={`card kind-${ev.kind} impact-${ev.impact || 'none'} ${selectedId === ev.id ? 'selected' : ''} ${freshId === ev.id ? 'fresh' : ''}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              onClick={() => onSelect(ev.id)}
            >
              <span className="card-mark" dangerouslySetInnerHTML={{ __html: eventMarkerHtml(ev) }} />
              <span className="card-body">
                <div className="card-kicker">
                  <span className={`chip ${ev.severity}`}>{ev.severity}</span>
                  {ev.forecast && <span className="chip">forecast</span>}
                  {ev.alert && <span className="chip high">alert</span>}
                  <span className="ago">{relativeTime(ev.publishedAt)}</span>
                </div>
                <p className={`so-line ${sw.verdict}`}>{sw.line}</p>
                <h3>{ev.title}</h3>
                <p className="why">{sw.why}</p>
                {mode === 'watchlist' && latest && (
                  <div className="latest">
                    <em>Latest</em> {latest.text}
                  </div>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
