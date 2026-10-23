import { useEffect, useMemo, useRef, useState } from 'react'
import Reader from './Reader'
import Dashboard from './Dashboard'
import { MushafPaper } from './MushafPaper'
import db, { type Bookmark, type MemorizedPage, type QuranPage } from './db'
import { downloadBackup, parseBackup, replaceFromBackup, type Backup } from './backup'
import { countReviewWords, DATASET_VERSION, getQuranPage, purgeExpiredQuranPages, surahName, surahOf } from './quran'
import { APP_TIME_ZONE, localDate, POLICY_VERSION, reviewPage, TOTAL_PAGES } from './srs'

type View = 'home' | 'dashboard' | 'reviews' | 'pages'
type Language = 'ar' | 'en'
function savedReaderPage(): number { try { const page = Number(localStorage.getItem('mushaf-page')); return Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES ? page : 1 } catch { return 1 } }
const copy = {
  ar: { home: 'الرئيسية', reviews: 'المراجعة', pages: 'رحلتي', settings: 'الإعدادات', due: 'صفحات مستحقة', target: 'هدف الحفظ اليومي', added: 'صفحات اليوم', total: 'صفحات الحفظ', next: 'الصفحة التالية', add: 'أضف الصفحة', start: 'ابدأ المراجعة', none: 'لا مراجعات مستحقة الآن', empty: 'لم تُضف صفحات بعد', back: 'العودة للمصحف', page: 'صفحة', words: 'اضغط كل كلمة أخطأت في تسميعها', errors: 'أخطاء', finish: 'أنهِ المراجعة', loading: 'جارٍ تحميل صفحة المصحف…', unavailable: 'تعذّر تحميل الصفحة. اتصل بالإنترنت لتحميلها أول مرة، ثم ستعمل دون اتصال.', retry: 'إعادة المحاولة', language: 'اللغة', export: 'تصدير نسخة احتياطية', import: 'استيراد نسخة احتياطية', importInfo: 'سيحل الملف محل جميع بيانات الحفظ والإعدادات الحالية.', replace: 'استبدل بياناتي', cancel: 'إلغاء', backupDate: 'تاريخ النسخة', saved: 'حُفظت المراجعة. الموعد القادم', newSaved: 'أُضيفت الصفحة', limit: 'اكتمل هدف اليوم', close: 'إغلاق', exportFirst: 'يمكنك تصدير بياناتك الحالية أولًا.', scheduled: 'الموعد القادم' },
  en: { home: 'Home', reviews: 'Review', pages: 'My journey', settings: 'Settings', due: 'Due pages', target: 'Daily page target', added: 'Pages today', total: 'Memorized pages', next: 'Next page', add: 'Add page', start: 'Start review', none: 'No reviews due now', empty: 'No pages added yet', back: 'Back to Mushaf', page: 'Page', words: 'Tap each word you recited incorrectly', errors: 'Errors', finish: 'Finish review', loading: 'Loading Quran page…', unavailable: 'This page could not load. Connect once to download it for offline use.', retry: 'Retry', language: 'Language', export: 'Export backup', import: 'Import backup', importInfo: 'This file will replace all current progress and settings.', replace: 'Replace my data', cancel: 'Cancel', backupDate: 'Backup date', saved: 'Review saved. Next due', newSaved: 'Page added', limit: 'Today’s target complete', close: 'Close', exportFirst: 'You can export your current data first.', scheduled: 'Next due' },
} as const

function App() {
  const [pages, setPages] = useState<MemorizedPage[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [readerPage, setReaderPage] = useState(savedReaderPage)
  const [target, setTarget] = useState(2)
  const [targetInput, setTargetInput] = useState('2')
  const [language, setLanguage] = useState<Language>('ar')
  const [view, setView] = useState<View>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backup, setBackup] = useState<Backup | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [today, setToday] = useState(localDate())
  const lastPurgeDate = useRef(localDate())
  const dialog = useRef<HTMLDivElement>(null)
  const t = copy[language]
  const number = (n: number) => language === 'ar' ? new Intl.NumberFormat('ar').format(n) : String(n)
  const date = (value: string) => new Intl.DateTimeFormat(language, { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
  const refresh = async () => { const [savedPages, savedBookmarks] = await Promise.all([db.pages.orderBy('page').toArray(), db.bookmarks.orderBy('page').toArray()]); setPages(savedPages); setBookmarks(savedBookmarks) }

  useEffect(() => { void (async () => { try { await purgeExpiredQuranPages(); const settings = await db.settings.toArray(); const savedTarget = settings.find(x => x.key === 'dailyTarget')?.value; const savedLanguage = settings.find(x => x.key === 'language')?.value; if (typeof savedTarget === 'number' && savedTarget >= 1 && savedTarget <= 20) setTarget(savedTarget); if (savedLanguage === 'en') setLanguage('en'); await refresh() } catch { setNotice('Could not read saved data') } })() }, [])
  useEffect(() => { const update = () => { const day = localDate(); setToday(day); if (day !== lastPurgeDate.current) { lastPurgeDate.current = day; void purgeExpiredQuranPages().catch(() => undefined) } }; const timer = window.setInterval(update, 30_000); document.addEventListener('visibilitychange', update); window.addEventListener('focus', update); return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update) } }, [])
  useEffect(() => { if (!settingsOpen) return; const trigger = document.activeElement; const backdrop = dialog.current?.parentElement; const background = backdrop ? Array.from(backdrop.parentElement?.children || []).filter(element => element !== backdrop) as HTMLElement[] : []; background.forEach(element => { element.inert = true }); dialog.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false); if (event.key !== 'Tab' || !dialog.current) return; const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')); if (!focusable.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() } }; document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); background.forEach(element => { element.inert = false }); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus() } }, [settingsOpen])
  useEffect(() => { if (settingsOpen) setTargetInput(String(target)) }, [settingsOpen, target])

  const due = useMemo(() => pages.filter(p => p.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.page - b.page), [pages, today])
  const known = new Set(pages.map(p => p.page))
  const learnedToday = pages.filter(p => p.addedAt === today).length
  async function addPage(page: number) {
    if (busy || known.has(page) || !Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) return
    setBusy(true)
    try {
      const now = localDate()
      const added = await db.transaction('rw', db.pages, async () => {
        if (await db.pages.get(page)) return false
        const addedToday = await db.pages.filter(item => item.addedAt === now).count()
        if (addedToday >= target) return false
        await db.pages.add({ page, addedAt: now, dueDate: now, interval: 0, repetitions: 0 })
        return true
      })
      setToday(now)
      await refresh()
      setNotice(added ? `${t.newSaved}: ${number(page)}` : t.limit)
    } catch { setNotice('Could not save page') } finally { setBusy(false) }
  }
  async function toggleBookmark(page: number) {
    if (busy) return
    setBusy(true)
    try {
      await db.transaction('rw', db.bookmarks, async () => {
        if (await db.bookmarks.get(page)) await db.bookmarks.delete(page)
        else await db.bookmarks.put({ page, savedAt: new Date().toISOString() })
      })
      await refresh()
    } catch { setNotice(language === 'ar' ? 'تعذّر حفظ الإشارة المرجعية' : 'Could not save bookmark') } finally { setBusy(false) }
  }
  async function removeBookmark(page: number) {
    try { await db.bookmarks.delete(page); await refresh() } catch { setNotice(language === 'ar' ? 'تعذّر حذف الإشارة المرجعية' : 'Could not remove bookmark') }
  }
  async function finishReview(item: MemorizedPage, content: QuranPage, marked: string[]) {
    if (busy) return
    const validIds = new Set(content.words.filter(w => w.charType === 'word').map(w => w.id))
    if (content.version !== DATASET_VERSION || marked.some(id => !validIds.has(id))) throw new Error('Invalid word marks')
    setBusy(true)
    try {
      const now = new Date()
      const result = reviewPage(item, marked.length, countReviewWords(content), now)
      await db.transaction('rw', db.pages, db.history, db.drafts, async () => {
        const current = await db.pages.get(item.page)
        if (!current || current.repetitions !== item.repetitions || current.dueDate !== item.dueDate) throw new Error('Page changed during review')
        await db.pages.update(item.page, { card: result.card, dueDate: result.dueDate, interval: result.interval, repetitions: item.repetitions + 1, lastReviewedAt: localDate(now) })
        await db.history.add({ id: crypto.randomUUID(), page: item.page, reviewedAt: now.toISOString(), wordIds: marked, errorCount: marked.length, wordCount: countReviewWords(content), rating: result.rating, datasetVersion: DATASET_VERSION, policyVersion: POLICY_VERSION, log: result.log })
        await db.drafts.delete(item.page)
      })
      setToday(localDate())
      await refresh()
      setNotice(`${t.saved}: ${date(result.dueDate)}`)
    } finally { setBusy(false) }
  }
  async function saveTarget(value: number) { if (busy) return; const next = Math.max(1, Math.min(20, Math.round(value || 1))); try { await db.settings.put({ key: 'dailyTarget', value: next }); setTarget(next); setTargetInput(String(next)) } catch { setTargetInput(String(target)); setNotice('Could not save setting') } }
  async function saveLanguage(value: Language) { if (busy) return; try { await db.settings.put({ key: 'language', value }); setLanguage(value) } catch { setNotice('Could not save setting') } }
  async function chooseBackup(file?: File) { if (!file) return; try { if (file.size > 50_000_000) throw new Error('Backup file is too large'); const data = JSON.parse(await file.text()); setBackup(parseBackup(data)); setNotice('') } catch (error) { setBackup(null); setNotice(error instanceof Error ? error.message : 'Invalid backup') } }
  async function importBackup() { if (!backup || busy) return; setBusy(true); try { await replaceFromBackup(backup); const settings = await db.settings.toArray(); setTarget((settings.find(x => x.key === 'dailyTarget')?.value as number) || 2); setLanguage(settings.find(x => x.key === 'language')?.value === 'en' ? 'en' : 'ar'); await refresh(); setToday(localDate()); setBackup(null); setSettingsOpen(false); setView('home'); setNotice('Backup imported') } catch (error) { setNotice(error instanceof Error ? error.message : 'Import failed') } finally { setBusy(false) } }

  return <main className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
    <a className="skip-link" href="#page-content">{language === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
    {view !== 'home' && view !== 'dashboard' && <h1 className="sr-only">{view === 'reviews' ? t.reviews : t.pages}</h1>}
    {view !== 'home' && <nav className="reader-toolbar"><button onClick={() => setView('home')}>{t.back}</button><img className="reader-brand-mark" src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" aria-hidden="true" /><button onClick={() => setSettingsOpen(true)}>{t.settings}</button></nav>}
    {notice && <div className="notice reader-notice" role="status"><p>{notice}</p><button aria-label={t.close} onClick={() => setNotice('')}>×</button></div>}
    {view === 'home' && <Reader language={language} page={readerPage} onPageChange={setReaderPage} known={known} bookmarked={bookmarks.some(bookmark => bookmark.page === readerPage)} busy={busy} dueCount={due.length} learnedToday={learnedToday} target={target} settingsOpen={settingsOpen} onAdd={addPage} onBookmark={toggleBookmark} onDashboard={() => setView('dashboard')} onReviews={() => setView('reviews')} onSettings={() => setSettingsOpen(true)} />}
    <div id={view === 'home' ? undefined : 'page-content'} tabIndex={view === 'home' ? undefined : -1} className={view === 'home' ? '' : 'shell-content content'}>
      {view === 'dashboard' && <Dashboard language={language} pages={pages} bookmarks={bookmarks} today={today} target={target} onOpenPage={page => { setReaderPage(page); setView('home') }} onReview={() => setView('reviews')} onRemoveBookmark={removeBookmark} />}
      {view === 'reviews' && <section className="panel"><div className="section-heading"><h2>{t.reviews}</h2><span className="pill">{number(due.length)}</span></div>{due[0] ? <PageReview key={due[0].page} item={due[0]} language={language} busy={busy} onFinish={finishReview} onError={setNotice} /> : <Empty text={t.none} back={t.back} onClick={() => setView('home')} />}</section>}
      {view === 'pages' && <section className="panel"><div className="section-heading"><h2>{t.total}</h2><span className="pill">{number(pages.length)}</span></div>{!pages.length ? <Empty text={t.empty} back={t.back} onClick={() => setView('home')} /> : <div className="page-list">{pages.map(item => <article key={item.page}><strong>{number(item.page)}</strong><div><h3>{t.page} {number(item.page)}</h3><p>{t.scheduled}: {date(item.dueDate)}</p></div><span>{number(item.repetitions)} {t.reviews}</span></article>)}</div>}</section>}</div>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><div className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} ref={dialog}><div className="section-heading"><h2 id="settings-title">{t.settings}</h2><button className="icon-button" aria-label={t.close} onClick={() => setSettingsOpen(false)}>×</button></div><label className="setting-row">{t.target}<input type="number" name="daily-target" autoComplete="off" min="1" max="20" disabled={busy} value={targetInput} onChange={event => setTargetInput(event.target.value)} onBlur={() => void saveTarget(Number(targetInput))} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label><label className="setting-row">{t.language}<select name="language" value={language} disabled={busy} onChange={event => void saveLanguage(event.target.value as Language)}><option value="ar">العربية</option><option value="en">English</option></select></label><p className="source-credit">Quran page text and font: <a href="https://quran.foundation/">Quran Foundation</a><br />Arabic search text: <a href="https://tanzil.net/">Tanzil Project</a> (<a href={`${import.meta.env.BASE_URL}tanzil-text-NOTICE.txt`}>text license</a>)<br />Page metadata: <a href="https://github.com/quran-center/quran-meta">quran-meta</a> (<a href={`${import.meta.env.BASE_URL}quran-meta-LICENSE.txt`}>MIT license</a>)</p><button onClick={() => { setSettingsOpen(false); setView('pages') }}>{t.pages}</button><div className="backup-tools"><button className="primary" disabled={busy} onClick={() => void downloadBackup().catch(() => setNotice('Export failed'))}>{t.export}</button><label className="file-button">{t.import}<input type="file" name="backup-file" disabled={busy} accept="application/json,.json" onChange={event => void chooseBackup(event.target.files?.[0])} /></label></div>{backup && <div className="import-preview"><p>{t.backupDate}: {new Date(backup.exportedAt).toLocaleString(language, { timeZone: APP_TIME_ZONE })}</p><p>{t.total}: {number(backup.pages.length)} · {t.reviews}: {number(backup.history.length)}</p><p>{t.importInfo} {t.exportFirst}</p><div className="dialog-actions"><button onClick={() => setBackup(null)}>{t.cancel}</button><button className="danger" disabled={busy} onClick={() => void importBackup()}>{t.replace}</button></div></div>}</div></div>}
  </main>
}

function PageReview({ item, language, busy, onFinish, onError }: { item: MemorizedPage; language: Language; busy: boolean; onFinish: (item: MemorizedPage, content: QuranPage, marked: string[]) => Promise<void>; onError: (message: string) => void }) {
  const [content, setContent] = useState<QuranPage | null>(null)
  const [marks, setMarks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const saveChain = useRef(Promise.resolve())
  const markedRef = useRef<string[]>([])
  const t = copy[language]
  useEffect(() => { let active = true; setLoading(true); setLoadError(false); void (async () => { try { const [page, draft] = await Promise.all([getQuranPage(item.page), db.drafts.get(item.page)]); if (!active) return; const valid = new Set(page.words.filter(w => w.charType === 'word').map(w => w.id)); const saved = draft?.wordIds.filter(id => valid.has(id)) || []; markedRef.current = saved; setMarks(saved); setContent(page) } catch { if (active) setLoadError(true) } finally { if (active) setLoading(false) } })(); return () => { active = false } }, [item.page, attempt])
  const toggle = (id: string) => { if (busy || submittingRef.current) return; const next = markedRef.current.includes(id) ? markedRef.current.filter(x => x !== id) : [...markedRef.current, id]; markedRef.current = next; setMarks(next); saveChain.current = saveChain.current.catch(() => undefined).then(() => db.drafts.put({ page: item.page, wordIds: next, updatedAt: new Date().toISOString() })).then(() => undefined); void saveChain.current.catch(() => onError('Could not save review draft')) }
  const finish = async () => { if (!content || busy || submittingRef.current) return; submittingRef.current = true; setSubmitting(true); try { await saveChain.current; await onFinish(item, content, markedRef.current); markedRef.current = []; setMarks([]) } catch (error) { onError(error instanceof Error ? error.message : 'Could not save review') } finally { submittingRef.current = false; setSubmitting(false) } }
  if (loading) return <div className="empty-state">{t.loading}</div>
  if (loadError || !content) return <div className="empty-state"><p>{t.unavailable}</p><button className="primary" onClick={() => setAttempt(x => x + 1)}>{t.retry}</button></div>
  const firstSurah = surahOf(content.words[0])
  const lastSurah = surahOf(content.words[content.words.length - 1])
  const surahLabel = firstSurah === lastSurah ? `سورة ${surahName(firstSurah)}` : `${surahName(firstSurah)} – ${surahName(lastSurah)}`
  return <article className="mushaf-review">
    <div className="mushaf-top"><strong>{t.page} {language === 'ar' ? new Intl.NumberFormat('ar').format(item.page) : item.page}</strong><span>{surahLabel}</span></div>
    <p className="review-hint">{t.words}</p>
    <MushafPaper content={content} marks={marks} disabled={busy || submitting} language={language} onToggle={toggle} />
    <div className="review-footer"><span>{t.errors}: <bdi dir="ltr">{language === 'ar' ? new Intl.NumberFormat('ar').format(marks.length) : marks.length} / {language === 'ar' ? new Intl.NumberFormat('ar').format(countReviewWords(content)) : countReviewWords(content)}</bdi></span><button className="primary" disabled={busy || submitting} onClick={() => void finish()}>{t.finish}</button></div>
  </article>
}

function Empty({ text, back, onClick }: { text: string; back: string; onClick: () => void }) { return <div className="empty-state"><span>✓</span><p>{text}</p><button className="primary" onClick={onClick}>{back}</button></div> }
export default App
