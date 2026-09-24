import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import { build } from 'esbuild'

const bundled = await build({ stdin: { contents: "export { default as db } from './src/db.ts'; export * from './src/backup.ts'", resolveDir: process.cwd(), sourcefile: 'backup-test-entry.ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node19', write: false })
const { db, makeBackup, parseBackup, replaceFromBackup } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('backup round trip replaces personal data and retains cached Quran pages', async () => {
  await db.pages.add({ page: 604, addedAt: '2025-01-01', dueDate: '2025-01-02', interval: 1, repetitions: 0 })
  await db.settings.put({ key: 'dailyTarget', value: 3 })
  await db.drafts.put({ page: 604, wordIds: ['112:1:1'], updatedAt: '2025-01-01T12:00:00Z' })
  await db.quranPages.put({ page: 604, version: 'cached', words: [] })
  const backup = parseBackup(JSON.parse(JSON.stringify(await makeBackup())))
  await db.pages.add({ page: 603, addedAt: '2025-01-01', dueDate: '2025-01-02', interval: 1, repetitions: 0 })
  await replaceFromBackup(backup)
  assert.deepEqual((await db.pages.toArray()).map(page => page.page), [604])
  assert.deepEqual((await db.drafts.get(604)).wordIds, ['112:1:1'])
  assert.equal((await db.quranPages.get(604)).version, 'cached')
  await db.delete()
})

test('invalid backup is rejected without changing saved pages', async () => {
  const valid = { format: 'hifz-backup', version: 1, exportedAt: '2025-01-01T12:00:00Z', datasetVersion: 'quran-foundation-qcf-v2-1', policyVersion: 1, pages: [{ page: 1, addedAt: '2025-01-01', dueDate: '2025-01-02', interval: 1, repetitions: 0 }], settings: [], drafts: [], history: [] }
  assert.throws(() => parseBackup({ ...valid, pages: [{ ...valid.pages[0], dueDate: '2025-02-31' }] }))
  assert.throws(() => parseBackup({ ...valid, drafts: [{ page: 2, wordIds: [], updatedAt: valid.exportedAt }] }))
  assert.throws(() => parseBackup({ ...valid, history: [{ id: 'r', page: 1, reviewedAt: valid.exportedAt, wordIds: ['1:1:1'], errorCount: 1, wordCount: 20, rating: 1, datasetVersion: valid.datasetVersion, policyVersion: 1 }] }))
  await db.open()
  await db.pages.add(valid.pages[0])
  await assert.rejects(replaceFromBackup({ ...valid, pages: [{ ...valid.pages[0], page: 700 }] }))
  assert.equal((await db.pages.toArray()).length, 1)
  await db.delete()
})

test('valid calendar dates import in a time zone ahead of UTC', () => {
  const backup = { format: 'hifz-backup', version: 1, exportedAt: '2025-01-01T12:00:00Z', datasetVersion: 'quran-foundation-qcf-v2-1', policyVersion: 1, pages: [{ page: 1, addedAt: '2025-01-01', dueDate: '2025-01-02', interval: 1, repetitions: 0 }], settings: [], drafts: [], history: [] }
  assert.equal(parseBackup(backup).pages[0].addedAt, '2025-01-01')
  assert.throws(() => parseBackup({ ...backup, pages: [{ ...backup.pages[0], dueDate: '2025-02-31' }] }))
})

test('a failed import transaction restores the original records', async () => {
  const original = { page: 2, addedAt: '2025-01-01', dueDate: '2025-01-02', interval: 1, repetitions: 0 }
  const replacement = { ...original, page: 3 }
  await db.open()
  await db.pages.add(original)
  const backup = parseBackup({ format: 'hifz-backup', version: 1, exportedAt: '2025-01-01T12:00:00Z', datasetVersion: 'quran-foundation-qcf-v2-1', policyVersion: 1, pages: [replacement], settings: [], drafts: [], history: [] })
  const addHistory = db.history.bulkAdd
  db.history.bulkAdd = async () => { throw new Error('simulated storage failure') }
  try { await assert.rejects(replaceFromBackup(backup), /simulated storage failure/) } finally { db.history.bulkAdd = addHistory }
  assert.deepEqual((await db.pages.toArray()).map(page => page.page), [2])
  await db.delete()
})
