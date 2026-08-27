import { fmtLat, fmtLng, fmtPair } from './coords'

export default function CoordStrip({ focusPoint }) {
  return (
    <div className="coord-strip" aria-live="polite">
      {focusPoint ? (
        <>
          <div className="coord-strip-head">
            <span className="coord-strip-tag">TARGET · {focusPoint.type}</span>
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
              <span>Decimal</span>
              <strong>{fmtPair(focusPoint.lat, focusPoint.lng)}</strong>
            </div>
          </div>
        </>
      ) : (
        <span className="coord-strip-empty">No target — select an event or site for coordinates</span>
      )}
    </div>
  )
}
