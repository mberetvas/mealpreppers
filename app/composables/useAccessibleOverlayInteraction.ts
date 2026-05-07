import type { Ref } from 'vue'
import {
  collectFocusableElements,
  handleFocusTrapKeydown,
  pushAppRootInert,
} from '~~/utils/accessibleOverlayContract'

export interface UseAccessibleOverlayInteractionOptions {
  /** When true, the Nuxt app root is marked inert while the overlay is open. */
  lockBackground: boolean
  open: Ref<boolean>
  /** DOM subtree that receives Tab focus cycling while open. */
  scopeRef: Ref<HTMLElement | null>
  /** Preferred focus target after close; when omitted, uses the element focused when the overlay opened. */
  restoreFocusRef?: Ref<HTMLElement | null | undefined>
  onRequestClose: () => void
  /** Return an element to focus when the overlay opens; defaults to the first focusable inside `scopeRef`. */
  getInitialFocus?: () => HTMLElement | null | undefined
}

/**
 * Wires Escape-to-close, Tab focus trap within `scopeRef`, optional app-root inert for modals,
 * and focus restoration when the overlay closes.
 */
export function useAccessibleOverlayInteraction(options: UseAccessibleOverlayInteractionOptions): void {
  let releaseInert: (() => void) | null = null
  let capturedFocus: HTMLElement | null = null

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (!options.open.value) return
    const scope = options.scopeRef.value
    if (!scope) return

    if (event.key === 'Escape') {
      event.preventDefault()
      options.onRequestClose()
      return
    }

    if (handleFocusTrapKeydown(event, scope)) {
      event.preventDefault()
    }
  }

  function teardownOpenState(): void {
    document.removeEventListener('keydown', onDocumentKeydown, true)
    releaseInert?.()
    releaseInert = null
    const preferred = options.restoreFocusRef?.value ?? capturedFocus
    if (preferred && typeof preferred.focus === 'function') {
      preferred.focus()
    }
    capturedFocus = null
  }

  watch(
    options.open,
    async (isOpen, wasOpen) => {
      if (wasOpen === true && !isOpen) {
        teardownOpenState()
        return
      }
      if (!isOpen) return

      capturedFocus = (options.restoreFocusRef?.value as HTMLElement | null | undefined)
        ?? (document.activeElement as HTMLElement | null)
      if (options.lockBackground) {
        releaseInert = pushAppRootInert()
      }
      await nextTick()
      const scope = options.scopeRef.value
      if (!scope) {
        teardownOpenState()
        return
      }
      const initial = options.getInitialFocus?.() ?? collectFocusableElements(scope)[0]
      initial?.focus()
      document.addEventListener('keydown', onDocumentKeydown, true)
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    if (options.open.value) {
      teardownOpenState()
    }
  })
}
