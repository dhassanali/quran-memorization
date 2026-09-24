import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import { build } from 'esbuild'

const bundled = await build({ stdin: { contents: "export { default as db } from './src/db.ts'; export * from './src/quran.ts'", resolveDir: process.cwd(), sourcefile: 'quran-test-entry.ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node19', write: false })
const quran = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('surah headings appear only at the first word of a new surah', () => {
  const word = (id, verseKey) => ({ id, verseKey })
  assert.equal(quran.shouldShowSurahHeading(word('2:6:1', '2:6'), 0), false)
  assert.equal(quran.shouldShowSurahHeading(word('9:1:1', '9:1'), 8), true)
  assert.equal(quran.shouldShowSurahHeading(word('112:1:1', '112:1'), 112), false)
  assert.equal(quran.shouldShowSurahHeading(word('112:1:2', '112:1'), 111), false)
})

test('Mushaf rows preserve line positions and reserve headings and basmalas', () => {
  const word = (id, line) => ({ id, verseKey: id.split(':').slice(0, 2).join(':'), line, text: 'آية', charType: 'word' })
  const rows = quran.mushafRows({ page: 604, words: [word('112:1:1', 3), word('112:4:1', 4), word('113:1:1', 7), word('114:1:1', 12)] })
  assert.equal(rows.length, 15)
  assert.deepEqual(rows.map(row => row.kind).slice(0, 7), ['heading', 'basmala', 'words', 'words', 'heading', 'basmala', 'words'])
  assert.equal(rows[9].kind, 'heading')
  assert.equal(rows[10].kind, 'basmala')
  assert.equal(rows[11].kind, 'words')
  assert.deepEqual(quran.mushafRows({ page: 1, words: [word('1:1:1', 2)] }).slice(0, 2).map(row => row.kind), ['heading', 'words'])
  assert.deepEqual(quran.mushafRows({ page: 187, words: [word('9:1:1', 2)] }).slice(0, 2).map(row => row.kind), ['heading', 'words'])
  assert.equal(quran.surahName(1), 'الفاتحة')
  assert.equal(quran.surahName(114), 'الناس')
})

test('expired and legacy Quran page caches are purged', async () => {
  const now = Date.now()
  const page = (number, fetchedAt) => ({ page: number, version: quran.DATASET_VERSION, fetchedAt, words: [] })
  await quran.db.quranPages.bulkPut([
    page(1, new Date(now - 7 * 86400000).toISOString()),
    page(2, new Date(now - 86400000).toISOString()),
    { page: 3, version: quran.DATASET_VERSION, words: [] },
  ])
  await quran.purgeExpiredQuranPages()
  assert.deepEqual((await quran.db.quranPages.toArray()).map(p => p.page), [2])
  await quran.db.delete()
})

test('expired Quran page is fetched again before review', async () => {
  await quran.db.open()
  await quran.db.quranPages.put({ page: 4, version: quran.DATASET_VERSION, fetchedAt: new Date(Date.now() - 7 * 86400000).toISOString(), words: [] })
  const previousFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return { ok: true, json: async () => ({ verses: [{ verse_key: '2:17', words: [{ position: 1, line_number: 1, text_qpc_hafs: 'مَثَلُهُمْ', char_type_name: 'word' }] }] }) }
  }
  try {
    const page = await quran.getQuranPage(4)
    assert.equal(calls, 1)
    assert.equal(page.words[0].id, '2:17:1')
    assert.ok(Date.now() - Date.parse(page.fetchedAt) < 5000)
  } finally {
    globalThis.fetch = previousFetch
    await quran.db.delete()
  }
})
