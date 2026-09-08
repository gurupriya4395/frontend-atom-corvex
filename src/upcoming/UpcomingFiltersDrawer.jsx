import { useEffect, useRef } from 'react'
import { CATEGORY_LABELS } from '../labels'
import { ALERT_TYPE_LABELS, EVENT_STATUSES, STATUS_LABELS } from './model'

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

export default function UpcomingFiltersDrawer({ filters, onChange, onClose }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    closeRef.current?.focus()
    const root = panelRef.current
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      if (e.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll('button, input, [href]')].filter((el) => !el.disabled)
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
    return () => {
      root?.removeEventListener('keydown', onKey)
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [onClose])

  const set = (patch) => onChange({ ...filters, ...patch })

  return (
    <>
      <div className="upcoming-scrim" onClick={onClose} />
      <aside
        ref={panelRef}
        className="upcoming-more"
        id="upcoming-more-filters"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upcoming-more-title"
      >
        <div className="upcoming-more-head">
          <h2 id="upcoming-more-title">More filters</h2>
          <button ref={closeRef} type="button" className="upcoming-x" aria-label="Close filters" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="upcoming-body">
          <fieldset>
            <legend>Category</legend>
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(id)}
                  onChange={() => set({ categories: toggleIn(filters.categories, id) })}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Alert type</legend>
            {Object.entries(ALERT_TYPE_LABELS).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={filters.alertTypes.includes(id)}
                  onChange={() => set({ alertTypes: toggleIn(filters.alertTypes, id) })}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Event status</legend>
            {EVENT_STATUSES.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(id)}
                  onChange={() => set({ statuses: toggleIn(filters.statuses, id) })}
                />
                {STATUS_LABELS[id]}
              </label>
            ))}
          </fieldset>
        </div>
      </aside>
    </>
  )
}
