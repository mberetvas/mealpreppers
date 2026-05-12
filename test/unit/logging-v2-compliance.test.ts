/**
 * Logging V2 compliance — structural invariant and documentation correctness tests.
 *
 * Enforces three auditable guarantees:
 * 1. The **Application Logger** module (`server/utils/logger.ts`) is the only file that
 *    may import `consola` directly.
 * 2. The trace-context middleware (`server/middleware/01.trace-context.ts`) is the only
 *    file that may read the `x-trace-id` header directly, preserving single-ownership
 *    of **Trace Header Precedence**.
 * 3. Key logger modules carry the canonical terminology from CONTEXT.md in their doc
 *    comments so future contributors can recognise the project vocabulary on sight.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SERVER_DIR = resolve(__dirname, '../../server')
const LOGGER_MODULE = resolve(SERVER_DIR, 'utils/logger.ts')
const TRACE_MIDDLEWARE = resolve(SERVER_DIR, 'middleware/01.trace-context.ts')
const DIAGNOSTICS_MIDDLEWARE = resolve(SERVER_DIR, 'middleware/02.request-diagnostics.ts')
const PLANNING_CONTEXT_MODULE = resolve(SERVER_DIR, 'services/planning/planningRequestContext.ts')

/** Recursively collects every `.ts` file under `dir`. */
function collectTsFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full))
    }
    else if (entry.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

// ---------------------------------------------------------------------------
// consola import boundary
// ---------------------------------------------------------------------------

describe('Logging V2 compliance — consola import boundary', () => {
  it('no server module imports consola directly except server/utils/logger.ts', () => {
    const serverFiles = collectTsFiles(SERVER_DIR).filter(f => f !== LOGGER_MODULE)
    const violators = serverFiles.filter((f) => {
      const content = readFile(f)
      return /from ['"]consola['"]|require\(['"]consola['"]\)/.test(content)
    })
    const rel = violators.map(f => relative(SERVER_DIR, f))
    expect(
      rel,
      `Direct consola imports found outside the shared Application Logger: ${rel.join(', ')}`,
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// x-trace-id header read boundary
// ---------------------------------------------------------------------------

describe('Logging V2 compliance — x-trace-id header read boundary', () => {
  it('no server module reads x-trace-id header directly except server/middleware/01.trace-context.ts', () => {
    const serverFiles = collectTsFiles(SERVER_DIR).filter(f => f !== TRACE_MIDDLEWARE)
    const violators = serverFiles.filter((f) => {
      const content = readFile(f)
      return /getHeader\s*\([^)]*['"]x-trace-id['"]\)|headers\s*\[\s*['"]x-trace-id['"]\s*\]/.test(content)
    })
    const rel = violators.map(f => relative(SERVER_DIR, f))
    expect(
      rel,
      `Raw x-trace-id reads found outside trace-resolution ownership: ${rel.join(', ')}`,
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Canonical terminology in logger-module doc comments
// ---------------------------------------------------------------------------

describe('Logging V2 compliance — canonical terminology in logger-module doc comments', () => {
  it('server/utils/logger.ts uses Application Logger, Log Configuration, Log Level, and Log Redaction', () => {
    const content = readFile(LOGGER_MODULE)
    expect(content).toContain('Application Logger')
    expect(content).toContain('Log Configuration')
    expect(content).toContain('Log Level')
    expect(content).toContain('Log Redaction')
  })

  it('server/middleware/01.trace-context.ts uses Trace ID, Trace Header Precedence, and Request Context Trace ID', () => {
    const content = readFile(TRACE_MIDDLEWARE)
    expect(content).toContain('Trace ID')
    expect(content).toContain('Trace Header Precedence')
    expect(content).toContain('Request Context Trace ID')
  })

  it('server/middleware/02.request-diagnostics.ts uses Request Diagnostics Logging', () => {
    const content = readFile(DIAGNOSTICS_MIDDLEWARE)
    expect(content).toContain('Request Diagnostics Logging')
  })

  it('server/services/planning/planningRequestContext.ts uses Planning Request Context', () => {
    const content = readFile(PLANNING_CONTEXT_MODULE)
    expect(content).toContain('Planning Request Context')
  })
})
