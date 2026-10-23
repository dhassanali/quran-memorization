import { useEffect, useState } from 'react'
import db, { type Bookmark, type MemorizedPage, type ReviewHistory } from './db'
import { getQuranPage } from './quran'
import { APP_TIME_ZONE, localDate, TOTAL_PAGES } from './srs'

type Language = 'ar' | 'en'
type Props = {
  language: Language
  pages: MemorizedPage[]
  bookmarks: Bookmark[]
  today: string
  target: number
  onOpenPage: (page: number) => void
  onReview: () => void
  onRemoveBookmark: (page: number) => Promise<void>
}

function ErrorWords({ review, language }: { review: ReviewHistory; language: Language }) {
  const [words, setWords] = useState<string[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    void getQuranPage(review.page).then(page => {
      const byId = new Map(page.words.map(word => [word.id, word.text]))
      if (active) setWords(review.wordIds.map(id => byId.get(id) || id))
    }).catch(() => { if (active) { setWords(review.wordIds); setUnavailable(true) } })
    return () => { active = false }
  }, [review.page, review.wordIds])
  if (!review.wordIds.length) return <p>{language === 'ar' ? 'لم تُحدَّد أخطاء' : 'No errors marked'}</p>
  if (!words) return <p role="status">{language === 'ar' ? 'جارٍ تحميل الكلمات…' : 'Loading words…'}</p>
  return <>{unavailable && <p>{language === 'ar' ? 'نص الصفحة غير متاح دون اتصال؛ تظهر معرّفات الكلمات حتى يُحمَّل.' : 'Page text is unavailable offline; word IDs are shown until it can load.'}</p>}<div className="history-words" dir="rtl" lang="ar">{words.map((word, index) => <span key={`${review.id}-${index}`}>{word}</span>)}</div></>
}

function HistoryEntry({ review, language }: { review: ReviewHistory; language: Language }) {
  const [open, setOpen] = useState(false)
  const number = (value: number) => new Intl.NumberFormat(language).format(value)
  const date = new Intl.DateTimeFormat(language, { timeZone: APP_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(review.reviewedAt))
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary><span>{language === 'ar' ? 'صفحة' : 'Page'} {number(review.page)} · {date}</span><strong>{number(review.errorCount)} {language === 'ar' ? 'أخطاء' : 'errors'}</strong></summary>{open && <ErrorWords review={review} language={language} />}</details>
}

export default function Dashboard({ language, pages, bookmarks, today, target, onOpenPage, onReview, onRemoveBookmark }: Props) {
  const ar = language === 'ar'
  const [tab, setTab] = useState<'overview' | 'bookmarks' | 'history'>('overview')
  const [history, setHistory] = useState<ReviewHistory[]>([])
  const [historyError, setHistoryError] = useState(false)
  const [visible, setVisible] = useState(20)
  const number = (value: number) => new Intl.NumberFormat(language).format(value)
  const date = (value: string) => new Intl.DateTimeFormat(language, { timeZone: APP_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
  const due = pages.filter(page => page.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.page - b.page)
  const learnedToday = pages.filter(page => page.addedAt === today).length
  const sevenDayStart = localDate(new Date(Date.now() - 6 * 86400000))
  const recentErrors = history.filter(item => localDate(new Date(item.reviewedAt)) >= sevenDayStart).reduce((sum, item) => sum + item.errorCount, 0)

  useEffect(() => {
    let active = true
    void db.history.orderBy('reviewedAt').reverse().toArray().then(items => { if (active) setHistory(items) }).catch(() => { if (active) setHistoryError(true) })
    return () => { active = false }
  }, [])

  return <section className="panel dashboard" aria-label={ar ? 'رحلتي' : 'My progress'}>
    <h1>{ar ? 'رحلتي' : 'My progress'}</h1>
    <div className="dashboard-tabs" aria-label={ar ? 'أقسام رحلتي' : 'Progress sections'}>
      {(['overview', 'bookmarks', 'history'] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'overview' ? ar ? 'نظرة عامة' : 'Overview' : value === 'bookmarks' ? ar ? 'الإشارات' : 'Bookmarks' : ar ? 'السجل' : 'History'}</button>)}
    </div>
    {tab === 'overview' && <>
      <div className="dashboard-stats">
        <div><strong>{number(due.length)}</strong><span>{ar ? 'صفحات مستحقة' : 'Due pages'}</span></div>
        <div><strong><bdi dir="ltr">{number(pages.length)} / {number(TOTAL_PAGES)}</bdi></strong><span>{ar ? 'صفحات الحفظ' : 'Memorized pages'}</span></div>
        <div><strong>{number(recentErrors)}</strong><span>{ar ? 'أخطاء آخر ٧ أيام' : 'Errors in 7 days'}</span></div>
      </div>
      <div className="dashboard-goal"><div><strong>{ar ? 'هدف اليوم' : 'Today’s target'}</strong><span><bdi dir="ltr">{number(learnedToday)} / {number(target)}</bdi></span></div><progress aria-label={ar ? 'التقدم نحو هدف اليوم' : 'Progress toward today’s target'} value={Math.min(learnedToday, target)} max={target}>{number(learnedToday)} / {number(target)}</progress></div>
      <div className="section-heading"><h2>{ar ? 'المراجعة المستحقة' : 'Due for review'}</h2>{due.length > 0 && <button className="primary" onClick={onReview}>{ar ? 'ابدأ المراجعة' : 'Start review'}</button>}</div>
      {due.length ? <div className="dashboard-list">{due.slice(0, 10).map(item => <div key={item.page}>{ar ? 'صفحة' : 'Page'} {number(item.page)}<span>{date(`${item.dueDate}T12:00:00Z`)}</span></div>)}</div> : <p className="dashboard-empty">{ar ? 'لا مراجعات مستحقة الآن' : 'No reviews due now'}</p>}
      <button className="text-link" onClick={() => setTab('history')}>{ar ? 'عرض سجل المراجعة' : 'View review history'}</button>
    </>}
    {tab === 'bookmarks' && (bookmarks.length ? <div className="dashboard-list">{bookmarks.map(bookmark => <div className="bookmark-row" key={bookmark.page}><button onClick={() => onOpenPage(bookmark.page)}>{ar ? 'صفحة' : 'Page'} {number(bookmark.page)}</button><button aria-label={`${ar ? 'إزالة إشارة الصفحة' : 'Remove bookmark for page'} ${number(bookmark.page)}`} onClick={() => void onRemoveBookmark(bookmark.page)}>×</button></div>)}</div> : <p className="dashboard-empty">{ar ? 'لا توجد إشارات مرجعية بعد' : 'No bookmarks yet'}</p>)}
    {tab === 'history' && <>
      {historyError ? <p role="alert">{ar ? 'تعذّر تحميل سجل المراجعة' : 'Could not load review history'}</p> : history.length ? <div className="history-list">{history.slice(0, visible).map(item => <HistoryEntry key={item.id} review={item} language={language} />)}</div> : <p className="dashboard-empty">{ar ? 'لا توجد مراجعات سابقة' : 'No reviews yet'}</p>}
      {history.length > visible && <button className="text-link" onClick={() => setVisible(count => count + 20)}>{ar ? 'عرض المزيد' : 'Show more'}</button>}
    </>}
  </section>
}
