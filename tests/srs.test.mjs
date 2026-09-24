import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

const bundled = await build({ entryPoints: ['src/srs.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node19', write: false })
const srs = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('word errors map to ratings at exact percentage boundaries', () => {
  assert.equal(srs.ratingForErrors(0, 20), 4)
  assert.equal(srs.ratingForErrors(1, 20), 3)
  assert.equal(srs.ratingForErrors(2, 20), 2)
  assert.equal(srs.ratingForErrors(3, 20), 1)
  assert.equal(srs.ratingForErrors(1, 19), 2)
  assert.throws(() => srs.ratingForErrors(21, 20))
  assert.throws(() => srs.ratingForErrors(0, 0))
})

test('new and legacy pages become FSRS cards on actual review', () => {
  const now = new Date('2025-02-01T12:00:00Z')
  const legacy = { page: 1, addedAt: '2024-01-01', dueDate: '2025-02-01', interval: 45, repetitions: 8, easeFactor: 2.5 }
  const first = srs.reviewPage(legacy, 0, 20, now)
  assert.equal(first.rating, 4)
  assert.equal(first.card.reps, 1)
  assert.ok(first.dueDate > legacy.dueDate)
  const repeated = srs.reviewPage({ ...legacy, card: JSON.parse(JSON.stringify(first.card)) }, 3, 20, new Date('2025-02-10T12:00:00Z'))
  assert.equal(repeated.rating, 1)
  assert.equal(repeated.card.reps, 2)
})

test('localDate follows the active local calendar day', () => {
  assert.equal(srs.localDate(new Date('2024-03-10T04:30:00Z')), '2024-03-09')
  assert.equal(srs.localDate(new Date('2024-03-10T07:30:00Z')), '2024-03-10')
})
