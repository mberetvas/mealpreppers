<script setup lang="ts">
import { formatShoppingListIngredient as formatIngredient } from '~~/utils/shoppingList'

const route = useRoute()
const router = useRouter()
const planId = computed(() => (route.query.plan as string | undefined) ?? '')

const { loading, planName, sections, planLoaded, planError, failedRecipeCount, load } = useShoppingList(planId)
const {
  consolidating,
  consolidatedLines,
  baselineLines,
  consolidationError,
  polishStatus,
  warnings,
  hasConsolidated,
  consolidate,
} = useConsolidatedShoppingList(planId)

const viewMode = computed(() => route.query.view === 'consolidated' ? 'consolidated' : 'sections')

function setViewMode(mode: 'sections' | 'consolidated') {
  const query = { ...route.query }
  if (mode === 'consolidated') {
    query.view = 'consolidated'
  }
  else {
    delete query.view
  }
  router.replace({ path: route.path, query })
}

/** Lines to render in consolidated view depending on polish status. */
const displayLines = computed(() => {
  if (consolidationError.value) return []
  if (polishStatus.value === 'baseline_fallback' || polishStatus.value === 'ai_skipped') {
    return baselineLines.value
  }
  return consolidatedLines.value
})

useHead(() => ({
  title: planName.value ? `Shopping list — ${planName.value}` : 'Shopping list',
}))
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

    <!-- No plan selected: missing ?plan= query parameter -->
    <section
      v-else-if="planError && !planId"
      class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
    >
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">link_off</span>
      </div>
      <h2 class="mt-5 font-headline text-2xl font-semibold text-atelier-heading md:text-3xl">
        No plan selected
      </h2>
      <p class="mx-auto mt-3 max-w-md text-sm text-atelier-description">
        Open a saved weekplan to view its shopping list.
      </p>
      <NuxtLink
        to="/saved-weekplans"
        class="mt-8 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">list_alt</span>
        Browse saved weekplans
      </NuxtLink>
    </section>

    <!-- Plan access failure: non-empty planId but fetch failed -->
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

    <!-- Total recipe resolution failure: plan loaded, every catalog fetch failed -->
    <template v-else-if="planLoaded && sections.length === 0 && failedRecipeCount > 0">
      <div
        class="rounded-2xl bg-atelier-cream-warning px-5 py-4 text-sm font-semibold text-atelier-warning-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="material-symbols-outlined mr-2 align-middle text-[18px]" aria-hidden="true">warning</span>
        Could not load any recipes for this plan.
      </div>

      <section
        class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
      >
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
          <span class="material-symbols-outlined text-[28px]" aria-hidden="true">menu_book</span>
        </div>
        <h2 class="mt-5 font-headline text-2xl font-semibold text-atelier-heading md:text-3xl">
          Could not load recipes for this plan
        </h2>
        <p class="mx-auto mt-3 max-w-md text-sm text-atelier-description">
          Some recipes could not be loaded from the catalog. Try Refresh or open the plan in the planner.
        </p>
        <NuxtLink
          :to="{ path: '/weekly-plan', query: { template: planId } }"
          class="mt-8 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit_calendar</span>
          Open in Planner
        </NuxtLink>
      </section>
    </template>

    <!-- Loaded state: recipe sections or consolidated view -->
    <template v-else-if="planLoaded">
      <!-- View mode toggle -->
      <nav data-testid="view-mode-toggle" class="flex gap-1 rounded-xl bg-atelier-chip/50 p-1" aria-label="Shopping list view mode">
        <button
          type="button"
          data-testid="view-mode-sections"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none"
          :class="viewMode === 'sections' ? 'active bg-atelier-parchment text-atelier-heading shadow-sm' : 'text-atelier-description hover:text-atelier-heading'"
          @click="setViewMode('sections')"
        >
          Recipe sections
        </button>
        <button
          type="button"
          data-testid="view-mode-consolidated"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none"
          :class="viewMode === 'consolidated' ? 'active bg-atelier-parchment text-atelier-heading shadow-sm' : 'text-atelier-description hover:text-atelier-heading'"
          @click="setViewMode('consolidated')"
        >
          Consolidated
        </button>
      </nav>

      <!-- Partial-load warning banner (shown in both views) -->
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

      <!-- ═══ CONSOLIDATED VIEW ═══ -->
      <template v-if="viewMode === 'consolidated'">
        <!-- Consolidation error state -->
        <section
          v-if="consolidationError"
          data-testid="consolidation-error"
          class="rounded-[28px] bg-atelier-cream-error p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
        >
          <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-error-container text-error">
            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">error</span>
          </div>
          <h2 class="mt-5 font-headline text-xl font-semibold text-atelier-heading">
            Consolidation failed
          </h2>
          <p class="mx-auto mt-3 max-w-md text-sm text-atelier-error-foreground">
            {{ consolidationError }}
          </p>
          <button
            type="button"
            data-testid="retry-btn"
            class="mt-6 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
            @click="consolidate"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
            Retry
          </button>
        </section>

        <!-- Loading state -->
        <section
          v-else-if="consolidating"
          data-testid="consolidation-loading"
          class="space-y-4"
          aria-busy="true"
          aria-label="Consolidating shopping list"
        >
          <div class="flex flex-col items-center gap-4 py-12">
            <div class="size-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary motion-reduce:animate-none" />
            <p class="text-sm font-medium text-atelier-description">
              Consolidating your shopping list…
            </p>
          </div>
        </section>

        <!-- Baseline fallback banner -->
        <template v-else-if="hasConsolidated && polishStatus === 'baseline_fallback'">
          <div
            data-testid="fallback-banner"
            class="rounded-2xl bg-atelier-cream-warning px-5 py-4 text-sm font-semibold text-atelier-warning-foreground"
            role="status"
            aria-live="polite"
          >
            <span class="material-symbols-outlined mr-2 align-middle text-[18px]" aria-hidden="true">warning</span>
            {{ warnings[0] || 'AI polish was not applied. Showing baseline merged list.' }}
          </div>
          <ul class="space-y-2" aria-label="Consolidated shopping list (baseline)">
            <li
              v-for="line in displayLines"
              :key="line.id"
              class="flex items-center gap-3 rounded-xl bg-atelier-parchment px-4 py-3 ring-1 ring-primary/10"
            >
              <span class="flex-1 text-sm text-atelier-heading">
                {{ line.quantity }} {{ line.unit }} {{ line.name }}
              </span>
            </li>
          </ul>
          <div class="flex justify-center">
            <button
              type="button"
              data-testid="retry-btn"
              class="inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-atelier-chip px-6 text-sm font-semibold text-atelier-heading transition hover:bg-atelier-chip-hover motion-reduce:transition-none"
              @click="consolidate"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
              Retry consolidation
            </button>
          </div>
        </template>

        <!-- AI skipped banner -->
        <template v-else-if="hasConsolidated && polishStatus === 'ai_skipped'">
          <div
            data-testid="ai-skipped-banner"
            class="rounded-2xl bg-atelier-cream-warning px-5 py-4 text-sm font-semibold text-atelier-warning-foreground"
            role="status"
            aria-live="polite"
          >
            <span class="material-symbols-outlined mr-2 align-middle text-[18px]" aria-hidden="true">info</span>
            {{ warnings[0] || 'AI consolidation is currently unavailable. Showing merged baseline.' }}
          </div>
          <ul class="space-y-2" aria-label="Consolidated shopping list (baseline)">
            <li
              v-for="line in displayLines"
              :key="line.id"
              class="flex items-center gap-3 rounded-xl bg-atelier-parchment px-4 py-3 ring-1 ring-primary/10"
            >
              <span class="flex-1 text-sm text-atelier-heading">
                {{ line.quantity }} {{ line.unit }} {{ line.name }}
              </span>
            </li>
          </ul>
          <div class="flex justify-center">
            <button
              type="button"
              data-testid="retry-btn"
              class="inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-atelier-chip px-6 text-sm font-semibold text-atelier-heading transition hover:bg-atelier-chip-hover motion-reduce:transition-none"
              @click="consolidate"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
              Retry consolidation
            </button>
          </div>
        </template>

        <!-- Successful consolidation result -->
        <template v-else-if="hasConsolidated && consolidatedLines.length > 0">
          <ul class="space-y-2" aria-label="Consolidated shopping list">
            <li
              v-for="line in displayLines"
              :key="line.id"
              class="flex items-center gap-3 rounded-xl bg-atelier-parchment px-4 py-3 ring-1 ring-primary/10"
            >
              <span class="flex-1 text-sm text-atelier-heading">
                {{ line.quantity }} {{ line.unit }} {{ line.name }}
              </span>
            </li>
          </ul>
          <div class="flex justify-center">
            <button
              type="button"
              data-testid="consolidate-btn"
              class="inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-atelier-chip px-6 text-sm font-semibold text-atelier-heading transition hover:bg-atelier-chip-hover motion-reduce:transition-none"
              @click="consolidate"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
              Re-consolidate
            </button>
          </div>
        </template>

        <!-- Guidance: no results yet -->
        <template v-else>
          <section class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10">
            <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
              <span class="material-symbols-outlined text-[28px]" aria-hidden="true">merge_type</span>
            </div>
            <h2 class="mt-5 font-headline text-xl font-semibold text-atelier-heading">
              Consolidated shopping list
            </h2>
            <p class="mx-auto mt-3 max-w-md text-sm text-atelier-description">
              Consolidation merges duplicate ingredients across recipes into a single store-ready list. Press the button below to consolidate.
            </p>
            <button
              type="button"
              data-testid="consolidate-btn"
              class="mt-8 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
              @click="consolidate"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">merge_type</span>
              Consolidate shopping list
            </button>
          </section>
        </template>
      </template>

      <!-- ═══ RECIPE SECTIONS VIEW ═══ -->
      <template v-else>
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
    </template>
  </div>
</template>
