import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transform } from 'esbuild'

const source = await readFile(new URL('../src/srs.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2020' })
const srs = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('Again resets an Anki-style review interval to one day', () => {
  assert.equal(srs.nextInterval(10, 1), 1)
  assert.equal(srs.nextInterval(10, 0), 1)
})

test('Hard, Good, and Easy use progressively longer Anki-style intervals', () => {
  assert.equal(srs.nextInterval(2, 2), 2)
  assert.equal(srs.nextInterval(2, 3), 5)
  assert.equal(srs.nextInterval(2, 4), 7)
})

test('ease factor changes future Good intervals and never drops below one day', () => {
  assert.equal(srs.nextInterval(4, 3, 1.5), 6)
  assert.equal(srs.nextInterval(0, 3), 3)
  assert.equal(srs.nextInterval(-4, 4), 3)
})

test('scheduleReview adjusts ease and tracks lapses independently per page', () => {
  assert.deepEqual(srs.scheduleReview(10, 1, 2.5, 2), { interval: 1, easeFactor: 2.3, lapses: 3 })
  assert.deepEqual(srs.scheduleReview(10, 2, 1.3, 0), { interval: 12, easeFactor: 1.3, lapses: 0 })
  assert.deepEqual(srs.scheduleReview(10, 4, 2.5, 0), { interval: 33, easeFactor: 2.65, lapses: 0 })
})

test('addDays returns the expected calendar date across a daylight-saving transition', () => {
  assert.equal(srs.addDays('2024-03-09', 1), '2024-03-10')
  assert.equal(srs.addDays('2024-03-10', 1), '2024-03-11')
  assert.equal(srs.addDays('2024-12-31', 1), '2025-01-01')
})

test('localDate formats a date using its local calendar day', () => {
  assert.equal(srs.localDate(new Date('2024-01-01T04:30:00Z')), '2023-12-31')
  assert.equal(srs.localDate(new Date('2024-06-01T16:30:00Z')), '2024-06-01')
})
