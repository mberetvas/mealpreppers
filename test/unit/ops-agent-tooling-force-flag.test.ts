import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../..')

describe('ops agent tooling --force flag documentation', () => {
  describe('scripts/code-review.ps1', () => {
    const content = readFileSync(
      resolve(ROOT, 'scripts/code-review.ps1'),
      'utf-8',
    )

    it('has a clearly visible warning about trusted-local-only use of --force', () => {
      expect(content).toMatch(/TRUSTED.LOCAL.ONLY/i)
      expect(content).toMatch(/--force/)
      expect(content).toMatch(
        /must not.*(?:shared|production)|do not.*(?:shared|production)/i,
      )
    })

    it('includes an example showing invocation without --force for read-only review runs', () => {
      expect(content).toMatch(/read.only/i)
      expect(content).toMatch(/without.*--force|omit.*--force/i)
    })
  })

  describe('Docs/ralph-loop/cursor-ralph-loop.ps1', () => {
    const content = readFileSync(
      resolve(ROOT, 'Docs/ralph-loop/cursor-ralph-loop.ps1'),
      'utf-8',
    )

    it('has a clearly visible warning about --force being trusted-local-only', () => {
      expect(content).toMatch(/TRUSTED.LOCAL.ONLY/i)
      expect(content).toMatch(/--force/)
    })

    it('has a clearly visible warning about --trust being trusted-local-only', () => {
      expect(content).toMatch(/--trust/)
    })

    it('has a clearly visible warning about --approve-mcps being trusted-local-only', () => {
      expect(content).toMatch(/--approve-mcps/)
    })

    it('warns against use on shared machines or production environments', () => {
      expect(content).toMatch(
        /must not.*(?:shared|production)|do not.*(?:shared|production)/i,
      )
    })
  })
})
