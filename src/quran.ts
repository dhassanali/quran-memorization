import db, { type QuranPage, type QuranWord } from './db'
import { TOTAL_PAGES } from './srs'

export const DATASET_VERSION = 'quran-foundation-qcf-v2-1'
const CACHE_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000
const inflight = new Map<number, Promise<QuranPage>>()

interface ApiWord { position: number; text_uthmani?: string; text_qpc_hafs?: string; line_number?: number; line_v2?: number; char_type_name?: string; verse_key?: string }
interface ApiVerse { verse_key: string; words?: ApiWord[] }

function parsePage(page: number, payload: { verses?: ApiVerse[] }): QuranPage {
  const verses = payload.verses
  if (!Array.isArray(verses) || !verses.length) throw new Error('Page has no verses')
  const words: QuranWord[] = []
  for (const verse of verses) {
    if (!/^\d{1,3}:\d{1,3}$/.test(verse.verse_key) || !Array.isArray(verse.words)) throw new Error('Invalid page verses')
    for (const word of verse.words) {
      const line = word.line_number ?? word.line_v2
      if (!Number.isInteger(word.position) || !Number.isInteger(line) || !line || line < 1 || line > 15) throw new Error('Invalid page layout')
      const text = word.text_qpc_hafs || word.text_uthmani
      if (!text) throw new Error('Missing Quran word')
      words.push({ id: `${verse.verse_key}:${word.position}`, text, line, verseKey: verse.verse_key, charType: word.char_type_name || 'word' })
    }
  }
  if (!words.length || new Set(words.map(word => word.id)).size !== words.length) throw new Error('Invalid word IDs')
  return { page, version: DATASET_VERSION, fetchedAt: new Date().toISOString(), words }
}

function fresh(page: QuranPage, now = Date.now()): boolean {
  const fetchedAt = Date.parse(page.fetchedAt)
  return page.version === DATASET_VERSION && Number.isFinite(fetchedAt) && fetchedAt <= now && now - fetchedAt < CACHE_LIFETIME_MS
}

export async function purgeExpiredQuranPages(): Promise<void> {
  const pages = await db.quranPages.toArray()
  await db.quranPages.bulkDelete(pages.filter(page => !fresh(page)).map(page => page.page))
}

export async function getQuranPage(page: number): Promise<QuranPage> {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) throw new Error('Invalid page number')
  const cached = await db.quranPages.get(page)
  if (cached && fresh(cached)) return cached
  if (cached) await db.quranPages.delete(page)
  const pending = inflight.get(page)
  if (pending) return pending
  const request = (async () => {
    const params = new URLSearchParams({ mushaf: '1', words: 'true', per_page: '50', word_fields: 'text_qpc_hafs,text_uthmani,line_number,line_v2,char_type_name,verse_key' })
    const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?${params}`)
    if (!response.ok) throw new Error('Unable to download Quran page')
    const data = parsePage(page, await response.json())
    await db.quranPages.put(data)
    return data
  })()
  inflight.set(page, request)
  try { return await request } finally { inflight.delete(page) }
}

export function countReviewWords(page: QuranPage): number { return page.words.filter(word => word.charType === 'word').length }
export function surahOf(word: QuranWord): number { return Number(word.verseKey.split(':')[0]) }
export function shouldShowSurahHeading(word: QuranWord, previousSurah: number): boolean {
  const [surah, ayah] = word.verseKey.split(':').map(Number)
  return surah !== previousSurah && ayah === 1 && word.id === `${word.verseKey}:1`
}
