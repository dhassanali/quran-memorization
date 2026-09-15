import { useEffect, useMemo, useState } from 'react'
import db, { type MemorizedPage } from './db'
import { addDays, localDate, nextInterval, TOTAL_PAGES } from './srs'

type View = 'home' | 'reviews' | 'pages'

const ratings = [
  { value: 5, label: 'متقن', hint: 'ممتاز، انتقل لفترة أطول', tone: 'emerald' },
  { value: 4, label: 'جيّد', hint: 'مع تردد بسيط', tone: 'teal' },
  { value: 3, label: 'متوسط', hint: 'يحتاج إلى تدريب', tone: 'amber' },
  { value: 2, label: 'ضعيف', hint: 'راجعه غدًا', tone: 'orange' },
  { value: 1, label: 'صعب', hint: 'ابدأ من جديد غدًا', tone: 'rose' },
]

const arabicNumber = new Intl.NumberFormat('ar')
const formatNumber = (value: number) => arabicNumber.format(value)
const formatDate = (date: string) => new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))

function App() {
  const [pages, setPages] = useState<MemorizedPage[]>([])
  const [target, setTarget] = useState(2)
  const [newPage, setNewPage] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<View>('home')
  const today = localDate()

  const refresh = async () => setPages(await db.pages.orderBy('page').toArray())
  useEffect(() => { void (async () => { const setting = await db.settings.get('dailyTarget'); if (setting) setTarget(setting.value); await refresh() })() }, [])

  const due = useMemo(() => pages.filter((item) => item.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [pages, today])
  const learnedToday = useMemo(() => pages.filter((item) => item.addedAt === today).length, [pages, today])
  const nextPage = useMemo(() => Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1).find((page) => !pages.some((item) => item.page === page)), [pages])
  const progress = Math.round((pages.length / TOTAL_PAGES) * 100)
  const remainingTarget = Math.max(0, target - learnedToday)

  async function addPage(event: React.FormEvent) {
    event.preventDefault()
    const page = Number(newPage)
    if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) return setNotice('اختر رقم صفحة بين ١ و٦٠٤.')
    if (await db.pages.get(page)) return setNotice(`الصفحة ${formatNumber(page)} موجودة بالفعل في رحلتك.`)
    await db.pages.add({ page, addedAt: today, dueDate: today, interval: 1, repetitions: 0 })
    setNewPage(''); setNotice(`أُضيفت الصفحة ${formatNumber(page)}. راجعها الآن لتثبيت الحفظ.`); await refresh()
  }

  async function review(item: MemorizedPage, rating: number) {
    const interval = nextInterval(item.interval, rating)
    await db.pages.update(item.page, { interval, dueDate: addDays(today, interval), lastReviewedAt: today, repetitions: item.repetitions + 1 })
    setNotice(`أحسنت! موعد الصفحة ${formatNumber(item.page)} القادم هو ${formatDate(addDays(today, interval))}.`)
    await refresh()
  }

  async function saveTarget(value: number) {
    const next = Math.max(1, Math.min(20, value || 1))
    setTarget(next); await db.settings.put({ key: 'dailyTarget', value: next })
  }

  function startAdding() { setView('home'); window.setTimeout(() => document.getElementById('add-page')?.focus(), 0) }

  return <main className="min-h-screen bg-[#f7f8f4] text-slate-800">
    <header className="hero-shell">
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-5 sm:px-8">
        <div className="flex items-center justify-between text-sm text-emerald-50/85"><span className="flex items-center gap-2"><i className="online-dot" /> يعمل دون اتصال</span><span>{formatDate(today)}</span></div>
        <div className="mt-9 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow text-emerald-200">رحلة الحفظ</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">حِفظي</h1><p className="mt-3 max-w-md text-emerald-50/80">رفيق هادئ يساعدك على تثبيت ما حفظت، صفحةً بعد صفحة.</p></div><div className="ayah-mark" aria-hidden="true">۝</div></div>
      </div>
    </header>

    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="التنقل الرئيسي"><div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-7">{([{ id: 'home', label: 'الرئيسية' }, { id: 'reviews', label: `المراجعات${due.length ? ` (${formatNumber(due.length)})` : ''}` }, { id: 'pages', label: 'صفحاتي' }] as { id: View, label: string }[]).map((item) => <button key={item.id} onClick={() => setView(item.id)} className={`nav-item ${view === item.id ? 'nav-item-active' : ''}`}>{item.label}</button>)}</div></nav>

    <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 sm:px-8 sm:py-10">
      {notice && <div className="notice" role="status"><span>✦</span><p>{notice}</p><button onClick={() => setNotice('')} aria-label="إغلاق التنبيه">×</button></div>}

      {view === 'home' && <>
        <section className="welcome-card"><div><p className="eyebrow text-emerald-700">خطوتك التالية</p><h2 className="mt-2 text-2xl font-bold text-slate-900">{due.length ? `لديك ${formatNumber(due.length)} ${due.length === 1 ? 'مراجعة' : 'مراجعات'} تنتظرك` : 'أتممت مراجعات اليوم'}</h2><p className="mt-2 text-slate-600">{due.length ? 'ابدأ بالأقدم موعدًا؛ دقائق قليلة اليوم تصنع حفظًا راسخًا.' : 'خذ نفسًا، ثم أضف صفحة جديدة حين تصبح مستعدًا.'}</p></div><button onClick={() => due.length ? setView('reviews') : startAdding()} className="primary primary-large">{due.length ? 'ابدأ المراجعة ←' : 'أضف صفحة جديدة +'}</button></section>

        <section className="grid gap-4 sm:grid-cols-3"><article className="stat-card"><span className="stat-icon">◷</span><p>مراجعات اليوم</p><strong>{formatNumber(due.length)}</strong><small>{due.length ? 'صفحات بحاجة لتثبيت' : 'لا توجد مراجعات معلّقة'}</small></article><article className="stat-card"><span className="stat-icon">✦</span><p>هدف الحفظ</p><strong>{formatNumber(learnedToday)} <em>/ {formatNumber(target)}</em></strong><small>{remainingTarget ? `متبقّي ${formatNumber(remainingTarget)} ${remainingTarget === 1 ? 'صفحة' : 'صفحات'}` : 'أنجزت هدف اليوم، بارك الله فيك'}</small></article><article className="stat-card"><span className="stat-icon">⌁</span><p>رحلتك الكلية</p><strong>{formatNumber(pages.length)} <em>/ ٦٠٤</em></strong><div className="progress-track" aria-label={`${progress}% من القرآن`}><div style={{ width: `${progress}%` }} /></div><small>{formatNumber(progress)}٪ مكتمل</small></article></section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_.85fr]"><form onSubmit={addPage} className="panel"><div className="panel-heading"><div><p className="eyebrow text-emerald-700">حفظ جديد</p><h2>أضف صفحة إلى رحلتك</h2></div><span className="page-badge">١ — ٦٠٤</span></div><p className="mt-2 text-sm leading-6 text-slate-600">ستحصل كل صفحة على جدول مراجعة مستقل يبدأ اليوم.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input id="add-page" aria-label="رقم صفحة القرآن" value={newPage} onChange={(event) => setNewPage(event.target.value)} inputMode="numeric" placeholder={nextPage ? `مثال: الصفحة ${formatNumber(nextPage)}` : 'رقم الصفحة'} className="field flex-1" /><button className="primary">إضافة الصفحة</button></div></form><aside className="panel target-panel"><p className="eyebrow text-emerald-700">تخصيص يومك</p><h2 className="mt-1">هدف الحفظ اليومي</h2><div className="mt-5 flex items-center gap-3"><button className="stepper" onClick={() => void saveTarget(target - 1)} type="button" aria-label="تقليل الهدف">−</button><output className="target-value">{formatNumber(target)}<small> صفحات</small></output><button className="stepper" onClick={() => void saveTarget(target + 1)} type="button" aria-label="زيادة الهدف">+</button></div><p className="mt-4 text-sm text-slate-500">يمكنك اختيار ما بين صفحة واحدة و٢٠ صفحة.</p></aside></section>
      </>}

      {view === 'reviews' && <section className="panel"><div className="panel-heading"><div><p className="eyebrow text-emerald-700">وقت التثبيت</p><h2>مراجعات اليوم</h2></div><span className="page-badge">{formatNumber(due.length)} مستحق</span></div>{due.length === 0 ? <div className="empty-state"><span>✓</span><h3>لا شيء للمراجعة الآن</h3><p>حين يحين موعد صفحة، ستظهر هنا لتقييم تسميعك.</p><button className="primary" onClick={() => setView('home')}>العودة للرئيسية</button></div> : <div className="mt-6 space-y-4">{due.map((item, index) => <article key={item.page} className="review-card"><div className="review-meta"><span className="review-number">{formatNumber(index + 1)}</span><div><h3>الصفحة {formatNumber(item.page)}</h3><p>آخر فترة: {formatNumber(item.interval)} {item.interval === 1 ? 'يوم' : 'أيام'} · {formatNumber(item.repetitions)} مراجعات</p></div><span className="due-label">مستحقة {item.dueDate === today ? 'اليوم' : formatDate(item.dueDate)}</span></div><fieldset><legend>كيف كان تسميعك؟</legend><div className="rating-grid">{ratings.map((rating) => <button key={rating.value} className={`rating rating-${rating.tone}`} onClick={() => void review(item, rating.value)} title={rating.hint}><b>{formatNumber(rating.value)}</b><span>{rating.label}</span><small>{rating.hint}</small></button>)}</div></fieldset></article>)}</div>}</section>}

      {view === 'pages' && <section className="panel"><div className="panel-heading"><div><p className="eyebrow text-emerald-700">مكتبتك</p><h2>الصفحات المحفوظة</h2></div><span className="page-badge">{formatNumber(pages.length)} صفحة</span></div>{pages.length === 0 ? <div className="empty-state"><span>۝</span><h3>لم تضف صفحاتك بعد</h3><p>ابدأ بأول صفحة حفظتها، وسنتابع مواعيد مراجعتها.</p><button className="primary" onClick={() => startAdding()}>إضافة صفحة</button></div> : <div className="page-list">{pages.map((item) => <article key={item.page}><strong>{formatNumber(item.page)}</strong><div><h3>الصفحة {formatNumber(item.page)}</h3><p>{item.dueDate <= today ? 'مستحقة للمراجعة' : `موعدها ${formatDate(item.dueDate)}`}</p></div><span>{formatNumber(item.interval)} {item.interval === 1 ? 'يوم' : 'أيام'}</span></article>)}</div>}</section>}
    </div>
  </main>
}

export default App
