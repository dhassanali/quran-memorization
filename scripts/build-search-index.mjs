import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Usage: node scripts/build-search-index.mjs <tanzil-uthmani-v1.1.txt>')

const source = await readFile(sourcePath)
const sha256 = createHash('sha256').update(source).digest('hex')
const expectedSha256 = '6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f'
if (sha256 !== expectedSha256) throw new Error(`Unexpected Tanzil source checksum: ${sha256}`)

const text = source.toString('utf8')
const noticeStart = text.indexOf('# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK')
if (noticeStart < 0) throw new Error('Tanzil copyright notice is missing')
const notice = text.slice(noticeStart).trimEnd().split(/\r?\n/).map(line => line.trimEnd()).join('\n')
const chapters = JSON.parse(await readFile(fileURLToPath(new URL('../src/chapters.json', import.meta.url)), 'utf8'))
const verses = []
for (const line of text.slice(0, noticeStart).split(/\r?\n/)) {
  if (!line) continue
  const match = line.match(/^(\d{1,3})\|(\d{1,3})\|(.+)$/)
  if (!match) throw new Error('Unexpected verse line in Tanzil download')
  const chapter = Number(match[1]), ayah = Number(match[2])
  if (chapter < 1 || chapter > chapters.length || ayah < 1 || ayah > chapters[chapter - 1].verses) throw new Error(`Invalid verse ${chapter}:${ayah}`)
  verses.push([`${chapter}:${ayah}`, match[3]])
}
const expectedVerses = chapters.reduce((count, chapter) => count + chapter.verses, 0)
if (verses.length !== expectedVerses || new Set(verses.map(([key]) => key)).size !== expectedVerses || verses[0][0] !== '1:1' || verses.at(-1)[0] !== '114:6') throw new Error('Incomplete Tanzil verse set')

const output = fileURLToPath(new URL('../src/verses.json', import.meta.url))
await writeFile(output, JSON.stringify({ source: { name: 'Tanzil Quran Text', type: 'Uthmani', version: '1.1', sha256, download: 'https://tanzil.net/download/', notice }, verses }) + '\n')
await writeFile(fileURLToPath(new URL('../public/tanzil-text-NOTICE.txt', import.meta.url)), notice + '\n')
console.log(`Wrote ${verses.length} verses to ${output}`)
