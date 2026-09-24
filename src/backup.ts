import db, { type MemorizedPage, type ReviewDraft, type ReviewHistory, type Setting } from './db'
import { DATASET_VERSION } from './quran'
import { POLICY_VERSION, ratingForErrors, TOTAL_PAGES } from './srs'

const FORMAT = 'hifz-backup'
const VERSION = 1
export interface Backup { format: string; version: number; exportedAt: string; datasetVersion: string; policyVersion: number; pages: MemorizedPage[]; settings: Setting[]; drafts: ReviewDraft[]; history: ReviewHistory[] }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`)) && new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value
const instant = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const pageNumber = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= TOTAL_PAGES
const wordId = (value: unknown): value is string => { if (typeof value !== 'string' || !/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(value)) return false; const [surah, ayah, position] = value.split(':').map(Number); return surah >= 1 && surah <= 114 && ayah >= 1 && position >= 1 }
const wordIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(wordId) && new Set(value).size === value.length
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

export async function makeBackup(): Promise<Backup> {
  return db.transaction('r', db.pages, db.settings, db.drafts, db.history, async () => ({
    format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), datasetVersion: DATASET_VERSION, policyVersion: POLICY_VERSION,
    pages: await db.pages.toArray(), settings: await db.settings.toArray(), drafts: await db.drafts.toArray(), history: await db.history.toArray(),
  }))
}

export function parseBackup(value: unknown): Backup {
  if (!object(value) || value.format !== FORMAT || value.version !== VERSION || !instant(value.exportedAt) || value.datasetVersion !== DATASET_VERSION || value.policyVersion !== POLICY_VERSION || !Array.isArray(value.pages) || !Array.isArray(value.settings) || !Array.isArray(value.drafts) || !Array.isArray(value.history)) throw new Error('Unsupported or invalid backup format')
  const pages = value.pages as unknown[]
  if (!pages.every(p => object(p) && pageNumber(p.page) && date(p.addedAt) && date(p.dueDate) && positive(p.interval) && Number.isInteger(p.repetitions) && Number(p.repetitions) >= 0 && (p.lastReviewedAt === undefined || date(p.lastReviewedAt)) && (!p.card || (object(p.card) && instant(p.card.due) && positive(p.card.stability) && positive(p.card.difficulty) && Number.isInteger(p.card.reps) && Number.isInteger(p.card.lapses))))) throw new Error('Invalid page records')
  const pageSet = new Set(pages.map(p => (p as MemorizedPage).page))
  if (pageSet.size !== pages.length) throw new Error('Duplicate pages')
  const settings = value.settings as unknown[]
  if (!settings.every(s => object(s) && (s.key === 'dailyTarget' ? Number.isInteger(s.value) && Number(s.value) >= 1 && Number(s.value) <= 20 : s.key === 'language' && (s.value === 'ar' || s.value === 'en'))) || new Set(settings.map(s => (s as Setting).key)).size !== settings.length) throw new Error('Invalid settings')
  const drafts = value.drafts as unknown[]
  if (!drafts.every(d => object(d) && pageSet.has(d.page as number) && wordIds(d.wordIds) && instant(d.updatedAt)) || new Set(drafts.map(d => (d as ReviewDraft).page)).size !== drafts.length) throw new Error('Invalid review drafts')
  const history = value.history as unknown[]
  if (!history.every(h => object(h) && typeof h.id === 'string' && h.id.length > 0 && pageSet.has(h.page as number) && instant(h.reviewedAt) && wordIds(h.wordIds) && h.errorCount === (h.wordIds as string[]).length && Number.isInteger(h.wordCount) && Number(h.wordCount) > 0 && Number(h.errorCount) <= Number(h.wordCount) && [1, 2, 3, 4].includes(Number(h.rating)) && h.rating === ratingForErrors(Number(h.errorCount), Number(h.wordCount)) && h.datasetVersion === DATASET_VERSION && h.policyVersion === POLICY_VERSION) || new Set(history.map(h => (h as ReviewHistory).id)).size !== history.length) throw new Error('Invalid review history')
  return value as unknown as Backup
}

export async function replaceFromBackup(backup: Backup): Promise<void> {
  const valid = parseBackup(backup)
  await db.transaction('rw', db.pages, db.settings, db.drafts, db.history, async () => {
    await Promise.all([db.pages.clear(), db.settings.clear(), db.drafts.clear(), db.history.clear()])
    await db.pages.bulkAdd(valid.pages)
    await db.settings.bulkAdd(valid.settings)
    await db.drafts.bulkAdd(valid.drafts)
    await db.history.bulkAdd(valid.history)
  })
}

export async function downloadBackup(): Promise<void> {
  const backup = await makeBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `hifz-backup-${backup.exportedAt.slice(0, 16).replace('T', '-').replace(':', '')}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
