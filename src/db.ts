import Dexie, { type EntityTable } from 'dexie'
import type { Card } from 'ts-fsrs'

export interface MemorizedPage {
  page: number
  addedAt: string
  lastReviewedAt?: string
  dueDate: string
  interval: number
  repetitions: number
  easeFactor?: number
  lapses?: number
  card?: Card
}

export interface Setting {
  key: 'dailyTarget' | 'language'
  value: number | 'ar' | 'en'
}

export interface ReviewDraft { page: number; wordIds: string[]; updatedAt: string }
export interface ReviewHistory {
  id: string
  page: number
  reviewedAt: string
  wordIds: string[]
  errorCount: number
  wordCount: number
  rating: number
  datasetVersion: string
  policyVersion: number
  log: unknown
}
export interface QuranWord { id: string; text: string; line: number; verseKey: string; charType: string }
export interface QuranPage { page: number; version: string; fetchedAt: string; words: QuranWord[] }

const db = new Dexie('hifz-journey') as Dexie & {
  pages: EntityTable<MemorizedPage, 'page'>
  settings: EntityTable<Setting, 'key'>
  drafts: EntityTable<ReviewDraft, 'page'>
  history: EntityTable<ReviewHistory, 'id'>
  quranPages: EntityTable<QuranPage, 'page'>
}

db.version(1).stores({ pages: 'page, dueDate', settings: 'key' })
db.version(2).stores({ pages: 'page, dueDate', settings: 'key', drafts: 'page', history: 'id, page, reviewedAt', quranPages: 'page' })
export default db
