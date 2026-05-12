import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRootPath = fileURLToPath(new URL('../../', import.meta.url))
const envExamplePath = join(repoRootPath, '.env.example')
const nuxtConfigPath = join(repoRootPath, 'nuxt.config.ts')
const serverRootPath = join(repoRootPath, 'server')

/** Collects source files from a directory tree. */
function collectSourceFiles(directoryPath: string): string[] {
  const sourceFilePaths: string[] = []

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      sourceFilePaths.push(...collectSourceFiles(entryPath))
      continue
    }

    if (/\.(?:[cm]?ts|[cm]?js)$/.test(entry.name)) {
      sourceFilePaths.push(entryPath)
    }
  }

  return sourceFilePaths
}

/** Extracts unique environment variable names referenced as process.env.NAME. */
function extractReferencedEnvNames(sourceText: string): string[] {
  return [...sourceText.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
    .map(([, variableName]) => variableName)
    .filter((variableName, index, allNames) => allNames.indexOf(variableName) === index)
    .sort()
}

/** Extracts variable names declared or documented in .env.example. */
function extractDocumentedEnvNames(sourceText: string): string[] {
  return [...sourceText.matchAll(/^(?:#\s*)?([A-Z0-9_]+)=/gm)]
    .map(([, variableName]) => variableName)
    .filter((variableName, index, allNames) => allNames.indexOf(variableName) === index)
    .sort()
}

describe('.env.example', () => {
  it('documents every environment variable used by server-side source files', () => {
    const documentedEnvNames = extractDocumentedEnvNames(readFileSync(envExamplePath, 'utf8'))
    const sourceFilePaths = [nuxtConfigPath, ...collectSourceFiles(serverRootPath)]
    const referencedEnvNames = sourceFilePaths
      .flatMap((sourceFilePath) => extractReferencedEnvNames(readFileSync(sourceFilePath, 'utf8')))
      .filter((variableName, index, allNames) => allNames.indexOf(variableName) === index)
      .sort()

    expect(documentedEnvNames).toEqual(referencedEnvNames)
  })
})
