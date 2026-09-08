export const EVENT_STATUSES = ['scheduled', 'tentative', 'postponed', 'cancelled', 'completed']

export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  tentative: 'Tentative',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const IMPACT_ORDER = { high: 3, medium: 2, low: 1 }

export const IMPACT_LABELS = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
}

export const ALERT_TYPE_LABELS = {
  informative: 'Informative',
  intelligence: 'Intelligence',
}

export const FOLLOW_STORAGE_KEY = 'atom-corvex.upcoming.followed'

export function categoryToAlertType(category) {
  if (category === 'environmental') return 'informative'
  return 'intelligence'
}

export function isActiveStatus(status) {
  return status !== 'cancelled' && status !== 'completed'
}

export function exposureLabel(evidence) {
  return evidence === 'confirmed' ? 'Confirmed exposure' : 'Potential exposure'
}
