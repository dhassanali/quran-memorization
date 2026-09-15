export const TOTAL_PAGES = 604

export function localDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function nextInterval(previous: number, rating: number): number {
  if (rating <= 2) return 1
  const multiplier = rating === 5 ? 2.5 : rating === 4 ? 1.6 : 0.8
  return Math.max(1, Math.round(Math.max(1, previous) * multiplier))
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localDate(value)
}
