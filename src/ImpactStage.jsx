import { useEffect, useState } from 'react'

export default function ImpactStage({ event }) {
  const [shown, setShown] = useState(0)
  const rows = event.linked
    ? [
        ['Severity', event.severity.toUpperCase()],
        ['Distance', `${event.primary.km.toFixed(1)} km · inside ${event.primary.asset.radiusKm} km fence`],
        ['Asset', `${event.primary.asset.name} · ${event.primary.asset.criticality} criticality`],
        ['Category', event.domain],
      ]
    : [['Status', 'Unlinked · awareness only']]

  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown((n) => n + 1), 380)
    return () => clearInterval(t)
  }, [event.id])

  const ready = shown >= rows.length

  return (
    <div className="impact-stage" aria-live="polite">
      <div className="impact-card">
        <span className="stamp">ATOM-CORVEX IMPACT ENGINE</span>
        <ol>
          {rows.slice(0, shown).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </li>
          ))}
        </ol>
        {ready && (
          <div className={`impact-result ${event.impact || 'none'}`}>
            <em>Calculated</em>
            <strong>{(event.impact || 'none').toUpperCase()} IMPACT</strong>
            <p>{event.alert ? 'Alert queued → Security Ops' : 'No alert threshold'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
