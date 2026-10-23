import { useEffect, useRef, useState } from 'react'
import { findPage, isValidSurahAyah } from 'quran-meta/hafs'
import type { QuranPage } from './db'
import chapters from './chapters.json'
import { getQuranPage, surahName, surahOf } from './quran'
import { MushafPaper } from './MushafPaper'
import { TOTAL_PAGES } from './srs'

const juzPages = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582]
function normalizeQuery(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ـ/g, '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).trim()
}
function versePage(value: string): number | null {
  const match = value.match(/^(\d{1,3}):(\d{1,3})$/)
  if (!match) return null
  const pair: [number, number] = [Number(match[1]), Number(match[2])]
  return isValidSurahAyah(pair) ? findPage(...pair) : null
}
type SearchResult = { verse_key: string; text: string }
type Props = { language: 'ar' | 'en'; page: number; onPageChange: (page: number) => void; known: Set<number>; bookmarked: boolean; busy: boolean; dueCount: number; learnedToday: number; target: number; settingsOpen: boolean; onAdd: (page: number) => Promise<void>; onBookmark: (page: number) => Promise<void>; onDashboard: () => void; onReviews: () => void; onSettings: () => void }

export default function Reader({ language, page, onPageChange, known, bookmarked, busy, dueCount, learnedToday, target, settingsOpen, onAdd, onBookmark, onDashboard, onReviews, onSettings }: Props) {
  const ar = language === 'ar'
  const [content, setContent] = useState<QuranPage | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [panel, setPanel] = useState<'navigate' | 'search' | null>(null)
  const [tab, setTab] = useState<'surah' | 'juz' | 'page'>('surah')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [retrySearch, setRetrySearch] = useState(0)
  const [jump, setJump] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const number = (n: number) => new Intl.NumberFormat(language).format(n)
  const go = (next: number) => { if (Number.isInteger(next) && next >= 1 && next <= TOTAL_PAGES) { onPageChange(next); setPanel(null) } }
  useEffect(() => {
    let active = true
    setContent(null); setError(false)
    try { localStorage.setItem('mushaf-page', String(page)) } catch { /* Reading remains available without storage. */ }
    void getQuranPage(page).then(data => { if (active) setContent(data) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [page, attempt])
  useEffect(() => {
    if (panel) { modal.current?.showModal(); setQuery(''); setResults([]); setSearchError(false); setSearchPage(1); setJump(String(page)) }
    else modal.current?.close()
  }, [panel])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (panel || settingsOpen || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(Math.min(TOTAL_PAGES, page + 1)) }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(Math.max(1, page - 1)) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, settingsOpen, page, onPageChange])
  useEffect(() => {
    if (panel !== 'search' || !query.trim() || versePage(normalizeQuery(query))) { setResults([]); setSearching(false); setSearchError(false); return }
    const controller = new AbortController()
    setSearching(true); setSearchError(false); setResults([])
    const timer = window.setTimeout(() => {
      if (/[\u0600-\u06ff]/.test(query)) {
        void import('./verses.json').then(({ default: index }) => {
          const needle = normalizeQuery(query)
          const matches = (index.verses as [string, string][]).filter(([, text]) => normalizeQuery(text).includes(needle))
          if (!controller.signal.aborted) { setResults(matches.slice((searchPage - 1) * 20, searchPage * 20).map(([verse_key, text]) => ({ verse_key, text }))); setTotalPages(Math.ceil(matches.length / 20)) }
        }).catch(() => { if (!controller.signal.aborted) setSearchError(true) }).finally(() => { if (!controller.signal.aborted) setSearching(false) })
      } else {
        const params = new URLSearchParams({ q: query.trim(), size: '20', page: String(searchPage), language })
        void fetch(`https://api.quran.com/api/v4/search?${params}`, { signal: controller.signal }).then(async response => {
          if (!response.ok) throw new Error('Search failed')
          const payload = await response.json()
          if (!Array.isArray(payload.search?.results)) throw new Error('Invalid results')
          if (!controller.signal.aborted) { setResults(payload.search.results); setTotalPages(payload.search.total_pages || 0) }
        }).catch(() => { if (!controller.signal.aborted) setSearchError(true) }).finally(() => { if (!controller.signal.aborted) setSearching(false) })
      }
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, panel, searchPage, language, retrySearch])
  function openVerse(key: string) {
    const next = versePage(key)
    if (next) go(next)
  }
  const normalized = normalizeQuery(query)
  const filtered = chapters.filter(chapter => normalizeQuery(`${chapter.arabic} ${chapter.name}`).includes(normalized) || String(chapter.id) === normalized)
  const validReference = versePage(normalized) !== null
  const title = content ? surahName(surahOf(content.words[0])) : chapters.filter(chapter => chapter.page <= page).slice(-1)[0]?.arabic
  return <section className="reader" aria-label={ar ? 'المصحف' : 'Mushaf'}>
    <h1 className="sr-only">{ar ? 'المصحف' : 'Mushaf'}</h1>
    <header className="reader-toolbar">
      <div className="reader-location"><img className="reader-brand-mark" src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" aria-hidden="true" /><button onClick={() => setPanel('navigate')} className="surah-trigger" aria-haspopup="dialog"><span lang="ar">{title}</span><span aria-hidden="true">⌄</span></button></div>
      <div className="reader-tools"><button onClick={() => setPanel('search')} aria-label={ar ? 'بحث في القرآن' : 'Search Quran'}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button><button onClick={onDashboard}>{ar ? 'رحلتي' : 'Progress'}</button><button onClick={onReviews}>{ar ? 'المراجعة' : 'Review'}{dueCount > 0 && <span className="review-count">{number(dueCount)}</span>}</button><button onClick={onSettings} aria-label={ar ? 'الإعدادات' : 'Settings'}>⋯</button></div>
    </header>
    <div id="page-content" tabIndex={-1} className="reader-paper" onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }} onTouchEnd={event => {
      if (!touch.current) return
      const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y
      touch.current = null
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) go(Math.max(1, Math.min(TOTAL_PAGES, page + (dx > 0 ? 1 : -1))))
    }}>
      {content ? <MushafPaper content={content} /> : <div className="reader-loading" role="status">{error ? <><p>{ar ? 'تعذّر تحميل الصفحة. تحقق من اتصالك بالإنترنت.' : 'Could not load this page. Check your internet connection.'}</p><button onClick={() => setAttempt(n => n + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></> : ar ? 'جارٍ تحميل المصحف…' : 'Loading Mushaf…'}</div>}
    </div>
    <footer className="reader-footer"><div className="page-turner" dir="rtl"><button onClick={() => go(page - 1)} disabled={page === 1} aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}>→</button><button onClick={() => { setTab('page'); setPanel('navigate') }}><bdi dir="ltr">{number(page)} / {number(TOTAL_PAGES)}</bdi></button><button onClick={() => go(page + 1)} disabled={page === TOTAL_PAGES} aria-label={ar ? 'الصفحة التالية' : 'Next page'}>←</button></div><div className="reader-actions"><button className="bookmark-toggle" aria-pressed={bookmarked} aria-label={bookmarked ? ar ? 'إزالة الإشارة المرجعية' : 'Remove bookmark' : ar ? 'احفظ إشارة مرجعية' : 'Save bookmark'} disabled={busy} onClick={() => void onBookmark(page)}>{bookmarked ? '★' : '☆'}</button><button className="add-review" disabled={busy || known.has(page) || learnedToday >= target} onClick={() => void onAdd(page)}>{known.has(page) ? ar ? '✓ في المراجعة' : '✓ In review' : learnedToday >= target ? ar ? 'اكتمل هدف اليوم' : 'Today’s target complete' : ar ? '+ أضف للمراجعة' : '+ Add to review'}</button></div></footer>
    <dialog className="reader-dialog" ref={modal} onCancel={() => setPanel(null)} onClick={event => { if (event.target === event.currentTarget) setPanel(null) }} aria-labelledby="navigation-title">
      <div className="dialog-content"><div className="section-heading"><h2 id="navigation-title">{panel === 'search' ? ar ? 'بحث في القرآن' : 'Search Quran' : ar ? 'انتقل إلى' : 'Go to'}</h2><button onClick={() => setPanel(null)} aria-label={ar ? 'إغلاق' : 'Close'}>×</button></div>
        {panel === 'navigate' && <div className="navigation-tabs">{(['surah', 'juz', 'page'] as const).map((value, index) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{(ar ? ['السور', 'الأجزاء', 'الصفحات'] : ['Surah', 'Juz', 'Page'])[index]}</button>)}</div>}
        {(panel === 'search' || tab === 'surah') && <input className="search-input" type="search" name="quran-search" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setSearchPage(1) }} aria-label={panel === 'search' ? ar ? 'ابحث عن آية أو سورة' : 'Search a verse or surah' : ar ? 'اسم السورة' : 'Surah name'} aria-describedby={panel === 'search' ? 'search-help' : undefined} placeholder={panel === 'search' ? ar ? 'آية، سورة، أو ٢:٢٥٥' : 'Verse, surah, or 2:255' : ar ? 'ابحث عن سورة' : 'Find a surah'} />}
        {panel === 'search' && <p id="search-help" className="search-help">{ar ? 'البحث بالعربية متاح دون اتصال بعد فتحه أول مرة. فتح صفحة غير محفوظة والبحث بلغات أخرى يحتاجان إلى الإنترنت.' : 'Arabic search works offline after its first use. Opening an uncached page and searching other languages need internet.'}</p>}
        <div className="navigation-results">
          {(panel === 'navigate' && tab === 'surah' || panel === 'search' && !!query.trim()) && filtered.map(chapter => <button className="navigation-row" key={chapter.id} onClick={() => go(chapter.page)}><span className="surah-number">{number(chapter.id)}</span><span className="surah-names"><strong lang="ar">{chapter.arabic}</strong><small>{chapter.name}</small></span><span>{ar ? 'ص' : 'p.'} {number(chapter.page)}</span></button>)}
          {panel === 'navigate' && tab === 'surah' && !filtered.length && <p>{ar ? 'لا توجد سورة بهذا الاسم' : 'No surah found'}</p>}
          {panel === 'navigate' && tab === 'juz' && juzPages.map((start, index) => <button className="navigation-row" key={start} onClick={() => go(start)}><strong>{ar ? 'الجزء' : 'Juz'} {number(index + 1)}</strong><span>{ar ? 'صفحة' : 'Page'} {number(start)}</span></button>)}
          {panel === 'navigate' && tab === 'page' && <form className="page-jump" onSubmit={event => { event.preventDefault(); go(Number(normalizeQuery(jump))) }}><label htmlFor="page-number">{ar ? 'رقم الصفحة (١–٦٠٤)' : 'Page number (1–604)'}</label><input id="page-number" name="page-number" autoComplete="off" inputMode="numeric" value={jump} onChange={event => setJump(event.target.value)} required /><button className="primary" disabled={!/^\d+$/.test(normalizeQuery(jump)) || Number(normalizeQuery(jump)) < 1 || Number(normalizeQuery(jump)) > TOTAL_PAGES}>{ar ? 'انتقل' : 'Go'}</button></form>}
          {panel === 'search' && <>
            {validReference && <button className="navigation-row" onClick={() => openVerse(normalized)}>{ar ? 'انتقل إلى الآية' : 'Open verse'} {query}</button>}
            {searching && <p role="status">{ar ? 'جارٍ البحث…' : 'Searching…'}</p>}
            {searchError && <p role="alert">{ar ? 'تعذّر البحث. تحقق من الاتصال وحاول مجددًا.' : 'Search failed. Check your connection and try again.'}<button onClick={() => { setRetrySearch(n => n + 1) }}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>}
            {!searching && !searchError && query.trim() && !results.length && !filtered.length && !validReference && <p>{ar ? 'لا توجد نتائج' : 'No results found'}</p>}
            {results.map(result => <button className="verse-result" key={result.verse_key} onClick={() => openVerse(result.verse_key)}><small>{surahName(Number(result.verse_key.split(':')[0]))} · {result.verse_key}</small><span dir="rtl" lang="ar">{result.text}</span></button>)}
            {!searching && !searchError && results.length > 0 && <div className="search-pagination"><button disabled={searchPage === 1} onClick={() => setSearchPage(p => p - 1)}>{ar ? 'السابق' : 'Previous'}</button><span><bdi dir="ltr">{number(searchPage)} / {number(totalPages)}</bdi></span><button disabled={searchPage >= totalPages} onClick={() => setSearchPage(p => p + 1)}>{ar ? 'التالي' : 'Next'}</button></div>}
          </>}
        </div>
      </div>
    </dialog>
  </section>
}
