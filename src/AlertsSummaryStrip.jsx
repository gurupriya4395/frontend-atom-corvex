const FILTERS = {
  total: 'total',
  nearSites: 'nearSites',
  upcoming: 'upcoming',
  crucial: 'crucial',
  warning: 'warning',
  notification: 'notification',
  informative: 'informative',
  intelligence: 'intelligence',
}

export default function AlertsSummaryStrip({ stats, activeFilter, onFilter, windowLabel = 'live' }) {
  const toggle = (key) => onFilter?.(activeFilter === key ? null : key)

  return (
    <div className="alerts-strip" role="region" aria-label="Alerts summary">
      <div className="alerts-strip-head">
        <span className="alerts-strip-title">Alerts</span>
        <span className="alerts-strip-window">{windowLabel}</span>
      </div>
      <div className="alerts-strip-body">
        <div className="alerts-group">
          <button
            type="button"
            className={`alerts-cell ${activeFilter === FILTERS.total ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.total)}
          >
            <em>{stats.total}</em>
            <span>Total</span>
          </button>
          <button
            type="button"
            className={`alerts-cell ${activeFilter === FILTERS.nearSites ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.nearSites)}
          >
            <em>{stats.nearSites}</em>
            <span>Near sites</span>
          </button>
          <button
            type="button"
            className={`alerts-cell ${activeFilter === FILTERS.upcoming ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.upcoming)}
          >
            <em>{stats.upcoming}</em>
            <span>Upcoming</span>
          </button>
        </div>
        <div className="alerts-divider" />
        <div className="alerts-group">
          <button
            type="button"
            className={`alerts-cell sev-crucial ${activeFilter === FILTERS.crucial ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.crucial)}
          >
            <em>{stats.crucial}</em>
            <span>Crucial</span>
          </button>
          <button
            type="button"
            className={`alerts-cell sev-warning ${activeFilter === FILTERS.warning ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.warning)}
          >
            <em>{stats.warning}</em>
            <span>Warning</span>
          </button>
          <button
            type="button"
            className={`alerts-cell sev-notification ${activeFilter === FILTERS.notification ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.notification)}
          >
            <em>{stats.notification}</em>
            <span>Notification</span>
          </button>
        </div>
        <div className="alerts-divider" />
        <div className="alerts-group">
          <button
            type="button"
            className={`alerts-cell ${activeFilter === FILTERS.informative ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.informative)}
          >
            <em>{stats.informative}</em>
            <span>Informative</span>
          </button>
          <button
            type="button"
            className={`alerts-cell ${activeFilter === FILTERS.intelligence ? 'active' : ''}`}
            onClick={() => toggle(FILTERS.intelligence)}
          >
            <em>{stats.intelligence}</em>
            <span>Intelligence</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export { FILTERS as ALERT_FILTERS }
