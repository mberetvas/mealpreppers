<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

const searchQuery = ref('')
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)
const bulkDeleteError = ref<string | null>(null)

const { data: recipes, pending, error, refresh } = await useFetch<RecipeCatalogItem[]>('/api/v1/recipes', {
  default: () => [],
})

const filteredRecipes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return recipes.value
  }

  return recipes.value.filter((recipe) => {
    const searchableText = [
      recipe.title,
      recipe.description,
      recipe.difficulty,
      ...recipe.categories,
      ...recipe.tags,
      ...recipe.ingredients.map(ingredient => ingredient.rawText),
    ].filter(Boolean).join(' ').toLowerCase()

    return searchableText.includes(query)
  })
})

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

async function confirmBulkDelete(): Promise<void> {
  const ids = [...selectedIds.value]
  if (ids.length === 0 || bulkDeleting.value) {
    return
  }

  const n = ids.length
  const ok = confirm(`Delete ${n} recipe${n === 1 ? '' : 's'}? This cannot be undone.`)
  if (!ok) {
    return
  }

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
  }
  finally {
    bulkDeleting.value = false
  }
}

const cardFrameClass =
  'group w-full overflow-hidden rounded-[28px] bg-[#fffaf0] shadow-[0_18px_54px_rgba(15,82,56,0.10)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]'
const cardLinkClass = `${cardFrameClass} block hover:-translate-y-1 hover:shadow-[0_26px_72px_rgba(15,82,56,0.14)]`
const cardSelectClass = `${cardFrameClass} text-left ring-offset-2 ring-offset-[#f7f2e8]`
</script>

<template>
  <div class="min-h-screen bg-[#f7f2e8] px-4 pb-32 pt-8 text-[#1e261f] sm:px-6 md:pb-12 lg:px-10">
    <div class="mx-auto grid max-w-7xl gap-8">
      <header class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7662f]">
            Recipe Catalog
          </p>
          <h1 class="mt-3 font-['Newsreader'] text-5xl font-semibold leading-tight text-[#123628] sm:text-6xl">
            Your Atelier
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-3 lg:justify-end">
          <button
            type="button"
            class="inline-flex min-h-14 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold shadow-[0_10px_26px_rgba(15,82,56,0.12)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
            :class="selectionMode ? 'bg-[#f0e4d2] text-[#123628] ring-2 ring-[#0f5238]/25' : 'bg-white text-[#123628] ring-1 ring-[#0f5238]/15'"
            @click="toggleSelectionMode"
          >
            <span class="material-symbols-outlined text-[20px]">{{ selectionMode ? 'close' : 'checklist' }}</span>
            {{ selectionMode ? 'Done' : 'Select' }}
          </button>

          <NuxtLink to="/add-recipe" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0f5238] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,82,56,0.22)] transition hover:bg-[#174d38]">
            <span class="material-symbols-outlined text-[20px]">add</span>
            Add Recipe
          </NuxtLink>
        </div>
      </header>

      <section class="rounded-[28px] bg-[#fffaf0] p-4 shadow-[0_22px_70px_rgba(15,82,56,0.10)] sm:p-5">
        <label class="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-inner shadow-[#0f5238]/5 ring-1 ring-[#0f5238]/10 focus-within:ring-2 focus-within:ring-[#0f5238]/45">
          <span class="material-symbols-outlined text-[22px] text-[#6b7b6e]">search</span>
          <input v-model="searchQuery" type="search" class="min-w-0 flex-1 bg-transparent text-base font-medium text-[#1e261f] outline-none" placeholder="Search recipes">
        </label>
      </section>

      <div v-if="pending" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="index in 6" :key="index" class="h-80 animate-pulse rounded-[28px] bg-[#fffaf0] shadow-[0_18px_54px_rgba(15,82,56,0.08)]" />
      </div>

      <section v-else-if="error" class="rounded-[28px] bg-[#fff1e8] p-6 text-[#9c3d16] shadow-[0_18px_54px_rgba(156,61,22,0.08)]">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <p class="font-semibold">
            Recipes could not be loaded.
          </p>
          <button type="button" class="inline-flex items-center gap-2 rounded-2xl bg-[#9c3d16] px-5 py-3 text-sm font-bold text-white" @click="refresh()">
            <span class="material-symbols-outlined text-[20px]">refresh</span>
            Retry
          </button>
        </div>
      </section>

      <section v-else-if="filteredRecipes.length === 0" class="rounded-[28px] bg-[#fffaf0] p-8 text-center shadow-[0_22px_70px_rgba(15,82,56,0.10)]">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f0e4d2] text-[#0f5238]">
          <span class="material-symbols-outlined text-[28px]">menu_book</span>
        </div>
        <h2 class="mt-5 font-['Newsreader'] text-3xl font-semibold text-[#123628]">
          No recipes found
        </h2>
        <NuxtLink to="/add-recipe" class="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0f5238] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,82,56,0.18)]">
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Recipe
        </NuxtLink>
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
            :class="[cardSelectClass, isSelected(recipe.id) ? 'ring-2 ring-[#0f5238]' : 'ring-0']"
            :aria-pressed="isSelected(recipe.id)"
            @click="toggleSelection(recipe.id)"
          >
            <RecipeCatalogGridCard :recipe="recipe" selectable :selected="isSelected(recipe.id)" />
          </button>
        </template>
      </section>
    </div>

    <div
      v-if="selectionMode"
      class="fixed inset-x-0 bottom-0 z-[60] border-t border-[#0f5238]/10 bg-[#fffaf0]/95 px-4 py-4 shadow-[0_-12px_40px_rgba(15,82,56,0.12)] backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Bulk actions"
    >
      <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-semibold text-[#485746]">
          {{ selectedCount }} selected
        </p>

        <p v-if="bulkDeleteError" class="text-sm font-semibold text-[#9c3d16]">
          {{ bulkDeleteError }}
        </p>

        <div class="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-[#123628] ring-1 ring-[#0f5238]/18 transition hover:bg-[#f0e4d2]"
            @click="selectAllFiltered"
          >
            Select all
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#f0e4d2] px-5 text-sm font-bold text-[#123628] transition hover:bg-[#e6d6bd]"
            @click="clearSelection"
          >
            Clear
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#9c3d16] px-5 text-sm font-bold text-white shadow-[0_10px_26px_rgba(156,61,22,0.22)] transition hover:bg-[#852f12] disabled:pointer-events-none disabled:opacity-45"
            :disabled="selectedCount === 0 || bulkDeleting"
            @click="confirmBulkDelete"
          >
            {{ bulkDeleting ? 'Deleting…' : `Delete${selectedCount ? ` (${selectedCount})` : ''}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
