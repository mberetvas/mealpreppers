<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { useAccessibleOverlayInteraction } from '~/composables/useAccessibleOverlayInteraction'
import { LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS } from '~/constants/listImageLoadingStrategy'
import { filterRecipesForPlanner } from '~~/utils/recipeFiltering'

const props = withDefaults(defineProps<{
  open: boolean
  /** Element to return focus to after close (e.g. the control that opened the modal). */
  focusRestoreTarget?: HTMLElement | null
  recipes: RecipeCatalogItem[]
  categories: string[]
  recentlyUsedIds?: string[]
  duplicateBanner?: string | null
  /** Recipe id pending confirmation when `duplicateBanner` is set. */
  stagedRecipeId?: string | null
}>(), {
  recentlyUsedIds: () => [],
  duplicateBanner: null,
  stagedRecipeId: null,
  focusRestoreTarget: null,
})

const emit = defineEmits<{
  close: []
  pick: [recipeId: string, forceDuplicate?: boolean]
}>()

const query = ref('')
const category = ref('')
const maxTime = ref<number | null>(null)

const overlayRootRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const restoreFocusRef = computed(() => props.focusRestoreTarget ?? undefined)

const filtered = computed(() =>
  filterRecipesForPlanner(props.recipes, {
    query: query.value,
    category: category.value,
    maxTotalTimeMinutes: maxTime.value,
    sortBy: 'updatedAt',
  }),
)

const recentRecipes = computed(() => {
  const byId = new Map(props.recipes.map(r => [r.id, r]))
  return props.recentlyUsedIds.map(id => byId.get(id)).filter(Boolean) as RecipeCatalogItem[]
})

const timeChips = [15, 30, 45, 60] as const

function toggleTime(mins: number): void {
  maxTime.value = maxTime.value === mins ? null : mins
}

watch(() => props.open, (o) => {
  if (!o) {
    query.value = ''
    category.value = ''
    maxTime.value = null
  }
})

useAccessibleOverlayInteraction({
  open: toRef(props, 'open'),
  scopeRef: overlayRootRef,
  restoreFocusRef,
  lockBackground: true,
  onRequestClose: () => emit('close'),
  getInitialFocus: () => searchRef.value,
})

function pick(id: string, force = false): void {
  emit('pick', id, force)
}

function confirmDuplicateAnyway(): void {
  const id = props.stagedRecipeId
  if (!id) return
  pick(id, true)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="overlayRootRef"
      class="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose recipe"
      @click.self="emit('close')"
    >
      <div
        class="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-surface-container-lowest shadow-atelier-panel ring-1 ring-outline-variant/15 md:max-h-[80vh] md:w-[400px]"
      >
        <div class="bg-surface-container-low p-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-headline text-xl font-semibold text-on-surface">
              Recipe library
            </h3>
            <button
              type="button"
              class="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Close"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
            </button>
          </div>
          <input
            ref="searchRef"
            v-model="query"
            type="search"
            class="design-input mt-4 w-full"
            placeholder="Search recipes…"
            autocomplete="off"
          >
        </div>

        <div class="max-h-[52vh] overflow-y-auto p-4">
          <div
            v-if="duplicateBanner"
            class="mb-4 rounded-xl bg-secondary-fixed/40 p-3 font-body text-sm text-on-surface"
          >
            <p>{{ duplicateBanner }}</p>
            <button
              type="button"
              class="mt-2 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-secondary underline-offset-2 hover:underline"
              @click="confirmDuplicateAnyway"
            >
              Assign anyway
            </button>
          </div>
          <p class="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Category
          </p>
          <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              :class="category === '' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-low text-on-surface-variant'"
              @click="category = ''"
            >
              All
            </button>
            <button
              v-for="c in categories"
              :key="c"
              type="button"
              class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              :class="category === c ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-low text-on-surface-variant'"
              @click="category = category === c ? '' : c"
            >
              {{ c }}
            </button>
          </div>

          <p class="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Max time
          </p>
          <div class="mb-6 flex flex-wrap gap-2">
            <button
              v-for="m in timeChips"
              :key="m"
              type="button"
              class="inline-flex min-h-11 items-center justify-center rounded-full px-3.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              :class="maxTime === m ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-low text-on-surface-variant'"
              @click="toggleTime(m)"
            >
              {{ m }} min
            </button>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center rounded-full px-3.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              @click="maxTime = null"
            >
              Any
            </button>
          </div>

          <template v-if="recentRecipes.length > 0">
            <p class="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Recently used
            </p>
            <ul class="mb-6 space-y-2">
              <li v-for="r in recentRecipes" :key="`r-${r.id}`">
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center gap-3 rounded-xl bg-surface-container-low p-3 text-left transition motion-reduce:transition-none hover:bg-primary-fixed/30"
                  @click="pick(r.id)"
                >
                  <div class="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container">
                    <img
                      v-if="r.imageUrl"
                      v-bind="LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS"
                      :src="r.imageUrl"
                      alt=""
                      aria-hidden="true"
                      class="h-full w-full object-cover"
                    >
                  </div>
                  <span class="line-clamp-2 font-body text-sm font-semibold text-on-surface">{{ r.title }}</span>
                </button>
              </li>
            </ul>
          </template>

          <p class="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            All matches
          </p>
          <ul v-if="filtered.length > 0" class="space-y-2">
            <li v-for="r in filtered" :key="r.id">
              <button
                type="button"
                class="flex min-h-11 w-full items-center gap-3 rounded-xl bg-surface-container p-3 text-left transition motion-reduce:transition-none hover:bg-surface-container-high"
                @click="pick(r.id)"
              >
                <div class="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest">
                  <img
                    v-if="r.imageUrl"
                    v-bind="LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS"
                    :src="r.imageUrl"
                    alt=""
                    aria-hidden="true"
                    class="h-full w-full object-cover"
                  >
                </div>
                <span class="line-clamp-2 font-body text-sm font-semibold text-on-surface">{{ r.title }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="py-8 text-center font-body text-sm text-on-surface-variant">
            No recipes match these filters.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
