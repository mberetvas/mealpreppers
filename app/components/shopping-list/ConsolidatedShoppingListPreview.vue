<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import type { SavedConsolidatedShoppingListRecord } from '~~/server/services/shopping-list/consolidatedShoppingListRepository'
import ShoppingListAisleSection from '~/components/shopping-list/AisleSection.vue'
import ShoppingListConsolidatedListCopyNotice from '~/components/shopping-list/ConsolidatedListCopyNotice.vue'

/**
 * Read-only modal that previews a plan's consolidated shopping list without leaving
 * the current page. Never calls the consolidation API.
 *
 * Three states driven by hasSavedShoppingList + shoppingListDeprecated:
 *   ready    — fetches and displays aisle-grouped lines (readonly)
 *   outdated — shows an outdated warning; no fetch, no lines
 *   no-list  — shows empty-state copy; no fetch, no lines
 *
 * All states show an "Open full list" link to /shopping-list?plan=<id>.
 */
const props = withDefaults(defineProps<{
  /** ID of the plan whose shopping list is previewed. */
  planId: string
  /** True when a consolidated shopping list row exists for this plan. */
  hasSavedShoppingList: boolean
  /** True when the saved list's fingerprint no longer matches the current plan body. */
  shoppingListDeprecated: boolean
  /** True when the list was inherited via copy-on-match — shows the copy notice. */
  shoppingListCopiedFromMatch?: boolean
  /** Controls modal visibility. */
  open: boolean
  /**
   * Override the GET fetch for testing. Defaults to $fetch on the saved list endpoint.
   * Only called in the Ready state when the modal opens.
   */
  fetchSavedList?: (planId: string) => Promise<SavedConsolidatedShoppingListRecord>
}>(), {
  shoppingListCopiedFromMatch: false,
  fetchSavedList: undefined,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

/** Which of the three content states to render. */
const viewState = computed<'ready' | 'outdated' | 'no-list'>(() => {
  if (!props.hasSavedShoppingList) return 'no-list'
  if (props.shoppingListDeprecated) return 'outdated'
  return 'ready'
})

/** Resolved lines for the Ready state. Reset on each open. */
const lines = ref<MergedLine[]>([])
const loading = ref(false)
const fetchError = ref<string | null>(null)

/** Full-list href used by the Open full list link in all states. */
const fullListHref = computed(() => ({
  path: '/shopping-list',
  query: { plan: props.planId },
}))

/** Fetches saved list lines from the server. Only called in Ready state. */
async function loadLines(): Promise<void> {
  const fetcher = props.fetchSavedList
    ?? ((id: string) => $fetch<SavedConsolidatedShoppingListRecord>(
      `/api/v1/saved-weekplans/${id}/consolidated-shopping-list`,
      { method: 'GET' },
    ))

  loading.value = true
  fetchError.value = null
  try {
    const result = await fetcher(props.planId)
    lines.value = result.lines.map(l => ({
      ...l,
      provenance: [] as { recipeId: string, recipeTitle: string }[],
    }))
  }
  catch (err) {
    fetchError.value = err instanceof Error ? err.message : 'Could not load shopping list.'
  }
  finally {
    loading.value = false
  }
}

/** Each time the modal opens, reset lines and fetch anew (Ready state only). */
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    lines.value = []
    fetchError.value = null
    if (viewState.value === 'ready') {
      await loadLines()
    }
  },
  { immediate: true },
)

/** Closes the modal by emitting an update:open event. */
function close(): void {
  emit('update:open', false)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
    aria-modal="true"
    role="presentation"
    @click.self="close"
  >
    <div
      data-testid="preview-modal"
      role="dialog"
      aria-labelledby="preview-modal-title"
      class="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-atelier-panel ring-1 ring-primary/15"
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4">
          <h2
            id="preview-modal-title"
            class="font-headline text-lg font-bold text-atelier-heading"
          >
            Shopping list
          </h2>
          <button
            type="button"
            aria-label="Close preview"
            class="inline-flex size-9 items-center justify-center rounded-full text-atelier-neutral-action transition hover:bg-atelier-chip hover:text-atelier-heading"
            @click="close"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="max-h-[60vh] overflow-y-auto px-5 pb-2">
          <!-- Copy notice (issue 0006) — shown on first open after copy-on-match -->
          <ShoppingListConsolidatedListCopyNotice
            :plan-id="planId"
            :shopping-list-copied-from-match="shoppingListCopiedFromMatch"
            class="mb-4"
          />

          <!-- Ready state: aisle-grouped lines -->
          <template v-if="viewState === 'ready'">
            <div
              v-if="loading"
              class="py-6 text-center text-sm text-atelier-description"
              aria-busy="true"
            >
              <span class="material-symbols-outlined animate-spin text-[22px] text-primary" aria-hidden="true">progress_activity</span>
            </div>
            <p
              v-else-if="fetchError"
              role="alert"
              class="rounded-xl bg-atelier-cream-error px-4 py-3 text-sm text-atelier-error-foreground"
            >
              {{ fetchError }}
            </p>
            <ShoppingListAisleSection
              v-else
              :lines="lines"
              :readonly="true"
            />
          </template>

          <!-- Outdated state: warning only -->
          <div
            v-else-if="viewState === 'outdated'"
            data-testid="outdated-warning"
            class="flex items-start gap-3 rounded-2xl bg-atelier-cream-warning px-4 py-3 text-sm text-atelier-warning-foreground"
            role="status"
            aria-live="polite"
          >
            <span class="material-symbols-outlined shrink-0 text-[20px]" aria-hidden="true">warning</span>
            <span>
              <strong>Shopping list is outdated.</strong> Your recipes have changed since this list was last consolidated. Open the full list to reconsolidate.
            </span>
          </div>

          <!-- No list state: empty state -->
          <div
            v-else
            data-testid="empty-state"
            class="flex flex-col items-center gap-3 py-8 text-center"
          >
            <span class="material-symbols-outlined text-[36px] text-atelier-neutral-action" aria-hidden="true">shopping_cart</span>
            <p class="text-sm text-atelier-description">
              No shopping list yet. Open the full list to consolidate your recipes into a unified list.
            </p>
          </div>
        </div>

        <!-- Footer: Open full list link always present -->
        <div class="flex justify-end border-t border-outline-variant/20 px-5 py-4">
          <NuxtLink
            data-testid="open-full-list"
            :to="fullListHref"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
            @click="close"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
            Open full list
          </NuxtLink>
        </div>
      </div>
  </div>
</template>
