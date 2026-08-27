import { CATEGORY_LABELS, SEVERITY_LABELS } from './labels'

export default function SideRail({
  now,
  cats,
  sevs,
  setCats,
  setSevs,
  filteredCount,
  latencyMs,
  log,
  counts = {},
}) {
  const utc = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
  const mix = {
    geopolitical: counts.geo || 0,
    environmental: counts.env || 0,
    security: counts.sec || 0,
  }
  const mixTotal = Math.max(1, mix.geopolitical + mix.environmental + mix.security)

  return (
    <aside className="rail ops-rail">
      <header className="ops-rail-head">
        <div>
          <span className="ops-rail-tag">Filters</span>
          <h3>Refine list</h3>
        </div>
        <span className="ops-rail-time">{utc} UTC</span>
      </header>

      <div className="ops-summary">
        <div className="ops-summary-item">
          <em>{filteredCount}</em>
          <span>Showing</span>
        </div>
        <div className="ops-summary-item">
          <em>{counts.live ?? 0}</em>
          <span>Live</span>
        </div>
        <div className="ops-summary-item warn">
          <em>{counts.forecast ?? 0}</em>
          <span>Forecast</span>
        </div>
      </div>

      <div className="mix ops-mix">
        <span className="stamp">Event mix</span>
        <div className="mix-bar">
          <i className="geo" style={{ width: `${(mix.geopolitical / mixTotal) * 100}%` }} />
          <i className="env" style={{ width: `${(mix.environmental / mixTotal) * 100}%` }} />
          <i className="sec" style={{ width: `${(mix.security / mixTotal) * 100}%` }} />
        </div>
        <div className="mix-keys">
          <span>civil {mix.geopolitical}</span>
          <span>weather {mix.environmental}</span>
          <span>security {mix.security}</span>
        </div>
      </div>

      <div className="src ops-feed">
        <span className="live-dot" />
        Feed
        <b>{latencyMs} ms</b>
      </div>

      <div className="filters ops-filters">
        <div>
          <label>Category</label>
          <div className="chip-rows">
            {Object.keys(cats).map((k) => (
              <button
                key={k}
                type="button"
                className={`fchip ${cats[k] ? 'on' : ''}`}
                onClick={() => setCats((c) => ({ ...c, [k]: !c[k] }))}
              >
                {CATEGORY_LABELS[k] || k}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Severity</label>
          <div className="chip-rows">
            {Object.keys(sevs).map((k) => (
              <button
                key={k}
                type="button"
                className={`fchip ${k} ${sevs[k] ? 'on' : ''}`}
                onClick={() => setSevs((s) => ({ ...s, [k]: !s[k] }))}
              >
                {SEVERITY_LABELS[k] || k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="ops-wire-label">Recent activity</label>
      <ul className="wire ops-wire">
        {log.map((line, i) => (
          <li key={`${line}-${i}`}>{line}</li>
        ))}
      </ul>
    </aside>
  )
}
