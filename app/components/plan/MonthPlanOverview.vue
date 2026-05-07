<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import type { MonthPlanV1, WeekPlanV1 } from '~~/types/planning'
import { LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS } from '~/constants/listImageLoadingStrategy'
import { countAssignedRecipes, deepCloneWeek } from '~~/utils/weekPlan'

const props = defineProps<{
  modelValue: MonthPlanV1
  recipeById: Map<string, RecipeCatalogItem>
}>()

const emit = defineEmits<{
  'open-week': [weekIndex: number, snapshot: WeekPlanV1]
  'snapshot-current': [weekIndex: number]
}>()

const expanded = ref<number | null>(null)

function weekLabel(i: number): string {
  return `Week ${String(i + 1).padStart(2, '0')}`
}

function thumbUrls(week: WeekPlanV1 | null): string[] {
  if (!week) return []
  const urls: string[] = []
  for (const dk of ['1', '2', '3', '4', '5', '6', '7'] as const) {
    const day = week.days[dk]
    for (const slot of [day.breakfast, day.lunch, day.dinner]) {
      const id = slot.recipeId
      if (!id) continue
      const r = props.recipeById.get(id)
      if (r?.imageUrl) urls.push(r.imageUrl)
      if (urls.length >= 4) return urls
    }
  }
  return urls
}

function recipeCount(week: WeekPlanV1 | null): number {
  if (!week) return 0
  return countAssignedRecipes(week)
}

function copyCurrentWeekToSlot(index: number): void {
  emit('snapshot-current', index)
}

function openWeekInEditor(index: number): void {
  const w = props.modelValue.weeks[index]
  if (!w) return
  emit('open-week', index, deepCloneWeek(w))
}
</script>

<template>
  <div>
    <header class="mb-8">
      <h2 class="font-headline text-4xl font-medium tracking-tight text-on-surface md:text-5xl">
        Monthly horizon
      </h2>
      <p class="mt-3 max-w-2xl font-body text-on-surface-variant">
        Four week snapshots. Copy your working week into a slot, then refine each week in the week editor.
      </p>
    </header>

    <div class="grid gap-6 sm:grid-cols-2">
      <article
        v-for="(_, i) in modelValue.weeks"
        :key="i"
        class="flex flex-col rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant/20"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-headline text-xl font-semibold text-on-surface">
              {{ weekLabel(i) }}
            </h3>
            <p class="mt-1 font-body text-sm text-on-surface-variant">
              {{ recipeCount(modelValue.weeks[i]) }} recipes
            </p>
          </div>
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-fixed/30"
            @click="expanded = expanded === i ? null : i"
          >
            {{ expanded === i ? 'Hide' : 'Preview' }}
          </button>
        </div>

        <div v-if="thumbUrls(modelValue.weeks[i]).length" class="mt-4 flex -space-x-4">
          <img
            v-for="(url, ti) in thumbUrls(modelValue.weeks[i])"
            :key="ti"
            v-bind="LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS"
            :src="url"
            alt=""
            aria-hidden="true"
            class="relative size-14 rounded-full border-2 border-surface-container-lowest object-cover ring-1 ring-outline-variant/20"
            :style="{ zIndex: 4 - ti }"
          >
        </div>
        <div v-else class="mt-4 h-14 rounded-xl bg-surface-container-low" />

        <div v-if="expanded === i && modelValue.weeks[i]" class="mt-4 rounded-xl bg-surface-container-low p-3 font-body text-sm text-on-surface-variant">
          <p>Snapshot with meals across seven days. Use “Open in editor” to adjust this copy.</p>
        </div>

        <div class="mt-6 flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 text-center text-sm font-semibold text-on-primary shadow-[0_12px_28px_rgba(15,82,56,0.18)] transition hover:opacity-95"
            :disabled="!modelValue.weeks[i]"
            @click="openWeekInEditor(i)"
          >
            Open in editor
          </button>
          <button
            type="button"
            class="w-full rounded-xl bg-surface-container-low py-2.5 text-center text-sm font-semibold text-primary transition hover:bg-primary-fixed/25"
            @click="copyCurrentWeekToSlot(i)"
          >
            Copy working week here
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
