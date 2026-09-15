export interface PageBounds {
  start: string
  end: string
}

const fallback: Record<number, PageBounds> = {
  1: { start: 'الفاتحة ١', end: 'الفاتحة ٧' },
  2: { start: 'البقرة ١', end: 'البقرة ٥' },
  3: { start: 'البقرة ٦', end: 'البقرة ١٦' },
  4: { start: 'البقرة ١٧', end: 'البقرة ٢٤' },
  5: { start: 'البقرة ٢٥', end: 'البقرة ٢٩' },
}

export async function getPageBounds(page: number, language: 'ar' | 'en'): Promise<PageBounds> {
  try {
    const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?language=${language}&words=false&fields=text_uthmani,verse_key`)
    if (!response.ok) throw new Error('Unable to load page')
    const payload = await response.json() as { verses?: { verse_key: string, text_uthmani?: string }[] }
    const verses = payload.verses ?? []
    if (!verses.length) throw new Error('No verses')
    const [first, last] = [verses[0], verses[verses.length - 1]]
    return { start: first.verse_key, end: last.verse_key }
  } catch {
    return fallback[page] ?? (language === 'ar'
      ? { start: `بداية الصفحة ${page}`, end: `نهاية الصفحة ${page}` }
      : { start: `Start of page ${page}`, end: `End of page ${page}` })
  }
}

export function concealArabicLetters(text: string): string {
  return text.replace(/[\u0621-\u064A]/g, 'ـ')
}
