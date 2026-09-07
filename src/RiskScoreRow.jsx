function fmtScore(raw) {
  if (raw == null || Number.isNaN(raw)) return '—'
  return raw.toFixed(2)
}

const IMPACT_LABELS = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
}

export default function RiskScoreRow({ event, pool = [] }) {
  const linked = pool.filter((e) => e.linked)
  const maxRaw = linked.reduce((m, e) => Math.max(m, e.raw || 0), 0)
  const hot = linked.filter((e) => e.alert).length

  if (event) {
    const raw = event.raw ?? 0
    const pct = Math.min(100, (raw / 3) * 100)
    const asset = event.primary?.asset
    const impact = event.impact || 'low'
    return (
      <div className="risk-row" aria-label="Risk score">
        <span className="risk-row-tag">Risk score</span>
        <div className="risk-score-main">
          <strong>{fmtScore(raw)}</strong>
          <span>of 3</span>
        </div>
        <div className="risk-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="risk-factors">
          <span className={`risk-chip impact-${impact}`}>{IMPACT_LABELS[impact] || impact}</span>
          {asset && <span className="risk-chip">{event.primary.km.toFixed(1)} km · {asset.name}</span>}
          {event.alert && <span className="risk-chip alert">Needs attention</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="risk-row desk" aria-label="Desk overview">
      <span className="risk-row-tag">Overview</span>
      <div className="risk-score-main">
        <strong>{fmtScore(maxRaw)}</strong>
        <span>peak score</span>
      </div>
      <div className="risk-factors">
        <span className="risk-chip">{linked.length} near assets</span>
        <span className="risk-chip alert">{hot} flagged</span>
        <span className="risk-chip">{pool.length} active</span>
      </div>
    </div>
  )
}
