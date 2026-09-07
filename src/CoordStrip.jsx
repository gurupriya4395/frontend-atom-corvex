import { fmtLat, fmtLng, fmtPair } from './coords'
import { FOCUS_TYPE_LABELS } from './labels'

export default function CoordStrip({ focusPoint }) {
  return (
    <div className="coord-strip" aria-live="polite">
      {focusPoint ? (
        <>
          <div className="coord-strip-head">
            <span className="coord-strip-tag">{FOCUS_TYPE_LABELS[focusPoint.type] || 'Selected'}</span>
            <span className="coord-strip-name">{focusPoint.label}</span>
          </div>
          <div className="coord-strip-geo">
            <div className="coord-strip-cell">
              <span>Latitude</span>
              <strong>{fmtLat(focusPoint.lat)}</strong>
            </div>
            <div className="coord-strip-cell">
              <span>Longitude</span>
              <strong>{fmtLng(focusPoint.lng)}</strong>
            </div>
            <div className="coord-strip-cell dd">
              <span>Coordinates</span>
              <strong>{fmtPair(focusPoint.lat, focusPoint.lng)}</strong>
            </div>
          </div>
        </>
      ) : (
        <span className="coord-strip-empty">Select an event or site to view coordinates</span>
      )}
    </div>
  )
}
