<script setup lang="ts">
import type { WeekPlanV1 } from '~~/types/planning'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import {
  collectRecipeOccurrences,
  buildShoppingList,
  formatShoppingListIngredient as formatIngredient,
  type ShoppingListSection,
} from '~~/utils/shoppingList'

const route = useRoute()
const planId = computed(() => (route.query.plan as string | undefined) ?? '')

const loading = ref(true)
const planName = ref('')
const sections = ref<ShoppingListSection[]>([])
const planLoaded = ref(false)
const planError = ref(false)
const failedRecipeCount = ref(0)

useHead(() => ({
  title: planName.value ? `Shopping list — ${planName.value}` : 'Shopping list',
}))

/** Fetches the weekplan, fans out to all recipe endpoints, and builds the shopping list. */
async function load(): Promise<void> {
  loading.value = true
  planError.value = false
  failedRecipeCount.value = 0
  planLoaded.value = false

  if (!planId.value) {
    planError.value = true
    loading.value = false
    return
  }

  try {
    const plan = await $fetch<{ id: string; name: string; body: WeekPlanV1 }>(
      `/api/v1/saved-weekplans/${planId.value}`,
    )
    planName.value = plan.name
    const occurrences = collectRecipeOccurrences(plan.body)
    const recipeIds = [...occurrences.keys()]
    const settled = await Promise.allSettled(
      recipeIds.map(id => $fetch<RecipeCatalogItem>(`/api/v1/recipes/${id}`)),
    )
    const recipeMap = new Map<string, RecipeCatalogItem>()
    let failures = 0
    for (const [index, recipeId] of recipeIds.entries()) {
      const result = settled[index]
      if (result && result.status === 'fulfilled') {
        recipeMap.set(recipeId, result.value)
      }
      else {
        failures++
      }
    }
    failedRecipeCount.value = failures
    sections.value = buildShoppingList(occurrences, recipeMap)
    planLoaded.value = true
  }
  catch {
    planError.value = true
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <!-- Header -->
    <header class="space-y-4">
      <NuxtLink
        to="/saved-weekplans"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-atelier-neutral-action transition hover:text-primary"
        aria-label="Back to Saved Weekplans"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
        Saved Weekplans
      </NuxtLink>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <h1 class="font-headline text-3xl font-bold text-atelier-heading md:text-4xl">
            {{ planName || '…' }}
          </h1>
          <p class="text-sm text-atelier-description">
            Shopping list
          </p>
        </div>

        <button
          type="button"
          class="inline-flex min-h-touch min-w-touch shrink-0 items-center gap-2 self-start rounded-xl bg-atelier-chip px-4 text-sm font-semibold text-atelier-heading transition hover:bg-atelier-chip-hover disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          :disabled="loading"
          aria-label="Refresh shopping list"
          @click="load"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- Loading skeleton -->
    <section
      v-if="loading"
      class="space-y-4"
      aria-busy="true"
      aria-label="Loading shopping list"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="h-48 animate-pulse rounded-2xl bg-atelier-skeleton ring-1 ring-primary/10 motion-reduce:animate-none"
      />
    </section>

    <!-- Plan error / missing ID (mutually exclusive with all other states) -->
    <section
      v-else-if="planError"
      class="rounded-[28px] bg-atelier-cream-error p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
    >
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-error-container text-error">
        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">error</span>
      </div>
      <h2 class="mt-5 font-headline text-2xl font-semibold text-atelier-heading md:text-3xl">
        Plan could not be loaded
      </h2>
      <p class="mx-auto mt-3 max-w-md text-sm text-atelier-error-foreground">
        The plan may not exist or you may not have permission to access it.
      </p>
      <NuxtLink
        to="/saved-weekplans"
        class="mt-8 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
        Back to Manage plans
      </NuxtLink>
    </section>

    <!-- Empty state: plan loaded but no recipe slots assigned -->
    <section
      v-else-if="planLoaded && sections.length === 0 && failedRecipeCount === 0"
      class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
    >
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">shopping_cart</span>
      </div>
      <h2 class="mt-5 font-headline text-2xl font-semibold text-atelier-heading md:text-3xl">
        This plan has no recipes yet
      </h2>
      <p class="mx-auto mt-3 max-w-md text-sm text-atelier-description">
        Add recipes to the weekly planner to generate your shopping list.
      </p>
      <NuxtLink
        :to="{ path: '/weekly-plan', query: { template: planId } }"
        class="mt-8 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit_calendar</span>
        Open in Planner
      </NuxtLink>
    </section>

    <!-- Loaded state: recipe sections (with optional partial-load warning) -->
    <template v-else-if="planLoaded">
      <!-- Partial-load warning banner -->
      <div
        v-if="failedRecipeCount > 0"
        class="rounded-2xl bg-atelier-cream-warning px-5 py-4 text-sm font-semibold text-atelier-warning-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="material-symbols-outlined mr-2 align-middle text-[18px]" aria-hidden="true">warning</span>
        {{ failedRecipeCount }} recipe(s) could not be loaded — this list may be incomplete.
      </div>

      <!-- Recipe sections -->
      <ul
        class="space-y-6"
        aria-label="Shopping list by recipe"
      >
        <li
          v-for="section in sections"
          :key="section.recipeId"
          class="rounded-2xl bg-atelier-parchment shadow-atelier-float ring-1 ring-primary/10"
        >
          <!-- Section header -->
          <div class="flex items-center justify-between border-b border-outline-variant/30 px-6 py-5">
            <h2 class="font-headline text-xl font-semibold text-atelier-heading md:text-2xl">
              {{ section.recipeTitle }}
            </h2>
            <span
              v-if="section.occurrenceCount > 1"
              class="ml-3 inline-flex shrink-0 items-center justify-center rounded-full bg-secondary-container px-3 py-1 text-sm font-bold text-on-secondary-container"
              :aria-label="`Used ${section.occurrenceCount} times`"
            >
              × {{ section.occurrenceCount }}
            </span>
          </div>

          <!-- Ingredient list -->
          <ul class="divide-y divide-outline-variant/20 px-2 py-2">
            <li
              v-for="(ing, idx) in section.ingredients"
              :key="idx"
              class="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-atelier-entry-hover motion-reduce:transition-none"
            >
              <span class="flex-1 text-sm text-atelier-heading">
                {{ formatIngredient(ing) }}
              </span>
            </li>
            <li
              v-if="section.ingredients.length === 0"
              class="px-4 py-3 text-sm italic text-atelier-description"
            >
              No ingredients listed.
            </li>
          </ul>
        </li>
      </ul>
    </template>
  </div>
</template>
