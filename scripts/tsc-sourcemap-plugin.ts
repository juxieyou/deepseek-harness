import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

const TYPES_MARKER = `${sep}lib${sep}types${sep}`
const SOURCEMAP_COMMENT = /\n\/\/# sourceMappingURL=.*\s*$/

/** Chain tsc's emitted maps into a bundle that consumes `lib/types` JavaScript. */
export function tscSourceMapPlugin() {
  return {
    name: 'dsh-tsc-sourcemap',
    async load(id: string) {
      if (!id.includes(TYPES_MARKER) || !id.endsWith('.js') || !existsSync(`${id}.map`)) return null
      const code = await readFile(id, 'utf8')
      const mapPath = `${id}.map`
      const map = JSON.parse(await readFile(mapPath, 'utf8')) as {
        sourceRoot?: unknown
        sources?: unknown
        sourcesContent?: unknown
        [key: string]: unknown
      }
      if (!Array.isArray(map.sources) || map.sources.some(source => typeof source !== 'string')) {
        throw new Error(`tsc sourcemap: ${mapPath} has invalid sources`)
      }
      const sources = map.sources as string[]
      if (
        !Array.isArray(map.sourcesContent)
        || map.sourcesContent.length !== sources.length
        || map.sourcesContent.some(source => typeof source !== 'string')
      ) {
        const sourceRoot = typeof map.sourceRoot === 'string' ? map.sourceRoot : ''
        map.sourcesContent = await Promise.all(sources.map(async source =>
          await readFile(resolve(dirname(mapPath), sourceRoot, source), 'utf8')))
      }
      return { code: code.replace(SOURCEMAP_COMMENT, ''), map }
    },
  }
}
