import { ASSETS, PEOPLE } from './data.js'
import { haversineKm } from './scoring.js'

export function peopleNearEvent(event, radiusKm) {
  if (!event?.coords) return []
  return PEOPLE.map((person) => {
    const site = ASSETS.find((a) => a.id === person.siteId)
    if (!site?.coords) return null
    const km = haversineKm(event.coords, site.coords)
    if (km > radiusKm) return null
    return { ...person, site, km }
  })
    .filter(Boolean)
    .sort((a, b) => a.km - b.km)
}

export function headcountOf(people) {
  return people.reduce((sum, person) => sum + (person.headcount || 1), 0)
}

export function defaultAlertCopy(event, people) {
  const n = headcountOf(people)
  const place = event.place?.split(',')[0] || 'the affected area'
  if (!n) {
    return `No registered people sit inside this radius of ${place}. Do not broadcast city-wide.`
  }
  return `${event.title}. This notice is only for people at sites within the selected radius of ${place}. Stay clear of flooded or closed roads and wait for the all-clear from your site lead.`
}
