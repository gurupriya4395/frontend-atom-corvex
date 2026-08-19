import { clock, hqLine, soWhat } from './scoring'

export default function EventDetail({ event, onClose, onAck, acknowledged }) {
  if (!event) return null
  const acked = acknowledged.has(event.id)
  const sw = soWhat(event)
  const hq = hqLine(event)
  const latestIdx = (event.updates?.length || 0) - 1

  return (
    <aside className="detail">
      <div className="detail-tab">Case file · {sw.verdict === 'alert' ? 'act' : sw.verdict === 'on-us' ? 'on us' : 'watch'}</div>
      <div className="detail-inner">
        <div className="detail-head">
          <div>
            <div className="meta">
              <span className={`chip ${event.severity}`}>{event.severity}</span>
              <span className="chip">{event.domain}</span>
              {event.forecast && <span className="chip">forecast</span>}
            </div>
            <h2>{event.title}</h2>
            <p className="place-stamp">
              {event.place} · {clock(event.eventAt)}
            </p>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={`verdict ${sw.verdict}`}>
          <span>{sw.verdict === 'alert' ? 'Affects us — alert' : sw.verdict === 'on-us' ? 'Affects us' : 'Awareness only'}</span>
          <b>{sw.line}</b>
          <p>{sw.why}</p>
        </div>

        {event.db && (
          <div className={`hq-card ${event.db.inside ? 'in' : 'out'}`}>
            <span>Nearest DB HQ</span>
            <b>
              {event.db.hq.name}
              {event.db.hq.address ? ` · ${event.db.hq.address}` : ''}
            </b>
            <p>{hq}</p>
          </div>
        )}

        <div className={`scorebox ${event.impact || 'none'}`}>
          <div className="stamp">Impact</div>
          <div className="big">{(event.impact || 'none').toUpperCase()}</div>
          <p className="score-why">{sw.scoreWhy}</p>
          {event.factors && (
            <div className="factor-row">
              <span>{event.factors.severity}</span>
              <span>{event.factors.distance}</span>
              <span>{event.factors.criticality} site</span>
            </div>
          )}
        </div>

        <p className="lede">{event.summary}</p>

        <div className="ack-status">
          {acked
            ? 'Acknowledged · off the bell'
            : event.alert
              ? `Alert queued → Security Ops · ${clock(event.publishedAt)}`
              : 'No alert — below threshold or unlinked'}
        </div>

        {event.updates?.length > 0 && (
          <div className="thread-block">
            <div className="stamp">Watch thread</div>
            <ol className="thread">
              {event.updates.map((u, n) => (
                <li key={n} className={n === latestIdx ? 'is-latest' : ''}>
                  <span>
                    {clock(u.at)}
                    {n === latestIdx ? ' · Latest' : ''}
                  </span>
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
