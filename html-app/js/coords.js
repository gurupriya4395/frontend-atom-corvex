export function fmtLat(lat) {
  const hemi = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(4)}°${hemi}`
}

export function fmtLng(lng) {
  const hemi = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(4)}°${hemi}`
}

export function fmtPair(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
