<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

const route = useRoute()
const { formatTime, primaryMeta } = useRecipeTimeFormat()

const { data, error, pending } = await useFetch<RecipeCatalogItem>(
  () => `/api/v1/recipes/${String(route.params.id)}`,
  {
    key: () => `recipe-detail-${String(route.params.id)}`,
    watch: [() => route.params.id],
  },
)

useSeoMeta({
  title: () => (data.value
    ? `${data.value.title} | Your Atelier`
    : 'Recipe | Your Atelier'),
})
</script>

<template>
  <div class="min-h-screen bg-[#f7f2e8] px-4 pb-24 pt-8 text-[#1e261f] sm:px-6 lg:px-10">
    <div class="mx-auto grid max-w-3xl gap-8">
      <NuxtLink
        to="/recipes"
        class="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl px-1 py-1 text-sm font-bold text-[#0f5238] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">arrow_back</span>
        Back to catalog
      </NuxtLink>

      <div v-if="pending" class="grid gap-6">
        <div class="h-10 w-2/3 animate-pulse rounded-2xl bg-[#fffaf0]" />
        <div class="aspect-[4/3] w-full animate-pulse rounded-[28px] bg-[#e6d6bd]" />
        <div class="h-4 w-full animate-pulse rounded-lg bg-[#fffaf0]" />
        <div class="h-4 w-5/6 animate-pulse rounded-lg bg-[#fffaf0]" />
      </div>

      <section
        v-else-if="error"
        class="rounded-[28px] bg-[#fff1e8] p-6 text-[#9c3d16] shadow-[0_18px_54px_rgba(156,61,22,0.08)]"
        role="alert"
      >
        <p class="font-semibold">
          This recipe could not be loaded. It may have been removed, or the link is invalid.
        </p>
        <NuxtLink
          to="/recipes"
          class="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#0f5238] to-[#2d6a4f] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,82,56,0.22)]"
        >
          <span class="material-symbols-outlined text-[20px]">restaurant_menu</span>
          Back to catalog
        </NuxtLink>
      </section>

      <article v-else-if="data" class="grid gap-8">
        <header class="grid gap-3">
          <p v-if="data.categories[0]" class="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7662f]">
            {{ data.categories[0] }}
          </p>
          <h1 class="font-['Newsreader'] text-4xl font-semibold leading-tight text-[#123628] sm:text-5xl">
            {{ data.title }}
          </h1>
          <p v-if="data.description" class="text-base font-medium leading-relaxed text-[#5d6c60]">
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
            class="rounded-full bg-[#f0e4d2] px-3 py-1 text-xs font-bold text-[#485746]"
          >
            {{ item }}
          </span>
        </div>

        <div
          v-if="data.prepTimeMinutes != null || data.cookTimeMinutes != null"
          class="text-sm font-semibold text-[#6a786b]"
        >
          <span v-if="data.prepTimeMinutes != null">Prep {{ data.prepTimeMinutes }} min</span>
          <span v-if="data.prepTimeMinutes != null && data.cookTimeMinutes != null"> · </span>
          <span v-if="data.cookTimeMinutes != null">Cook {{ data.cookTimeMinutes }} min</span>
        </div>

        <div class="overflow-hidden rounded-[28px] bg-[#e6d6bd] shadow-[0_18px_54px_rgba(15,82,56,0.10)]">
          <img
            v-if="data.imageUrl"
            :src="data.imageUrl"
            :alt="`Photo of ${data.title}`"
            class="h-full w-full object-cover"
          >
          <div
            v-else
            class="flex aspect-[4/3] w-full items-center justify-center text-[#0f5238]"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[72px]">restaurant</span>
          </div>
        </div>

        <section
          v-if="data.sourceUrl"
          class="text-sm"
        >
          <p class="text-[#6a786b]">
            <span class="font-semibold text-[#1e261f]">Source</span>
            <a
              :href="data.sourceUrl"
              class="ml-1 break-words text-[#0f5238] underline underline-offset-2 hover:text-[#174d38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
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
            class="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#485746] ring-1 ring-[#0f5238]/10"
          >
            {{ tag }}
          </span>
        </section>

        <section class="grid gap-4">
          <h2 class="font-['Newsreader'] text-2xl font-semibold text-[#123628]">
            Ingredients
          </h2>
          <ol class="list-none space-y-4 p-0">
            <li
              v-for="ing in data.ingredients"
              :key="ing.id"
              class="text-base leading-7 text-[#1e261f]"
            >
              <span class="font-['Newsreader'] text-sm font-semibold text-[#b7662f]" aria-hidden="true">{{ String(ing.position).padStart(2, '0') }}.</span>
              <span class="ml-2 font-medium text-[#1b1c1c]">{{ ing.rawText }}</span>
            </li>
          </ol>
        </section>

        <section class="grid gap-4">
          <h2 class="font-['Newsreader'] text-2xl font-semibold text-[#123628]">
            Steps
          </h2>
          <ol class="list-none space-y-6 p-0">
            <li
              v-for="step in data.steps"
              :key="step.id"
              class="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6"
            >
              <span class="font-['Newsreader'] text-lg font-semibold text-[#123628] sm:min-w-16" aria-hidden="true">
                Step {{ String(step.position).padStart(2, '0') }}
              </span>
              <p class="max-w-[65ch] text-base leading-7 text-[#1b1c1c] sm:pt-0.5">
                {{ step.text }}
              </p>
            </li>
          </ol>
        </section>
      </article>
    </div>
  </div>
</template>
