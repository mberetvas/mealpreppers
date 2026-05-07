import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DESIGN_TOKEN_COMPLIANCE_SOURCE_FILES } from '../../app/constants/designTokenCompliance'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** Catches Tailwind arbitrary hex (`bg-[#fff]`) and inline `#rrggbb` in templates. */
const RAW_HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/

describe('design token compliance (audited recipe / planner surfaces)', () => {
  for (const relative of DESIGN_TOKEN_COMPLIANCE_SOURCE_FILES) {
    it(`${relative} does not embed raw hex color literals`, () => {
      const fullPath = join(repoRoot, relative)
      const source = readFileSync(fullPath, 'utf8')
      const match = source.match(RAW_HEX_COLOR)
      expect(match, `${relative} contains hex literal: ${match?.[0] ?? ''}`).toBeNull()
    })
  }
})
