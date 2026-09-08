import UpcomingEventRow from './UpcomingEventRow'

export default function UpcomingDateGroup({ group, selectedId, onSelect }) {
  const countLine = `${group.active} ${group.active === 1 ? 'event' : 'events'} · ${group.exposures} with potential asset exposure`
  return (
    <section className="upcoming-date-group" aria-labelledby={`up-day-${group.dateKey}`}>
      <div className="upcoming-date-head">
        <h2 id={`up-day-${group.dateKey}`}>{group.heading}</h2>
        <p>{countLine}</p>
      </div>
      {group.events.map((event) => (
        <UpcomingEventRow
          key={event.id}
          event={event}
          selected={selectedId === event.id}
          onSelect={onSelect}
        />
      ))}
    </section>
  )
}
