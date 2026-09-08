import UpcomingDateGroup from './UpcomingDateGroup'

export default function UpcomingAgenda({
  status,
  emptyHint,
  preset,
  dateGroups,
  weekGroups,
  selectedId,
  onSelect,
  scrollerRef,
}) {
  return (
    <div className="upcoming-agenda" ref={scrollerRef} tabIndex={-1}>
      {status === 'loading' && <p className="upcoming-status">Loading upcoming events…</p>}
      {status === 'error' && <p className="upcoming-status">Could not load upcoming events.</p>}
      {status === 'empty' && <p className="upcoming-empty">{emptyHint}</p>}
      {status === 'ready' && preset === '90' &&
        weekGroups.map((week) => (
          <details key={week.weekKey} className="upcoming-week" open>
            <summary>
              {week.label}{' '}
              <span className="upcoming-week-meta">
                · {week.active} active · {week.exposures} with potential asset exposure
              </span>
            </summary>
            {week.dateGroups.map((group) => (
              <UpcomingDateGroup key={group.dateKey} group={group} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </details>
        ))}
      {status === 'ready' && preset !== '90' &&
        dateGroups.map((group) => (
          <UpcomingDateGroup key={group.dateKey} group={group} selectedId={selectedId} onSelect={onSelect} />
        ))}
    </div>
  )
}
