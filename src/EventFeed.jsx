import { relativeTime } from './scoring'

export default function EventFeed({
  events,
  mode,
  onMode,
  selectedId,
  onSelect,
  now,
  counts,
  freshId,
  acked,
}) {
  const headline = events[0]?.title || 'Waiting on the wire…'

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
          <span>ATOM-CORVEX desk</span>
          <span>{now.toLocaleTimeString('en-GB', { hour12: false })}</span>
        </div>
      </div>
      <div className="cards">
        {events.length === 0 && (
          <div className="empty">Nothing in this cut. Open Geographical, or switch off “Near our sites”.</div>
        )}
        {events.map((ev, i) => (
          <button
            key={ev.id}
            className={`card kind-${ev.kind} impact-${ev.impact || 'none'} ${selectedId === ev.id ? 'selected' : ''} ${freshId === ev.id ? 'fresh' : ''} ${acked?.has(ev.id) ? 'acked' : ''}`}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            onClick={() => onSelect(ev.id)}
          >
            <span dangerouslySetInnerHTML={{ __html: marker(ev) }} />
            <span>
              <div className="meta">
                <span className={`chip ${ev.severity}`}>{ev.severity}</span>
                <span className="ago">{relativeTime(ev.publishedAt)}</span>
                {ev.impact === 'high' && <span className="chip high">on us</span>}
              </div>
              <h3>{ev.title}</h3>
              {ev.linked ? (
                <div className="affects">
                  {ev.primary.asset.name} · {ev.primary.km.toFixed(1)} km
                </div>
              ) : (
                <div className="unlinked">Off our map</div>
              )}
              {mode === 'watchlist' && ev.updates?.length > 0 && (
                <ol className="thread">
                  {ev.updates.slice(-3).map((u, n) => (
                    <li key={`${ev.id}-u-${n}`}>{u.text}</li>
                  ))}
                </ol>
              )}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function marker(ev) {
  return `<span class="haz haz-${ev.kind} impact-${ev.impact || 'none'}">${inner(ev.kind)}</span>`
}

function inner(kind) {
  const map = {
    fire: `<span class="flame"><i></i><i></i><i></i></span><span class="glow"></span>`,
    flood: `<span class="ripples"><i></i><i></i><i></i></span><span class="drop"></span>`,
    storm: `<span class="cyclone"><svg viewBox="0 0 64 64"><path d="M32 8c8 6 14 10 18 18 3 7-1 14-8 16-9 3-16-2-18-10-1-6 3-10 8-11 4 0 6 3 6 6 0 2-1 4-4 4"/></svg></span>`,
    protest: `<span class="crowd"><i></i><i></i><i></i></span>`,
    quake: `<span class="shock"><i></i><i></i><i></i></span>`,
    security: `<span class="siren"><i></i><b></b></span>`,
    haze: `<span class="smoke"><i></i><i></i><i></i></span>`,
  }
  return map[kind] || `<span class="dot"></span>`
}
