import { fmtLat, fmtLng, fmtPair } from './coords'

export default function CoordStrip({ focusPoint }) {
  return (
    <div className="coord-strip" aria-live="polite">
      {focusPoint ? (
        <>
          <span className="coord-strip-tag">TARGET · {focusPoint.type}</span>
          <span className="coord-strip-name">{focusPoint.label}</span>
          <span className="coord-strip-val">
            <b>LAT</b> {fmtLat(focusPoint.lat)}
          </span>
          <span className="coord-strip-val">
            <b>LON</b> {fmtLng(focusPoint.lng)}
          </span>
          <span className="coord-strip-dd">{fmtPair(focusPoint.lat, focusPoint.lng)}</span>
        </>
      ) : (
        <span className="coord-strip-empty">No target — select an event or site for coordinates</span>
      )}
    </div>
  )
}
