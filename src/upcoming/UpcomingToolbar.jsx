import { SEVERITY_LABELS } from '../labels'
import { toDateInputValue, addDays, startOfLocalDay } from './dates'

export default function UpcomingToolbar({
  filters,
  locations,
  onChange,
  onOpenMore,
  moreOpen,
}) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const presets = [
    ['7', '7 days'],
    ['30', '30 days'],
    ['90', '90 days'],
    ['custom', 'Custom'],
  ]

  return (
    <div className="upcoming-toolbar" role="toolbar" aria-label="Upcoming filters">
      <div className="upcoming-seg" role="group" aria-label="Date range">
        {presets.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filters.preset === id ? 'active' : ''}
            aria-pressed={filters.preset === id}
            onClick={() => {
              if (id === 'custom' && !filters.custom.from) {
                const from = toDateInputValue(new Date())
                const to = toDateInputValue(addDays(startOfLocalDay(new Date()), 6))
                set({ preset: id, custom: { from, to } })
                return
              }
              set({ preset: id })
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filters.preset === 'custom' && (
        <div className="upcoming-custom">
          <label>
            From
            <input
              type="date"
              value={filters.custom.from}
              onChange={(e) => set({ custom: { ...filters.custom, from: e.target.value } })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.custom.to}
              onChange={(e) => set({ custom: { ...filters.custom, to: e.target.value } })}
            />
          </label>
        </div>
      )}

      <input
        type="search"
        value={filters.query}
        onChange={(e) => set({ query: e.target.value })}
        placeholder="Search title or location"
        aria-label="Search by event title or location"
      />

      <select
        aria-label="Location filter"
        value={filters.location}
        onChange={(e) => set({ location: e.target.value })}
      >
        <option value="">All locations</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <select
        aria-label="Impact filter"
        value={filters.impact}
        onChange={(e) => set({ impact: e.target.value })}
      >
        <option value="">All impact</option>
        {Object.entries(SEVERITY_LABELS).map(([id, label]) => (
          <option key={id} value={id}>
            {label} impact
          </option>
        ))}
      </select>

      <label className="upcoming-toggle">
        <input
          type="checkbox"
          checked={filters.affectingAssets}
          onChange={(e) => set({ affectingAssets: e.target.checked })}
        />
        Affecting my assets
      </label>

      <button
        type="button"
        className="ghost"
        aria-expanded={moreOpen}
        aria-controls="upcoming-more-filters"
        onClick={onOpenMore}
      >
        More filters
      </button>
    </div>
  )
}

export function UpcomingFilterChips({ chips, onClearChip, onClearAll }) {
  if (!chips.length) return null
  return (
    <div className="upcoming-chips" aria-label="Active filters">
      {chips.map((chip) => (
        <span key={chip.id} className="upcoming-chip">
          {chip.label}
          <button type="button" aria-label={`Remove ${chip.label}`} onClick={() => onClearChip(chip.id)}>
            ×
          </button>
        </span>
      ))}
      <button type="button" className="upcoming-clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  )
}
