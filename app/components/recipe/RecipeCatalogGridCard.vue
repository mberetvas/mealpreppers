<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { useRecipeTimeFormat } from '~/composables/useRecipeTimeFormat'
import {
  LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS,
  recipeIdentityListImageAlt,
} from '~/constants/listImageLoadingStrategy'

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
      class="pointer-events-none absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-xl bg-atelier-parchment/95 ring-1 ring-primary/20"
      aria-hidden="true"
    >
      <span
        class="material-symbols-outlined text-[26px]"
        :class="selected ? 'text-primary' : 'text-atelier-icon-muted'"
      >
        {{ selected ? 'check_box' : 'check_box_outline_blank' }}
      </span>
    </span>

    <div class="relative aspect-[4/3] bg-atelier-image-well">
      <img
        v-if="recipe.imageUrl"
        v-bind="LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS"
        :src="recipe.imageUrl"
        :alt="recipeIdentityListImageAlt(recipe.title)"
        class="h-full w-full object-cover"
      >
      <div v-else class="flex h-full items-center justify-center text-primary">
        <span class="material-symbols-outlined text-[54px]" aria-hidden="true">restaurant</span>
      </div>
      <div
        v-if="recipe.categories.length > 0"
        class="absolute top-4"
        :class="selectable ? 'left-[4.25rem]' : 'left-4'"
      >
        <AtelierRecipePill variant="category">
          {{ recipe.categories[0] }}
        </AtelierRecipePill>
      </div>
    </div>

    <div class="grid gap-4 p-5">
      <div>
        <h2 class="font-['Newsreader'] text-2xl font-semibold leading-tight text-atelier-heading group-hover:underline group-hover:decoration-primary/30 group-hover:underline-offset-4">
          {{ recipe.title }}
        </h2>
        <p v-if="recipe.description" class="mt-2 line-clamp-2 text-sm leading-6 text-atelier-description">
          {{ recipe.description }}
        </p>
      </div>

      <div v-if="primaryMeta(recipe).length > 0" class="flex flex-wrap gap-2">
        <AtelierRecipePill v-for="item in primaryMeta(recipe)" :key="item" variant="meta">
          {{ item }}
        </AtelierRecipePill>
      </div>

      <div class="flex items-center justify-between gap-4 text-sm font-semibold text-atelier-meta">
        <span>{{ recipe.ingredients.length }} ingredients</span>
        <span>{{ recipe.steps.length }} steps</span>
      </div>
    </div>
  </article>
</template>
