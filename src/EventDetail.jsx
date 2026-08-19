import { clock } from './scoring'

export default function EventDetail({ event, onClose, onAck, acknowledged }) {
  if (!event) return null
  const acked = acknowledged.has(event.id)
  const pct = event.impact === 'high' ? 92 : event.impact === 'medium' ? 62 : event.impact === 'low' ? 34 : 8

  return (
    <aside className="detail">
      <div className="detail-tab">Case file · {event.id}</div>
      <div className="detail-inner">
        <div className="detail-head">
          <div>
            <div className="meta">
              <span className={`chip ${event.severity}`}>{event.severity}</span>
              <span className="chip">{event.domain}</span>
              <span className="stamp">{event.source}</span>
            </div>
            <h2>{event.title}</h2>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="lede">{event.summary}</p>
        <div className="kvs">
          <div>
            <span>Filed</span>
            <b>{clock(event.publishedAt)}</b>
          </div>
          <div>
            <span>Event time</span>
            <b>{clock(event.eventAt)}</b>
          </div>
          <div>
            <span>Place</span>
            <b>{event.place}</b>
          </div>
        </div>

        <div className="kvs">
          <div>
            <span>Affects us?</span>
            <b>
              {event.linked
                ? `${event.primary.asset.name} · ${event.primary.km.toFixed(1)} km`
                : 'No — outside all radii'}
            </b>
          </div>
          {event.linked && (
            <div>
              <span>Criticality</span>
              <b>{event.primary.asset.criticality}</b>
            </div>
          )}
        </div>

        {event.db && (
          <div className="kvs">
            <div>
              <span>Nearest DB HQ</span>
              <b>
                {event.db.hq.name}
                {event.db.hq.address ? ` · ${event.db.hq.address}` : ''}
              </b>
            </div>
            <div>
              <span>Occurred</span>
              <b>{clock(event.eventAt)}</b>
            </div>
            <div>
              <span>HQ → incident</span>
              <b>
                {event.db.km.toFixed(1)} km · {event.db.travel.label}
                {event.db.inside ? ' · inside fence' : ' · outside fence'}
              </b>
            </div>
          </div>
        )}

        <div className={`scorebox ${event.impact || 'none'}`}>
          <div className="stamp">ATOM-CORVEX IMPACT ENGINE</div>
          <div className="big">{(event.impact || 'none').toUpperCase()}</div>
          <div className="bar">
            <i style={{ width: `${pct}%`, background: event.impact === 'high' ? 'var(--fire)' : event.impact === 'medium' ? 'var(--brass)' : 'var(--ok)' }} />
          </div>
          {event.factors ? (
            <div className="kvs">
              <div>
                <span>Severity</span>
                <b>{event.factors.severity}</b>
              </div>
              <div>
                <span>Distance</span>
                <b>
                  {event.factors.distance} · {event.factors.inside}
                </b>
              </div>
              <div>
                <span>Asset</span>
                <b>{event.factors.criticality}</b>
              </div>
              <div>
                <span>Category</span>
                <b>{event.factors.category}</b>
              </div>
            </div>
          ) : (
            <p className="stamp">No score — event is not correlated to a registered asset.</p>
          )}
        </div>

        <div className="stamp" style={{ marginBottom: 10 }}>
          {acked
            ? 'Acknowledged · off the bell'
            : event.alert
              ? `ALERT QUEUED → Security Ops · ${clock(event.publishedAt)}`
              : 'No alert (below threshold or unlinked)'}
        </div>
        {event.updates?.length > 0 && (
          <div className="thread-block">
            <div className="stamp">Watch thread</div>
            <ol className="thread">
              {event.updates.map((u, n) => (
                <li key={n}>
                  <span>{clock(u.at)}</span>
                  {u.text}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="actions">
          <button className="primary" onClick={() => onAck(event.id)}>
            {acked ? 'Acknowledged' : 'Acknowledge'}
          </button>
          <button className="ghost" onClick={onClose}>
            Keep on map
          </button>
        </div>
      </div>
    </aside>
  )
}
