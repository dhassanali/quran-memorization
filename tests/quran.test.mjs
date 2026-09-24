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
