import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transform } from 'esbuild'

const source = await readFile(new URL('../src/srs.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2020' })
const srs = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('nextInterval resets difficult ratings to one day', () => {
  assert.equal(srs.nextInterval(10, 1), 1)
  assert.equal(srs.nextInterval(10, 2), 1)
  assert.equal(srs.nextInterval(10, 0), 1)
})

test('nextInterval applies the configured rating multipliers', () => {
  assert.equal(srs.nextInterval(2, 3), 2)
  assert.equal(srs.nextInterval(3, 4), 5)
  assert.equal(srs.nextInterval(3, 5), 8)
})

test('nextInterval never returns less than one day', () => {
  assert.equal(srs.nextInterval(0, 3), 1)
  assert.equal(srs.nextInterval(-4, 4), 2)
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
