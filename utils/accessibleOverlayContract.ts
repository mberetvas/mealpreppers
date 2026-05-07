/**
 * Accessible overlay contract (recipe/planner UI).
 *
 * Standardizes: Tab focus cycling within an open overlay, optional Escape to dismiss,
 * stacking-safe `inert` on the Nuxt app shell while modal overlays are open, and
 * restoring keyboard focus after close. Consumers remain Vue components; this module
 * holds DOM-only primitives so behavior can be tested without Nuxt runtime.
 */

/** Public label for assertions and release notes (not a runtime protocol). */
export const ACCESSIBLE_OVERLAY_CONTRACT_LABEL = 'accessible-overlay-contract-v1'

const FOCUSABLE_SELECTOR = [
  'a[href]:not([inert])',
  'button:not([disabled]):not([inert])',
  'input:not([disabled]):not([inert])',
  'select:not([disabled]):not([inert])',
  'textarea:not([disabled]):not([inert])',
  '[tabindex]:not([tabindex="-1"]):not([inert])',
].join(',')

let appRootInertDepth = 0
let appRootInertSnapshot: string | null = null

function getDefaultAppRoot(): HTMLElement | null {
  return document.getElementById('__nuxt') ?? document.body
}

/**
 * Marks the Nuxt app root inert while at least one consumer holds the lock.
 * Call the returned release function when the overlay closes.
 */
export function pushAppRootInert(appRoot: HTMLElement | null = getDefaultAppRoot()): () => void {
  if (!appRoot) {
    return () => {}
  }
  appRootInertDepth += 1
  if (appRootInertDepth === 1) {
    appRootInertSnapshot = appRoot.getAttribute('inert')
    appRoot.setAttribute('inert', '')
  }
  return () => {
    appRootInertDepth = Math.max(0, appRootInertDepth - 1)
    if (appRootInertDepth === 0 && appRoot) {
      if (appRootInertSnapshot === null) {
        appRoot.removeAttribute('inert')
      }
      else {
        appRoot.setAttribute('inert', appRootInertSnapshot)
      }
      appRootInertSnapshot = null
    }
  }
}

/** Returns visible, focusable descendants in tab order within `root`. */
export function collectFocusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  const out: HTMLElement[] = []
  nodes.forEach((el) => {
    if (!root.contains(el)) return
    if (!isElementVisible(el)) return
    out.push(el)
  })
  return out
}

function isElementVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('inert')) return false
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  return true
}

/**
 * Applies modal focus-trap rules for Tab / Shift+Tab within `scope`.
 * Returns true when the event was fully handled (caller should preventDefault).
 */
export function handleFocusTrapKeydown(event: KeyboardEvent, scope: HTMLElement): boolean {
  if (event.key !== 'Tab' || event.defaultPrevented) return false
  const items = collectFocusableElements(scope)
  if (items.length === 0) return false

  const active = document.activeElement as HTMLElement | null
  if (active && !scope.contains(active)) {
    items[0]?.focus()
    return true
  }

  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return false

  if (event.shiftKey) {
    if (active === first) {
      last.focus()
      return true
    }
  }
  else if (active === last) {
    first.focus()
    return true
  }
  return false
}
