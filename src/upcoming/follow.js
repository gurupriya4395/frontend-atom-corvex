import { FOLLOW_STORAGE_KEY } from './model.js'

export function readFollowed() {
  try {
    const raw = localStorage.getItem(FOLLOW_STORAGE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

export function writeFollowed(ids) {
  localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify([...ids]))
}

export function toggleFollow(id) {
  const next = readFollowed()
  if (next.has(id)) next.delete(id)
  else next.add(id)
  writeFollowed(next)
  return next
}

export function followHint() {
  return 'Saved on this device. This build does not send notifications.'
}
