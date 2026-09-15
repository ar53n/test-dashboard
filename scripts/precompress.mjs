// Предварительное gzip-сжатие статики для nginx `gzip_static on`:
// рядом с файлом кладётся file.gz, и nginx отдаёт его без сжатия на каждый запрос.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = new URL('../dist/', import.meta.url).pathname
const COMPRESSIBLE = /\.(js|css|html|svg|json|txt)$/
const MIN_BYTES = 1024

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

let count = 0
for await (const path of walk(DIST)) {
  if (!COMPRESSIBLE.test(path) || (await stat(path)).size < MIN_BYTES) continue
  const gzipped = gzipSync(await readFile(path), { level: 9 })
  await writeFile(`${path}.gz`, gzipped)
  count += 1
}
console.log(`Сжато файлов: ${count}`)
