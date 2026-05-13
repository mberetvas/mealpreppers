import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Verifies that the saved-weekplans page template contains a shopping cart
 * entry point for each plan card, as specified in issue 004.
 *
 * These are source-inspection tests: the page is a Nuxt SFC with top-level
 * await, so mounting it in a unit test would require too many Nuxt stubs. The
 * source assertions are the canonical way to gate template-only changes in this
 * codebase (see component-vocabulary-contract.test.ts and
 * touch-ergonomics-contract.test.ts for the same pattern).
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const pageSource = readFileSync(
  join(repoRoot, 'app', 'pages', 'saved-weekplans.vue'),
  'utf8',
)

describe('saved-weekplans page: shopping cart entry point (issue 004)', () => {
  it('renders a shopping_cart Material Symbol icon inside the card actions row', () => {
    expect(pageSource).toContain('shopping_cart')
  })

  it('navigates to /shopping-list with the plan id as a query param', () => {
    // The template uses either a string URL (/shopping-list?plan=…) or the
    // object form { path: '/shopping-list', query: { plan: item.id } }.
    expect(pageSource).toContain('/shopping-list')
    expect(pageSource).toMatch(/plan.*item\.id|\/shopping-list.*plan=/)
  })

  it('uses a NuxtLink (not a plain anchor) for the shopping list button', () => {
    const shoppingCartIdx = pageSource.indexOf('shopping_cart')
    expect(shoppingCartIdx).toBeGreaterThan(-1)
    // Find the NuxtLink that wraps the shopping_cart icon by looking backwards
    // from the icon for the opening tag.
    const before = pageSource.slice(0, shoppingCartIdx)
    const nuxtLinkIdx = before.lastIndexOf('<NuxtLink')
    expect(nuxtLinkIdx).toBeGreaterThan(-1)
    // Ensure no closing </NuxtLink> sits between that opening tag and the icon
    // (i.e. the icon is inside the link, not after it).
    const between = pageSource.slice(nuxtLinkIdx, shoppingCartIdx)
    expect(between).not.toContain('</NuxtLink>')
  })

  it('sets aria-label that includes "Shopping list for"', () => {
    // Accepts both static aria-label="Shopping list for …"
    // and dynamic :aria-label="`Shopping list for …`"
    expect(pageSource).toMatch(/aria-label[^>]*Shopping list for/)
  })

  it('is visually consistent with the Rename icon button (same min-h/min-w/rounded classes)', () => {
    // Rename button uses: min-h-11 min-w-11 rounded-xl
    const shoppingCartIdx = pageSource.indexOf('shopping_cart')
    expect(shoppingCartIdx).toBeGreaterThan(-1)
    const before = pageSource.slice(0, shoppingCartIdx)
    const nuxtLinkIdx = before.lastIndexOf('<NuxtLink')
    const snippet = pageSource.slice(nuxtLinkIdx, shoppingCartIdx + 20)
    expect(snippet).toContain('min-h-11')
    expect(snippet).toContain('min-w-11')
    expect(snippet).toContain('rounded-xl')
  })

  it('appears in tab order between the Rename and Delete icon buttons', () => {
    // In the template, shopping_cart must appear after the edit icon and before
    // the delete icon within the card actions block.
    const editIdx = pageSource.indexOf('>edit<')
    const shoppingCartIdx = pageSource.indexOf('shopping_cart')
    const deleteIdx = pageSource.indexOf('>delete<')
    expect(editIdx).toBeGreaterThan(-1)
    expect(shoppingCartIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    expect(shoppingCartIdx).toBeGreaterThan(editIdx)
    expect(shoppingCartIdx).toBeLessThan(deleteIdx)
  })

  it('leaves the empty-state section unaffected (no shopping_cart in empty state)', () => {
    // The empty-state section uses v-else-if="!hasPlans"; the shopping cart icon
    // must only appear inside the v-for list item, not in the empty-state block.
    const emptyStateEnd = pageSource.indexOf('v-else class="space-y-4"')
    expect(emptyStateEnd).toBeGreaterThan(-1)
    const emptyStateSection = pageSource.slice(0, emptyStateEnd)
    expect(emptyStateSection).not.toContain('shopping_cart')
  })
})
