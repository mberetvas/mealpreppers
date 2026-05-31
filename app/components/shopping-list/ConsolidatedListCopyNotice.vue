<script setup lang="ts">
import { ref, computed, watch } from 'vue'

/**
 * Dismissible banner shown on the first open of the shopping-list page (or preview
 * modal) when the plan's shopping list was inherited from a matching week's confirmed
 * list via copy-on-match.
 *
 * Visibility is driven by `shoppingListCopiedFromMatch`. Once dismissed, the state
 * is persisted in localStorage keyed by `planId` so it never reappears — even across
 * sessions — without a server round-trip.
 */
const props = defineProps<{
  /** Plan ID used to scope the localStorage dismiss key. */
  planId: string
  /** True when the plan's shopping list was copied from a matching confirmed list. */
  shoppingListCopiedFromMatch: boolean
}>()

/** Returns the localStorage key for this plan's dismiss state. */
function dismissStorageKey(id: string): string {
  return `consolidated-list-copy-notice-dismissed:${id}`
}

/** Reads the dismiss state synchronously from localStorage (client only). */
function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(localStorage.getItem(dismissStorageKey(props.planId)))
  }
  catch {
    return false
  }
}

const locallyDismissed = ref(readDismissed())

watch(() => props.planId, () => {
  locallyDismissed.value = readDismissed()
})

const visible = computed(() => props.shoppingListCopiedFromMatch && !locallyDismissed.value)

/** Hides the banner and persists the dismiss state in localStorage. */
function dismiss(): void {
  locallyDismissed.value = true
  try {
    localStorage.setItem(dismissStorageKey(props.planId), '1')
  }
  catch {
    // localStorage unavailable — in-memory dismiss still applies
  }
}
</script>

<template>
  <div
    v-if="visible"
    data-testid="copy-notice-banner"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    class="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl bg-atelier-chip px-4 py-3 font-body text-sm text-atelier-heading shadow-sm"
  >
    <span class="material-symbols-outlined shrink-0 text-[20px] text-primary" aria-hidden="true">info</span>
    <span class="flex-1">
      Your shopping list was <strong>copied</strong> from a matching week's confirmed list.
      Review it if needed.
    </span>
    <button
      type="button"
      aria-label="Dismiss"
      class="ml-auto shrink-0 rounded-full p-0.5 leading-none hover:opacity-70"
      @click="dismiss"
    >
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
    </button>
  </div>
</template>
