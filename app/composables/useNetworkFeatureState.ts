import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import { isDesktopShell } from '../../utils/desktopRuntime'
import { invokeDesktopCommand } from '../utils/tauriDesktop'

export interface NetworkFeatureState {
  isOnline: Readonly<Ref<boolean>>
  hasOpenRouterKey: Readonly<Ref<boolean>>
  offline: ComputedRef<boolean>
  missingApiKey: ComputedRef<boolean>
  onlineReady: ComputedRef<boolean>
  /** `true` on Desktop during the planner-safe cutover phase (phase 1 only). */
  desktopCutover: ComputedRef<boolean>
  refreshOpenRouterKeyState: () => Promise<void>
}

/**
 * Shared client state for network-dependent features (AI polish, recipe URL import).
 * On desktop, OpenRouter key presence comes from the OS keychain via Tauri IPC.
 */
export function useNetworkFeatureState(): NetworkFeatureState {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const hasOpenRouterKey = ref(false)

  async function refreshOpenRouterKeyState(): Promise<void> {
    if (!isDesktopShell()) {
      hasOpenRouterKey.value = true
      return
    }

    const configured = await invokeDesktopCommand<boolean>('has_openrouter_key')
    hasOpenRouterKey.value = configured === true
  }

  function handleOnline(): void {
    isOnline.value = true
  }

  function handleOffline(): void {
    isOnline.value = false
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void refreshOpenRouterKeyState()
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  const offline = computed(() => !isOnline.value)
  const missingApiKey = computed(() => isDesktopShell() && !hasOpenRouterKey.value)
  const onlineReady = computed(() => isOnline.value && !missingApiKey.value)
  // Desktop phase-1 cutover: consolidated shopping and recipe URL import are deferred.
  const desktopCutover = computed(() => false)

  return {
    isOnline,
    hasOpenRouterKey,
    offline,
    missingApiKey,
    onlineReady,
    desktopCutover,
    refreshOpenRouterKeyState,
  }
}

/** User-facing hint when AI polish cannot run due to connectivity or missing key. */
export function buildAiPolishUnavailableMessage(
  offline: boolean,
  missingApiKey: boolean,
  serverWarning?: string,
): string {
  if (offline) {
    return 'You are offline. AI shopping-list polish needs an internet connection and a configured OpenRouter key in Settings.'
  }
  if (missingApiKey) {
    return 'Add an OpenRouter API key in Settings to enable AI shopping-list polish.'
  }
  return serverWarning ?? 'AI polish was not applied. Configure OpenRouter in Settings or retry when online.'
}

/**
 * User-facing hint when recipe URL import is unavailable.
 *
 * `desktopCutover` takes priority over generic offline copy because it provides
 * a more specific explanation during the Desktop phase-1 cutover.
 */
export function buildRecipeImportUnavailableMessage(offline: boolean, desktopCutover?: boolean): string {
  if (desktopCutover) {
    return 'Recipe URL import is not available in the current desktop version. Use manual entry to add your recipe.'
  }
  if (offline) {
    return 'Recipe URL import requires an internet connection. Switch to manual entry or try again when online.'
  }
  return 'Recipe URL import is unavailable right now.'
}

/** User-facing hint when consolidated shopping is unavailable during Desktop phase-1 cutover. */
export function buildConsolidatedShoppingUnavailableMessage(): string {
  return 'Consolidated shopping list is not available yet. Use Recipe sections for offline shopping.'
}
