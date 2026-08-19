export default function SideRail({
  now,
  cats,
  sevs,
  setCats,
  setSevs,
  affectsOnly,
  onAffects,
  allEvents,
  assets,
  filteredCount,
  latencyMs,
  log,
  acked,
  onPickSite,
}) {
  const atRisk = assets.filter((a) =>
    allEvents.some((e) => e.linked && e.primary.asset.id === a.id && e.alert && !acked?.has(e.id)),
  ).length
  const live = allEvents.filter((e) => !e.forecast).length
  const alerts = allEvents.filter((e) => e.alert && !acked?.has(e.id)).length
  const mix = {
    geopolitical: allEvents.filter((e) => e.category === 'geopolitical').length,
    environmental: allEvents.filter((e) => e.category === 'environmental').length,
    security: allEvents.filter((e) => e.category === 'security').length,
  }
  const mixTotal = Math.max(1, mix.geopolitical + mix.environmental + mix.security)
  const utc = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
  const loc = now.toLocaleTimeString('en-GB', { hour12: false })

  return (
    <aside className="rail">
      <div className="rail-clock">
        <div>
          <span className="stamp">UTC</span>
          <b>{utc}</b>
        </div>
        <div>
          <span className="stamp">Local</span>
          <b>{loc}</b>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <em>{live}</em>
          <span>Live signals</span>
        </div>
        <div className="kpi warn">
          <em>{atRisk}</em>
          <span>Sites hot</span>
        </div>
        <div className="kpi">
          <em>{alerts}</em>
          <span>Alerts</span>
        </div>
      </div>

      <div className="mix">
        <span className="stamp">Mix · {filteredCount} on globe</span>
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

      <div className="src">
        <span className="live-dot" />
        ATOM-CORVEX link
        <b>{latencyMs} ms</b>
      </div>

      <div className="toggle" onClick={onAffects} role="button" tabIndex={0}>
        <strong>Near our sites</strong>
        <div className={`switch ${affectsOnly ? 'on' : ''}`}>
          <i />
        </div>
      </div>

      <label>Desk</label>
      <div className="chip-rows">
        {Object.keys(cats).map((k) => (
          <button
            key={k}
            className={`fchip ${cats[k] ? 'on' : ''}`}
            onClick={() => setCats((c) => ({ ...c, [k]: !c[k] }))}
          >
            {k}
            <em>{mix[k] || 0}</em>
          </button>
        ))}
      </div>
      <label>Weight</label>
      <div className="chip-rows">
        {Object.keys(sevs).map((k) => (
          <button
            key={k}
            className={`fchip ${k} ${sevs[k] ? 'on' : ''}`}
            onClick={() => setSevs((s) => ({ ...s, [k]: !s[k] }))}
          >
            {k}
          </button>
        ))}
      </div>

      <label>Sites</label>
      <ul className="asset-live">
        {assets.map((a) => {
          const hits = allEvents.filter((e) => e.linked && e.primary.asset.id === a.id)
          const hot = hits.some((e) => e.alert && !acked?.has(e.id))
          return (
            <li key={a.id} className={hot ? 'hot' : ''} onClick={() => onPickSite?.(a.id)}>
              <span className={`status-dot ${hot ? 'hot' : ''}`} />
              <span className="an">{a.name}</span>
              <b>{hits.length}</b>
            </li>
          )
        })}
      </ul>

      <label>Wire</label>
      <ul className="wire">
        {log.map((line, i) => (
          <li key={`${line}-${i}`}>{line}</li>
        ))}
      </ul>
    </aside>
  )
}
