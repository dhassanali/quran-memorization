// Read-only source audit. Run with network access: node scripts/validate-quran-pages.mjs
const total = 604
let next = 1
const errors = []

async function check(page) {
  const query = new URLSearchParams({ mushaf: '1', words: 'true', per_page: '50', word_fields: 'text_qpc_hafs,text_uthmani,line_number,line_v2,char_type_name,verse_key' })
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?${query}`, { signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { verses } = await response.json()
      if (!Array.isArray(verses) || verses.length === 0) throw new Error('No verses')
      const words = verses.flatMap(verse => (verse.words || []).map(word => ({ ...word, verse_key: verse.verse_key })))
      if (!words.length || !words.some(word => word.char_type_name === 'word')) throw new Error('No words')
      if (words.some(word => !word.text_qpc_hafs && !word.text_uthmani || !Number.isInteger(word.position) || !Number.isInteger(word.line_number ?? word.line_v2) || (word.line_number ?? word.line_v2) < 1 || (word.line_number ?? word.line_v2) > 15)) throw new Error('Invalid word or line')
      if (new Set(words.map(word => `${word.verse_key}:${word.position}`)).size !== words.length) throw new Error('Duplicate word IDs')
      return
    } catch (error) {
      if (attempt === 3) errors.push(`${page}: ${error.message}`)
      else await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }
}

await Promise.all(Array.from({ length: 6 }, async () => {
  while (next <= total) {
    const page = next++
    await check(page)
    if (page % 100 === 0) console.log(`Checked through page ${page}`)
  }
}))
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log('Validated all 604 page responses')
