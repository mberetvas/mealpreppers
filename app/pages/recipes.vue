<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

const searchQuery = ref('')
const { data: recipes, pending, error, refresh } = await useFetch<RecipeCatalogItem[]>('/api/v1/recipes', {
  default: () => [],
})

const { formatTime, primaryMeta } = useRecipeTimeFormat()

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
</script>

<template>
  <div class="min-h-screen bg-[#f7f2e8] px-4 pb-24 pt-8 text-[#1e261f] sm:px-6 lg:px-10">
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

        <NuxtLink to="/add-recipe" class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0f5238] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,82,56,0.22)] transition hover:bg-[#174d38]">
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Recipe
        </NuxtLink>
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
        <NuxtLink
          v-for="recipe in filteredRecipes"
          :key="recipe.id"
          :to="`/recipes/${recipe.id}`"
          class="group block overflow-hidden rounded-[28px] bg-[#fffaf0] shadow-[0_18px_54px_rgba(15,82,56,0.10)] transition hover:-translate-y-1 hover:shadow-[0_26px_72px_rgba(15,82,56,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
        >
          <article class="grid h-full grid-rows-[auto_1fr]">
            <div class="relative aspect-[4/3] bg-[#e6d6bd]">
              <img
                v-if="recipe.imageUrl"
                :src="recipe.imageUrl"
                :alt="`Photo of ${recipe.title}`"
                class="h-full w-full object-cover"
              >
              <div v-else class="flex h-full items-center justify-center text-[#0f5238]">
                <span class="material-symbols-outlined text-[54px]" aria-hidden="true">restaurant</span>
              </div>
              <div v-if="recipe.categories.length > 0" class="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#0f5238] shadow-[0_8px_22px_rgba(15,82,56,0.12)]">
                {{ recipe.categories[0] }}
              </div>
            </div>

            <div class="grid gap-4 p-5">
              <div>
                <h2 class="font-['Newsreader'] text-2xl font-semibold leading-tight text-[#123628] group-hover:underline group-hover:decoration-[#0f5238]/30 group-hover:underline-offset-4">
                  {{ recipe.title }}
                </h2>
                <p v-if="recipe.description" class="mt-2 line-clamp-2 text-sm leading-6 text-[#5d6c60]">
                  {{ recipe.description }}
                </p>
              </div>

              <div v-if="primaryMeta(recipe).length > 0" class="flex flex-wrap gap-2">
                <span v-for="item in primaryMeta(recipe)" :key="item" class="rounded-full bg-[#f0e4d2] px-3 py-1 text-xs font-bold text-[#485746]">
                  {{ item }}
                </span>
              </div>

              <div class="flex items-center justify-between gap-4 text-sm font-semibold text-[#6a786b]">
                <span>{{ recipe.ingredients.length }} ingredients</span>
                <span>{{ recipe.steps.length }} steps</span>
              </div>
            </div>
          </article>
        </NuxtLink>
      </section>
    </div>
  </div>
</template>
