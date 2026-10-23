import { useEffect, useRef } from 'react'
import type { QuranPage } from './db'
import { mushafRows, surahName } from './quran'

export function MushafPaper({ content, marks = [], disabled = false, language = 'ar', onToggle }: { content: QuranPage; marks?: string[]; disabled?: boolean; language?: 'ar' | 'en'; onToggle?: (id: string) => void }) {
  const paperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const paper = paperRef.current
    if (!content || !paper) return
    let active = true
    let lastWidth = 0
    const fitLines = () => {
      if (!active) return
      const width = paper.clientWidth
      if (!width) return
      const preferred = Math.min(32, Math.max(20, width / 20))
      paper.style.setProperty('--mushaf-font-size', `${preferred}px`)
      const lines = paper.querySelectorAll<HTMLElement>('.mushaf-line')
      const ratio = Math.max(1, ...Array.from(lines, line => {
        const lineRect = line.getBoundingClientRect()
        const wordRects = Array.from(line.children, word => word.getBoundingClientRect())
        if (!lineRect.width || !wordRects.length) return 1
        const contentLeft = Math.min(...wordRects.map(rect => rect.left))
        const contentRight = Math.max(...wordRects.map(rect => rect.right))
        return (contentRight - contentLeft) / lineRect.width
      }))
      paper.style.setProperty('--mushaf-font-size', `${preferred / ratio * 0.98}px`)
    }
    const observer = new ResizeObserver(() => {
      const width = paper.clientWidth
      if (width !== lastWidth) { lastWidth = width; fitLines() }
    })
    observer.observe(paper)
    fitLines()
    void document.fonts.ready.then(fitLines)
    document.fonts.addEventListener('loadingdone', fitLines)
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', fitLines) }
  }, [content])
  const rows = mushafRows(content)
  return (
    <div className="mushaf-page" dir="rtl" translate="no" ref={paperRef}>
      <div className="mushaf-text">
        {rows.map(row => row.kind === 'words' ? <div className="mushaf-line" key={row.line}>
          {row.words.map(word => word.charType === 'word' && onToggle ? <button key={word.id} type="button" className={`quran-word ${marks.includes(word.id) ? 'word-error' : ''}`} aria-pressed={marks.includes(word.id)} disabled={disabled} aria-label={`${word.text} ${marks.includes(word.id) ? language === 'ar' ? 'خطأ محدد' : 'marked' : ''}`} onClick={() => onToggle?.(word.id)}>{word.text}</button> : <span className={word.charType === 'word' ? 'quran-word' : 'verse-marker'} key={word.id}>{word.text}</span>)}
        </div> : row.kind === 'heading' ? <div className="mushaf-heading" key={row.line}>سورة {surahName(row.surah)}</div> : row.kind === 'basmala' ? <div className="mushaf-basmala" key={row.line}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div> : <div className="mushaf-space" key={row.line} aria-hidden="true" />)}
      </div>
      <div className="mushaf-page-number">{new Intl.NumberFormat('ar').format(content.page)}</div>
    </div>
  )
}
