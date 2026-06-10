<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { filterRecipes } from '~~/utils/recipeFiltering'

const searchQuery = ref('')
const selectedCategory = ref('')
const selectedTag = ref('')
const sortBy = ref<'updatedAt' | 'title'>('updatedAt')
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)
const bulkDeleteError = ref<string | null>(null)
const bulkDeleteStep = ref<'idle' | 'confirm'>('idle')

type FilterPanelKind = 'categories' | 'tags'
const openPanel = ref<FilterPanelKind | null>(null)
const categoriesTriggerRef = ref<HTMLButtonElement | null>(null)
const tagsTriggerRef = ref<HTMLButtonElement | null>(null)

function togglePanel(kind: FilterPanelKind): void {
  openPanel.value = openPanel.value === kind ? null : kind
}

function closePanel(): void {
  if (openPanel.value === null) return
  const lastKind = openPanel.value
  openPanel.value = null
  nextTick(() => {
    if (document.activeElement && document.activeElement !== document.body) return
    const trigger = lastKind === 'categories' ? categoriesTriggerRef.value : tagsTriggerRef.value
    trigger?.focus()
  })
}

watch(selectionMode, (isSelecting) => {
  if (isSelecting) openPanel.value = null
})

const { data: recipes, pending, error, refresh } = await useFetch<RecipeCatalogItem[]>('/api/v1/recipes', {
  default: () => [],
})

const { data: recipeOptions } = await useFetch<{ categories: string[], tags: string[] }>('/api/v1/recipes/options', {
  default: () => ({ categories: [], tags: [] }),
})

const hasAnyRecipes = computed(() => recipes.value.length > 0)

const filteredRecipes = computed(() =>
  filterRecipes(recipes.value, {
    query: searchQuery.value,
    category: selectedCategory.value,
    tag: selectedTag.value,
    sortBy: sortBy.value,
  }),
)

function clearFilters(): void {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedTag.value = ''
}

const selectedCount = computed(() => selectedIds.value.size)

function isSelected(id: string): boolean {
  return selectedIds.value.has(id)
}

function toggleSelection(id: string): void {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  }
  else {
    next.add(id)
  }
  selectedIds.value = next
}

function selectAllFiltered(): void {
  selectedIds.value = new Set(filteredRecipes.value.map(r => r.id))
}

function clearSelection(): void {
  selectedIds.value = new Set()
}

function exitSelectionMode(): void {
  selectionMode.value = false
  bulkDeleteError.value = null
  bulkDeleteStep.value = 'idle'
  clearSelection()
}

function toggleSelectionMode(): void {
  if (selectionMode.value) {
    exitSelectionMode()
  }
  else {
    selectionMode.value = true
    bulkDeleteError.value = null
  }
}

function requestBulkDelete(): void {
  if (selectedIds.value.size === 0 || bulkDeleting.value) return
  bulkDeleteStep.value = 'confirm'
  nextTick(() => {
    const el = document.getElementById('bulk-delete-confirm-heading')
    el?.focus()
  })
}

function cancelBulkDelete(): void {
  bulkDeleteStep.value = 'idle'
}

async function executeBulkDelete(): Promise<void> {
  const ids = [...selectedIds.value]
  if (ids.length === 0 || bulkDeleting.value) return

  bulkDeleting.value = true
  bulkDeleteError.value = null

  try {
    await $fetch<{ deleted: number }>('/api/v1/recipes/bulk-delete', {
      method: 'POST',
      body: { ids },
    })
    await refresh()
    exitSelectionMode()
  }
  catch (e: unknown) {
    let message = 'Recipes could not be deleted.'
    if (typeof e === 'object' && e !== null && 'data' in e) {
      const data = (e as { data?: { statusMessage?: string } }).data
      if (data?.statusMessage) {
        message = data.statusMessage
      }
    }
    else if (e instanceof Error && e.message) {
      message = e.message
    }
    bulkDeleteError.value = message
    bulkDeleteStep.value = 'idle'
  }
  finally {
    bulkDeleting.value = false
  }
}

const cardFrameClass =
  'group w-full overflow-hidden rounded-[28px] bg-atelier-parchment ring-1 ring-primary/10 shadow-atelier-grid-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const cardLinkClass = `${cardFrameClass} block transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none motion-reduce:hover:shadow-atelier-grid-card hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-atelier-grid-card-hover hover:ring-primary/15`
const cardSelectClass = `${cardFrameClass} text-left ring-offset-2 ring-offset-atelier-canvas`

/** DESIGN.md chips: pill shape, token backgrounds; min 44px hit target for kitchen / mobile. */
const filterTriggerClass
  = 'group inline-flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-2xl bg-atelier-parchment px-4 text-left text-sm font-bold text-atelier-heading shadow-atelier-float ring-1 ring-primary/10 transition motion-reduce:transition-none hover:bg-atelier-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
</script>

<template>
  <div class="min-h-screen bg-atelier-canvas px-4 pb-32 pt-8 text-atelier-ink sm:px-6 md:pb-12 lg:px-10">
    <div class="mx-auto grid max-w-7xl gap-8">
      <header class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-atelier-warm-accent">
            Recipe Catalog
          </p>
          <h1 class="mt-3 font-headline text-5xl font-semibold leading-tight text-atelier-heading sm:text-6xl">
            Your Atelier
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-3 lg:justify-end">
          <button
            type="button"
            class="inline-flex min-h-14 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold shadow-atelier-float transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="selectionMode ? 'bg-atelier-chip text-atelier-heading ring-2 ring-primary/25' : 'bg-surface-container-lowest text-atelier-heading ring-1 ring-primary/15'"
            @click="toggleSelectionMode"
          >
            <span class="material-symbols-outlined text-[20px]">{{ selectionMode ? 'close' : 'checklist' }}</span>
            {{ selectionMode ? 'Done' : 'Select' }}
          </button>

          <NuxtLink to="/add-recipe" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition motion-reduce:transition-none hover:bg-atelier-primary-hover">
            <span class="material-symbols-outlined text-[20px]">add</span>
            Add Recipe
          </NuxtLink>
        </div>
      </header>

      <section
        class="grid gap-5 rounded-[28px] bg-atelier-parchment p-4 shadow-atelier-float ring-1 ring-primary/8 sm:p-5"
        aria-label="Search and filter recipes"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <label class="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-inner shadow-primary/5 ring-1 ring-primary/10 focus-within:ring-2 focus-within:ring-primary/45">
            <span class="material-symbols-outlined shrink-0 text-[22px] text-atelier-icon-muted" aria-hidden="true">search</span>
            <input v-model="searchQuery" type="search" class="min-w-0 flex-1 bg-transparent text-base font-medium text-atelier-ink outline-none" placeholder="Search recipes" autocomplete="off">
          </label>

          <div class="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:min-w-[11.5rem]">
            <label for="recipe-catalog-sort" class="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Sort
            </label>
            <select
              id="recipe-catalog-sort"
              v-model="sortBy"
              class="min-h-11 w-full cursor-pointer rounded-full bg-surface-container-low px-3.5 text-xs font-bold text-on-surface-variant outline-none transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <option value="updatedAt">
                Recently updated
              </option>
              <option value="title">
                Title A–Z
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="recipeOptions.categories.length > 0 || recipeOptions.tags.length > 0"
          class="grid gap-3 sm:grid-cols-2"
        >
          <RecipeFilterPicker
            v-if="recipeOptions.categories.length > 0"
            label="Categories"
            panel-id="recipe-filter-panel-categories"
            :options="recipeOptions.categories"
            :model-value="selectedCategory"
            :open="openPanel === 'categories'"
            :searchable="recipeOptions.categories.length > 8"
            search-placeholder="Filter categories"
            @update:model-value="selectedCategory = $event"
            @close="closePanel"
          >
            <template #trigger="{ open, selected, panelId }">
              <button
                ref="categoriesTriggerRef"
                type="button"
                :class="filterTriggerClass"
                :aria-expanded="open"
                :aria-controls="panelId"
                aria-haspopup="dialog"
                @click="togglePanel('categories')"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    Categories
                  </span>
                  <span class="truncate text-sm font-bold text-atelier-heading">
                    {{ selected || 'Any' }}
                  </span>
                </span>
                <span
                  class="material-symbols-outlined text-[20px] text-atelier-neutral-action transition-transform duration-200 ease-out motion-reduce:transition-none"
                  :class="open ? 'rotate-180' : 'rotate-0'"
                  aria-hidden="true"
                >expand_more</span>
              </button>
            </template>
          </RecipeFilterPicker>

          <RecipeFilterPicker
            v-if="recipeOptions.tags.length > 0"
            label="Tags"
            panel-id="recipe-filter-panel-tags"
            :options="recipeOptions.tags"
            :model-value="selectedTag"
            :open="openPanel === 'tags'"
            searchable
            search-placeholder="Filter tags"
            @update:model-value="selectedTag = $event"
            @close="closePanel"
          >
            <template #trigger="{ open, selected, panelId }">
              <button
                ref="tagsTriggerRef"
                type="button"
                :class="filterTriggerClass"
                :aria-expanded="open"
                :aria-controls="panelId"
                aria-haspopup="dialog"
                @click="togglePanel('tags')"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    Tags
                  </span>
                  <span class="truncate text-sm font-bold text-atelier-heading">
                    {{ selected || 'Any' }}
                  </span>
                </span>
                <span
                  class="material-symbols-outlined text-[20px] text-atelier-neutral-action transition-transform duration-200 ease-out motion-reduce:transition-none"
                  :class="open ? 'rotate-180' : 'rotate-0'"
                  aria-hidden="true"
                >expand_more</span>
              </button>
            </template>
          </RecipeFilterPicker>
        </div>
      </section>

      <div v-if="pending" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="index in 6" :key="index" class="h-80 animate-pulse rounded-[28px] bg-atelier-parchment shadow-atelier-grid-card ring-1 ring-primary/10 motion-reduce:animate-none" />
      </div>

      <section v-else-if="error" class="rounded-[28px] bg-atelier-cream-error p-6 text-atelier-error-foreground shadow-atelier-status-error">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <p class="font-semibold">
            Recipes could not be loaded.
          </p>
          <button type="button" class="inline-flex items-center gap-2 rounded-2xl bg-atelier-error-foreground px-5 py-3 text-sm font-bold text-on-primary shadow-atelier-status-error transition hover:brightness-95 motion-reduce:transition-none" @click="refresh()">
            <span class="material-symbols-outlined text-[20px]">refresh</span>
            Retry
          </button>
        </div>
      </section>

      <!-- Empty state: no recipes in library -->
      <section v-else-if="!hasAnyRecipes" class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
          <span class="material-symbols-outlined text-[28px]">menu_book</span>
        </div>
        <h2 class="mt-5 font-headline text-3xl font-semibold text-atelier-heading">
          Your recipe book is empty
        </h2>
        <p class="mt-2 text-sm text-atelier-description">
          Add your first recipe to get started.
        </p>
        <NuxtLink to="/add-recipe" class="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition motion-reduce:transition-none hover:bg-atelier-primary-hover">
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Recipe
        </NuxtLink>
      </section>

      <!-- Empty state: no matches for filters/search -->
      <section v-else-if="filteredRecipes.length === 0" class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
          <span class="material-symbols-outlined text-[28px]">filter_list_off</span>
        </div>
        <h2 class="mt-5 font-headline text-3xl font-semibold text-atelier-heading">
          No matches
        </h2>
        <p class="mt-2 text-sm text-atelier-description">
          No recipes match your current search or filters.
        </p>
        <button
          type="button"
          class="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-atelier-chip px-5 text-sm font-bold text-primary transition hover:bg-atelier-chip-hover"
          @click="clearFilters"
        >
          <span class="material-symbols-outlined text-[20px]">filter_alt_off</span>
          Clear filters
        </button>
      </section>

      <section v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <template v-for="recipe in filteredRecipes" :key="recipe.id">
          <NuxtLink
            v-if="!selectionMode"
            :to="`/recipes/${recipe.id}`"
            :class="cardLinkClass"
          >
            <RecipeCatalogGridCard :recipe="recipe" />
          </NuxtLink>

          <button
            v-else
            type="button"
            :class="[cardSelectClass, isSelected(recipe.id) ? 'ring-2 ring-primary' : 'ring-0']"
            :aria-pressed="isSelected(recipe.id)"
            @click="toggleSelection(recipe.id)"
          >
            <RecipeCatalogGridCard :recipe="recipe" selectable :selected="isSelected(recipe.id)" />
          </button>
        </template>
      </section>
    </div>

    <!-- Bulk actions bar -->
    <div
      v-if="selectionMode"
      class="fixed inset-x-0 bottom-0 z-[60] border-t border-primary/10 bg-atelier-parchment/95 px-4 py-4 shadow-atelier-dock backdrop-blur-sm sm:backdrop-blur-md motion-reduce:backdrop-blur-none pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Bulk actions"
    >
      <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-semibold text-atelier-neutral-action">
          {{ selectedCount }} selected
        </p>

        <p v-if="bulkDeleteError" class="text-sm font-semibold text-atelier-error-foreground" role="alert">
          {{ bulkDeleteError }}
        </p>

        <!-- Default state: action buttons -->
        <div v-if="bulkDeleteStep === 'idle'" class="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-surface-container-lowest px-5 text-sm font-bold text-atelier-heading ring-1 ring-primary/18 transition hover:bg-atelier-chip"
            @click="selectAllFiltered"
          >
            Select all
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-chip px-5 text-sm font-bold text-atelier-heading transition hover:bg-atelier-chip-hover"
            @click="clearSelection"
          >
            Clear
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-error-foreground px-5 text-sm font-bold text-on-primary shadow-atelier-status-error transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none"
            :disabled="selectedCount === 0 || bulkDeleting"
            @click="requestBulkDelete"
          >
            {{ `Delete${selectedCount ? ` (${selectedCount})` : ''}` }}
          </button>
        </div>

        <!-- Confirmation state -->
        <div v-else class="flex flex-wrap items-center gap-3 sm:justify-end">
          <p id="bulk-delete-confirm-heading" tabindex="-1" class="text-sm font-semibold text-atelier-error-foreground">
            Delete {{ selectedCount }} recipe{{ selectedCount === 1 ? '' : 's' }}? This cannot be undone.
          </p>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-surface-container-lowest px-5 text-sm font-bold text-atelier-heading ring-1 ring-primary/18 transition hover:bg-atelier-chip"
            @click="cancelBulkDelete"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-error-foreground px-5 text-sm font-bold text-on-primary shadow-atelier-status-error transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none"
            :disabled="bulkDeleting"
            @click="executeBulkDelete"
          >
            {{ bulkDeleting ? 'Deleting…' : 'Delete recipes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
