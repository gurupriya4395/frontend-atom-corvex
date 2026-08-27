function fmtScore(raw) {
  if (raw == null || Number.isNaN(raw)) return '—'
  return raw.toFixed(2)
}

export default function RiskScoreRow({ event, pool = [] }) {
  const linked = pool.filter((e) => e.linked)
  const maxRaw = linked.reduce((m, e) => Math.max(m, e.raw || 0), 0)
  const hot = linked.filter((e) => e.alert).length

  if (event) {
    const raw = event.raw ?? 0
    const pct = Math.min(100, (raw / 3) * 100)
    const asset = event.primary?.asset
    return (
      <div className="risk-row" aria-label="Risk score">
        <span className="risk-row-tag">CORVEX RISK</span>
        <div className="risk-score-main">
          <strong>{fmtScore(raw)}</strong>
          <span>/ 3.00</span>
        </div>
        <div className="risk-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="risk-factors">
          <span className={`risk-chip impact-${event.impact || 'low'}`}>{event.impact || 'low'} impact</span>
          {asset && <span className="risk-chip">{event.primary.km.toFixed(1)} km · {asset.name}</span>}
          {event.alert && <span className="risk-chip alert">Alert</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="risk-row desk" aria-label="Desk risk">
      <span className="risk-row-tag">DESK RISK</span>
      <div className="risk-score-main">
        <strong>{fmtScore(maxRaw)}</strong>
        <span>peak</span>
      </div>
      <div className="risk-factors">
        <span className="risk-chip">{linked.length} near sites</span>
        <span className="risk-chip alert">{hot} alerts</span>
        <span className="risk-chip">{pool.length} on cut</span>
      </div>
    </div>
  )
}
