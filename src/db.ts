import Dexie, { type EntityTable } from 'dexie'

export interface MemorizedPage {
  page: number
  addedAt: string
  lastReviewedAt?: string
  dueDate: string
  interval: number
  repetitions: number
}

export interface Setting {
  key: 'dailyTarget' | 'language'
  value: number | 'ar' | 'en'
}

const db = new Dexie('hifz-journey') as Dexie & {
  pages: EntityTable<MemorizedPage, 'page'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({ pages: 'page, dueDate', settings: 'key' })
export default db
