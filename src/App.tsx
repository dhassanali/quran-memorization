import { useEffect, useMemo, useState } from 'react'
import db, { type MemorizedPage } from './db'
import { addDays, localDate, nextInterval, TOTAL_PAGES } from './srs'

const ratings = [
  { value: 5, label: 'Easy', hint: 'Perfect' }, { value: 4, label: 'Good', hint: 'A little work' },
  { value: 3, label: 'Average', hint: 'Needs practice' }, { value: 2, label: 'Not good', hint: 'Needs work' },
  { value: 1, label: 'Hard', hint: 'Very bad' },
]

function App() {
  const [pages, setPages] = useState<MemorizedPage[]>([])
  const [target, setTarget] = useState(2)
  const [newPage, setNewPage] = useState('')
  const [notice, setNotice] = useState('')
  const today = localDate()

  const refresh = async () => setPages(await db.pages.orderBy('page').toArray())
  useEffect(() => { void (async () => { const setting = await db.settings.get('dailyTarget'); if (setting) setTarget(setting.value); await refresh() })() }, [])

  const due = useMemo(() => pages.filter((item) => item.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [pages, today])
  const learnedToday = useMemo(() => pages.filter((item) => item.addedAt === today).length, [pages, today])
  const progress = Math.round((pages.length / TOTAL_PAGES) * 100)

  async function addPage(event: React.FormEvent) {
    event.preventDefault()
    const page = Number(newPage)
    if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) return setNotice('Choose a page from 1 to 604.')
    if (await db.pages.get(page)) return setNotice(`Page ${page} is already in your journey.`)
    await db.pages.add({ page, addedAt: today, dueDate: today, interval: 1, repetitions: 0 })
    setNewPage(''); setNotice(`Page ${page} added — review it when you are ready.`); await refresh()
  }

  async function review(item: MemorizedPage, rating: number) {
    const interval = nextInterval(item.interval, rating)
    await db.pages.update(item.page, { interval, dueDate: addDays(today, interval), lastReviewedAt: today, repetitions: item.repetitions + 1 })
    await refresh()
  }

  async function saveTarget(value: number) {
    const next = Math.max(1, Math.min(20, value || 1))
    setTarget(next); await db.settings.put({ key: 'dailyTarget', value: next })
  }

  return <main className="min-h-screen bg-stone-50 text-stone-800">
    <header className="bg-emerald-900 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-200">Quran memorization</p><h1 className="font-serif text-2xl">Hifz Journey</h1></div><span className="rounded-full bg-emerald-800 px-3 py-1 text-sm">Offline ready</span></div></header>
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="card"><p className="label">Due today</p><p className="metric">{due.length}</p><p className="text-sm text-stone-500">Pages ready for review</p></article>
        <article className="card"><p className="label">Memorized today</p><p className="metric">{learnedToday}<span className="text-xl text-stone-400"> / {target}</span></p><p className="text-sm text-stone-500">Your daily page target</p></article>
        <article className="card"><p className="label">Journey</p><p className="metric">{pages.length}<span className="text-xl text-stone-400"> / 604</span></p><div className="mt-3 h-2 overflow-hidden rounded bg-stone-200"><div className="h-full bg-amber-500" style={{ width: `${progress}%` }} /></div></article>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-baseline justify-between"><div><h2 className="text-xl font-semibold">Review first</h2><p className="text-sm text-stone-500">Rate each page after reciting it from memory.</p></div><span className="text-sm font-medium text-emerald-800">{due.length} due</span></div>
        {due.length === 0 ? <div className="rounded-xl bg-emerald-50 px-4 py-8 text-center"><p className="text-lg font-medium text-emerald-950">All caught up.</p><p className="mt-1 text-sm text-emerald-800">Add a new page below, or come back when a review is due.</p></div> : <div className="space-y-3">{due.map((item) => <article key={item.page} className="rounded-xl border border-stone-200 p-4"><div className="mb-3 flex justify-between"><div><h3 className="text-lg font-semibold">Quran page {item.page}</h3><p className="text-sm text-stone-500">Interval: {item.interval} day{item.interval === 1 ? '' : 's'} · {item.repetitions} reviews</p></div><span className="text-sm text-amber-700">Due {item.dueDate}</span></div><div className="grid grid-cols-5 gap-2">{ratings.map((rating) => <button onClick={() => void review(item, rating.value)} className="rating" key={rating.value} title={rating.hint}><b>{rating.value}</b><span>{rating.label}</span></button>)}</div></article>)}</div>}
      </section>

      <section className="grid gap-5 md:grid-cols-[1.4fr_1fr]"><form onSubmit={addPage} className="card"><h2 className="text-xl font-semibold">Add a memorized page</h2><p className="mb-4 mt-1 text-sm text-stone-500">Every Quran page receives its own review schedule.</p><div className="flex gap-2"><input aria-label="Quran page number" value={newPage} onChange={(e) => setNewPage(e.target.value)} inputMode="numeric" placeholder="Page number (1–604)" className="field" /><button className="primary">Add page</button></div>{notice && <p className="mt-3 text-sm text-emerald-800">{notice}</p>}</form><section className="card"><h2 className="text-xl font-semibold">Daily target</h2><p className="mb-3 mt-1 text-sm text-stone-500">Pages to memorize each day.</p><label className="flex items-center gap-3"><input aria-label="Daily page target" type="number" min="1" max="20" value={target} onChange={(e) => void saveTarget(Number(e.target.value))} className="field w-24" /><span className="text-sm text-stone-500">pages</span></label></section></section>
    </div>
  </main>
}

export default App
