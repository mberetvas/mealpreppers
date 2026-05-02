<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

defineProps<{
  recipe: RecipeCatalogItem
  selectable?: boolean
  selected?: boolean
}>()

const { primaryMeta } = useRecipeTimeFormat()
</script>

<template>
  <article class="relative grid h-full grid-rows-[auto_1fr] text-left">
    <span
      v-if="selectable"
      class="pointer-events-none absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-xl bg-[#fffaf0]/95 shadow-[0_8px_22px_rgba(15,82,56,0.12)] ring-1 ring-[#0f5238]/15"
      aria-hidden="true"
    >
      <span
        class="material-symbols-outlined text-[26px]"
        :class="selected ? 'text-[#0f5238]' : 'text-[#6b7b6e]'"
      >
        {{ selected ? 'check_box' : 'check_box_outline_blank' }}
      </span>
    </span>

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
      <div
        v-if="recipe.categories.length > 0"
        class="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#0f5238] shadow-[0_8px_22px_rgba(15,82,56,0.12)]"
        :class="selectable ? 'left-[4.25rem]' : ''"
      >
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
        <span
          v-for="item in primaryMeta(recipe)"
          :key="item"
          class="rounded-full bg-[#f0e4d2] px-3 py-1 text-xs font-bold text-[#485746]"
        >
          {{ item }}
        </span>
      </div>

      <div class="flex items-center justify-between gap-4 text-sm font-semibold text-[#6a786b]">
        <span>{{ recipe.ingredients.length }} ingredients</span>
        <span>{{ recipe.steps.length }} steps</span>
      </div>
    </div>
  </article>
</template>
