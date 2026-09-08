import { useEffect, useRef } from 'react'
import { CATEGORY_LABELS } from '../labels'
import { ALERT_TYPE_LABELS, IMPACT_LABELS, STATUS_LABELS, exposureLabel } from './model'
import { formatDateTime, formatSchedule } from './dates'
import { eventBrief, downloadJson, slugTitle } from './exportBrief'
import { followHint } from './follow'

const HISTORY_LABELS = {
  scheduled: 'Date set',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  advisory: 'Advisory',
  completed: 'Completed',
}

export default function UpcomingEventDrawer({
  event,
  followed,
  onFollow,
  onViewMap,
  onClose,
}) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const canMap = Array.isArray(event.coords) && event.coords.length >= 2

  useEffect(() => {
    closeRef.current?.focus()
    const root = panelRef.current
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      if (e.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll('button, a[href], input, select, textarea')].filter((el) => !el.disabled)
      if (!items.length) return
      const i = items.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault()
        items[0].focus()
      }
    }
    root?.addEventListener('keydown', onKey)
    return () => root?.removeEventListener('keydown', onKey)
  }, [event.id, onClose])

  const exportBrief = () => {
    downloadJson(`upcoming-brief-${slugTitle(event.title)}.json`, eventBrief(event))
  }

  return (
    <>
      <div className="upcoming-scrim" onClick={onClose} />
      <aside
        ref={panelRef}
        className="upcoming-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upcoming-drawer-title"
      >
        <div className="upcoming-drawer-head">
          <div>
            <div className="upcoming-row-kicker">
              <span className={`chip ${event.severity}`}>{IMPACT_LABELS[event.severity]}</span>
              <span className="chip">{STATUS_LABELS[event.eventStatus]}</span>
              <span className="chip">{ALERT_TYPE_LABELS[event.alertType]}</span>
            </div>
            <h2 id="upcoming-drawer-title">{event.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="upcoming-x" aria-label="Close event details" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="upcoming-body">
          <section className="upcoming-section">
            <h3>Overview</h3>
            <dl className="upcoming-dl">
              <dt>Location</dt>
              <dd>{event.place}</dd>
              <dt>Schedule</dt>
              <dd>{formatSchedule(event)}</dd>
              <dt>Timezone</dt>
              <dd>{event.timezone || 'Not specified'}</dd>
              <dt>Status</dt>
              <dd>{STATUS_LABELS[event.eventStatus]}</dd>
              <dt>Alert type</dt>
              <dd>{ALERT_TYPE_LABELS[event.alertType]}</dd>
              <dt>Category</dt>
              <dd>{CATEGORY_LABELS[event.category] || event.category}</dd>
            </dl>
          </section>

          <section className="upcoming-section">
            <h3>Expected impact</h3>
            <p>{event.expectedImpact?.disruption || event.summary || 'No disruption summary in this record.'}</p>
            {event.expectedImpact?.activities?.length > 0 && (
              <ul>
                {event.expectedImpact.activities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="upcoming-section">
            <h3>Relevant assets</h3>
            {event.exposures?.length ? (
              <ul>
                {event.exposures.map((x) => (
                  <li key={`${x.assetId || x.assetName}`}>
                    <strong>{x.assetName}</strong> — {exposureLabel(x.evidence)}: {x.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No registered asset sits inside a modeled radius. That is not confirmation they are unaffected.
              </p>
            )}
          </section>

          <section className="upcoming-section">
            <h3>Preparation</h3>
            {event.preparation?.items?.length ? (
              <>
                <p>
                  {event.preparation.kind === 'analyst'
                    ? 'Analyst guidance'
                    : 'Suggested actions (from available text, not a live playbook)'}
                </p>
                <ul>
                  {event.preparation.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No preparation guidance in this record.</p>
            )}
          </section>

          <section className="upcoming-section">
            <h3>Sources</h3>
            {event.sources?.length ? (
              <ul>
                {event.sources.map((s) => (
                  <li key={`${s.title}-${s.publishedAt}`}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                    {s.publishedAt ? ` · published ${formatDateTime(s.publishedAt, event.timezone)}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No sources in this record.</p>
            )}
            <p>Last verified {formatDateTime(event.lastVerifiedAt, event.timezone)}</p>
          </section>

          <section className="upcoming-section">
            <h3>Update history</h3>
            {event.history?.length ? (
              <ol>
                {event.history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    {formatDateTime(h.at, event.timezone)} · {HISTORY_LABELS[h.kind] || h.kind}: {h.text}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No history in this record.</p>
            )}
          </section>
        </div>

        <div className="upcoming-actions">
          <button type="button" className="ghost" onClick={onFollow} aria-pressed={followed}>
            {followed ? 'Following' : 'Follow event'}
          </button>
          <button type="button" className="ghost" onClick={() => canMap && onViewMap(event)} disabled={!canMap}>
            View on map
          </button>
          <button type="button" className="ghost" onClick={exportBrief}>
            Export brief (JSON)
          </button>
        </div>
        <p className="upcoming-hint">{followHint()}</p>
        {!canMap && (
          <p className="upcoming-hint upcoming-map-miss">Map geometry is not available for this event.</p>
        )}
      </aside>
    </>
  )
}
