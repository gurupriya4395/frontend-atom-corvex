import { CATEGORY_LABELS } from '../labels'
import { relativeTime } from '../scoring'
import { IMPACT_LABELS, STATUS_LABELS, exposureLabel } from './model'
import { formatSchedule, isOngoing } from './dates'

export default function UpcomingEventRow({ event, selected, onSelect }) {
  const primary = event.exposures?.[0]
  const ongoing = isOngoing(event)

  return (
    <button
      type="button"
      id={`upcoming-row-${event.id}`}
      className={`upcoming-row ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
    >
      <div className="upcoming-row-kicker">
        <span className={`chip ${event.severity}`}>{IMPACT_LABELS[event.severity] || event.severity}</span>
        <span className="chip">{STATUS_LABELS[event.eventStatus] || event.eventStatus}</span>
        {ongoing && <span className="chip">Ongoing</span>}
      </div>
      <h3>{event.title}</h3>
      <p className="upcoming-row-place">
        {event.locationKey || event.place} · {formatSchedule(event)}
      </p>
      {primary && (
        <p className="upcoming-row-exp">
          {exposureLabel(primary.evidence)}: {primary.assetName} — {primary.reason}
        </p>
      )}
      <p className="upcoming-row-meta">
        {CATEGORY_LABELS[event.category] || event.category}
        {event.updatedAt ? ` · Updated ${relativeTime(event.updatedAt)}` : ''}
      </p>
    </button>
  )
}
