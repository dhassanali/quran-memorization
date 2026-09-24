import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { MemorizedPage } from './db'

export const TOTAL_PAGES = 604
export const POLICY_VERSION = 1
export const scheduler = fsrs({ request_retention: 0.9, enable_short_term: false, learning_steps: [], relearning_steps: [] })

export function localDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function ratingForErrors(errors: number, total: number): Grade {
  if (!Number.isInteger(errors) || !Number.isInteger(total) || total <= 0 || errors < 0 || errors > total) throw new Error('Invalid review counts')
  if (errors === 0) return Rating.Easy
  if (errors / total <= 0.05) return Rating.Good
  if (errors / total <= 0.10) return Rating.Hard
  return Rating.Again
}

export function reviewPage(page: MemorizedPage, errorCount: number, wordCount: number, now = new Date()) {
  const rating = ratingForErrors(errorCount, wordCount)
  // Legacy pages retain their due dates and start FSRS at the next actual review.
  const card: Card = page.card ? { ...page.card, due: new Date(page.card.due), last_review: page.card.last_review ? new Date(page.card.last_review) : undefined } : createEmptyCard(now)
  const result = scheduler.next(card, now, rating)
  return { rating, card: result.card, log: result.log, dueDate: localDate(result.card.due), interval: result.card.scheduled_days }
}
