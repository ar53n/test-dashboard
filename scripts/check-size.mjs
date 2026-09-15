// Бюджет бандла: сумма gzip-размеров JS и CSS в dist не должна превышать лимит.
// Запуск: npm run size (после npm run build). Код выхода 1 — бюджет превышен.
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = new URL('../dist/', import.meta.url).pathname
const LIMIT_KB = Number(process.env.BUNDLE_LIMIT_KB ?? 200)

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

const rows = []
try {
  for await (const path of walk(DIST)) {
    if (!/\.(js|css)$/.test(path)) continue
    const content = await readFile(path)
    rows.push({ file: relative(DIST, path), raw: content.length, gzip: gzipSync(content, { level: 9 }).length })
  }
} catch (error) {
  console.error(`Не удалось прочитать ${DIST}: ${error.message}. Сначала выполните npm run build.`)
  process.exit(1)
}

if (rows.length === 0) {
  console.error('В dist нет JS/CSS. Сначала выполните npm run build.')
  process.exit(1)
}

const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(8)
rows.sort((a, b) => b.gzip - a.gzip)
for (const row of rows) console.log(`${kb(row.raw)} КБ  ${kb(row.gzip)} КБ gzip  ${row.file}`)

const total = rows.reduce((sum, row) => sum + row.gzip, 0)
const ok = total <= LIMIT_KB * 1024
console.log(`\nИтого gzip: ${(total / 1024).toFixed(1)} КБ из ${LIMIT_KB} КБ — ${ok ? 'в бюджете' : 'БЮДЖЕТ ПРЕВЫШЕН'}`)
process.exit(ok ? 0 : 1)
