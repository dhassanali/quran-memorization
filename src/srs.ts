export const TOTAL_PAGES = 604
export const DEFAULT_EASE_FACTOR = 2.5
export const MINIMUM_EASE_FACTOR = 1.3

export interface ReviewSchedule {
  interval: number
  easeFactor: number
  lapses: number
}

export function localDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/** Calculates the next interval using an Anki-style ease multiplier. */
export function nextInterval(previous: number, rating: number, easeFactor = DEFAULT_EASE_FACTOR): number {
  const interval = Math.max(1, previous)
  const ease = Math.max(MINIMUM_EASE_FACTOR, easeFactor)
  const normalizedRating = Math.max(1, Math.min(4, Math.round(rating)))
  if (normalizedRating === 1) return 1
  if (normalizedRating === 2) return Math.max(1, Math.round(interval * 1.2))
  if (normalizedRating === 3) return Math.max(1, Math.round(interval * ease))
  return Math.max(1, Math.round(interval * ease * 1.3))
}

/** Returns all persistent scheduling fields for a single review. */
export function scheduleReview(previous: number, rating: number, easeFactor = DEFAULT_EASE_FACTOR, lapses = 0): ReviewSchedule {
  const normalizedRating = Math.max(1, Math.min(4, Math.round(rating)))
  const nextEase = normalizedRating === 1 ? easeFactor - 0.2
    : normalizedRating === 2 ? easeFactor - 0.15
      : normalizedRating === 4 ? easeFactor + 0.15
        : easeFactor

  return {
    interval: nextInterval(previous, normalizedRating, easeFactor),
    easeFactor: Math.max(MINIMUM_EASE_FACTOR, Math.round(nextEase * 100) / 100),
    lapses: lapses + (normalizedRating === 1 ? 1 : 0),
  }
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localDate(value)
}
