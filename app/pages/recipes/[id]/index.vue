<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

const route = useRoute()
const { formatTime, primaryMeta } = useRecipeTimeFormat()

/** Params can lag route.path on client navigation (Vue Router / Nuxt timing); path is authoritative. */
const recipeId = computed(() => {
  const raw = route.params.id
  if (typeof raw === 'string' && raw.length > 0)
    return raw
  if (Array.isArray(raw) && raw[0])
    return String(raw[0])
  const parts = route.path.split('/').filter(Boolean)
  if (parts[0] === 'recipes' && parts[1])
    return parts[1]
  return ''
})

const { data, error, pending } = await useFetch<RecipeCatalogItem>(
  () => (recipeId.value ? `/api/v1/recipes/${recipeId.value}` : null),
  {
    key: () => `recipe-detail-${recipeId.value || 'pending'}`,
    watch: [recipeId],
  },
)

useSeoMeta({
  title: () => (data.value
    ? `${data.value.title} | Your Atelier`
    : 'Recipe | Your Atelier'),
})

/** Preload hero image so the browser fetches it during head parsing, before the img tag is rendered. */
useHead({
  link: computed(() =>
    data.value?.imageUrl
      ? [{ rel: 'preload', as: 'image', href: data.value.imageUrl }]
      : [],
  ),
})
</script>

<template>
  <div class="min-h-screen bg-atelier-canvas px-4 pb-24 pt-8 text-atelier-ink sm:px-6 lg:px-10">
    <div class="mx-auto grid max-w-3xl gap-8">
      <NuxtLink
        to="/recipes"
        class="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl px-1 py-1 text-sm font-bold text-primary transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">arrow_back</span>
        Back to catalog
      </NuxtLink>

      <div v-if="pending" class="grid gap-6">
        <div class="h-10 w-2/3 animate-pulse rounded-2xl bg-atelier-skeleton" />
        <div class="aspect-[4/3] w-full animate-pulse rounded-[28px] bg-atelier-image-well" />
        <div class="h-4 w-full animate-pulse rounded-lg bg-atelier-skeleton" />
        <div class="h-4 w-5/6 animate-pulse rounded-lg bg-atelier-skeleton" />
      </div>

      <section
        v-else-if="error"
        class="rounded-[28px] bg-atelier-cream-error p-6 text-atelier-error-foreground shadow-atelier-status-error"
        role="alert"
      >
        <p class="font-semibold">
          This recipe could not be loaded. It may have been removed, or the link is invalid.
        </p>
        <NuxtLink
          to="/recipes"
          class="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-primary-container px-5 text-sm font-bold text-on-primary shadow-atelier-primary-btn"
        >
          <span class="material-symbols-outlined text-[20px]">restaurant_menu</span>
          Back to catalog
        </NuxtLink>
      </section>

      <article v-else-if="data" class="grid gap-8">
        <header class="grid gap-3">
          <div class="flex items-start justify-between gap-4">
            <div class="grid gap-3">
              <p v-if="data.categories[0]" class="text-xs font-semibold uppercase tracking-[0.18em] text-atelier-warm-accent">
                {{ data.categories[0] }}
              </p>
              <h1 class="font-headline text-4xl font-semibold leading-tight text-atelier-heading sm:text-5xl">
                {{ data.title }}
              </h1>
            </div>
            <NuxtLink
              :to="`/recipes/${recipeId}/edit`"
              class="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-atelier-chip px-5 py-2 text-sm font-bold text-primary transition hover:bg-atelier-chip-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span class="material-symbols-outlined text-[20px]">edit</span>
              Edit
            </NuxtLink>
          </div>
          <p v-if="data.description" class="text-base font-medium leading-relaxed text-atelier-description">
            {{ data.description }}
          </p>
        </header>

        <div
          v-if="(formatTime(data) != null) || (primaryMeta(data).length > 0)"
          class="flex flex-wrap gap-2"
        >
          <span
            v-for="item in primaryMeta(data)"
            :key="item"
            class="rounded-full bg-atelier-chip px-3 py-1 text-xs font-bold text-atelier-neutral-action"
          >
            {{ item }}
          </span>
        </div>

        <div
          v-if="data.prepTimeMinutes != null || data.cookTimeMinutes != null"
          class="text-sm font-semibold text-atelier-meta"
        >
          <span v-if="data.prepTimeMinutes != null">Prep {{ data.prepTimeMinutes }} min</span>
          <span v-if="data.prepTimeMinutes != null && data.cookTimeMinutes != null"> · </span>
          <span v-if="data.cookTimeMinutes != null">Cook {{ data.cookTimeMinutes }} min</span>
        </div>

        <div class="aspect-[4/3] overflow-hidden rounded-[28px] bg-atelier-image-well shadow-atelier-card">
          <img
            v-if="data.imageUrl"
            :src="data.imageUrl"
            :alt="`Photo of ${data.title}`"
            class="h-full w-full object-cover"
            fetchpriority="high"
            loading="eager"
            decoding="async"
          >
          <div
            v-else
            class="flex h-full w-full items-center justify-center text-primary"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[72px]">restaurant</span>
          </div>
        </div>

        <section
          v-if="data.sourceUrl"
          class="text-sm"
        >
          <p class="text-atelier-meta">
            <span class="font-semibold text-atelier-ink">Source</span>
            <a
              :href="data.sourceUrl"
              class="ml-1 break-words text-primary underline underline-offset-2 hover:text-atelier-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              rel="noopener noreferrer"
              target="_blank"
            >{{ data.sourceHost || data.sourceUrl }}</a>
          </p>
        </section>

        <section
          v-if="data.tags.length"
          class="flex flex-wrap gap-2"
          aria-label="Tags"
        >
          <span
            v-for="tag in data.tags"
            :key="tag"
            class="rounded-full bg-surface-container-lowest/90 px-3 py-1 text-xs font-semibold text-atelier-neutral-action ring-1 ring-primary/10"
          >
            {{ tag }}
          </span>
        </section>

        <section class="grid gap-4">
          <h2 class="font-headline text-2xl font-semibold text-atelier-heading">
            Ingredients
          </h2>
          <ol class="list-none space-y-4 p-0">
            <li
              v-for="ing in data.ingredients"
              :key="ing.id"
              class="text-base leading-7 text-atelier-ink"
            >
              <span class="font-headline text-sm font-semibold text-atelier-warm-accent" aria-hidden="true">{{ String(ing.position).padStart(2, '0') }}.</span>
              <span class="ml-2 font-medium text-on-surface">{{ ing.rawText }}</span>
            </li>
          </ol>
        </section>

        <section class="grid gap-4">
          <h2 class="font-headline text-2xl font-semibold text-atelier-heading">
            Steps
          </h2>
          <ol class="list-none space-y-6 p-0">
            <li
              v-for="step in data.steps"
              :key="step.id"
              class="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6"
            >
              <span class="font-headline text-lg font-semibold text-atelier-heading sm:min-w-16" aria-hidden="true">
                Step {{ String(step.position).padStart(2, '0') }}
              </span>
              <p class="max-w-[65ch] text-base leading-7 text-on-surface sm:pt-0.5">
                {{ step.text }}
              </p>
            </li>
          </ol>
        </section>
      </article>
    </div>
  </div>
</template>
