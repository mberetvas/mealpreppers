<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import type { WeekPlanV1 } from '~~/types/planning'

const props = defineProps<{
  modelValue: WeekPlanV1
  selectedDay: keyof WeekPlanV1['days']
  recipeById: Map<string, RecipeCatalogItem>
}>()

const emit = defineEmits<{
  'update:selectedDay': [value: keyof WeekPlanV1['days']]
  choose: [{ day: keyof WeekPlanV1['days'], meal: 'breakfast' | 'lunch' | 'dinner' }]
  remove: [{ day: keyof WeekPlanV1['days'], meal: 'breakfast' | 'lunch' | 'dinner' }]
}>()

const { primaryMeta } = useRecipeTimeFormat()

const DAYS: { key: keyof WeekPlanV1['days'], label: string }[] = [
  { key: '1', label: 'Day 1' },
  { key: '2', label: 'Day 2' },
  { key: '3', label: 'Day 3' },
  { key: '4', label: 'Day 4' },
  { key: '5', label: 'Day 5' },
  { key: '6', label: 'Day 6' },
  { key: '7', label: 'Day 7' },
]

function recipeForSlot(day: keyof WeekPlanV1['days'], meal: 'breakfast' | 'lunch' | 'dinner'): RecipeCatalogItem | null {
  const id = props.modelValue.days[day][meal].recipeId
  if (!id) return null
  return props.recipeById.get(id) ?? null
}

function slotMeta(recipe: RecipeCatalogItem | null): { time?: string, tag?: string } {
  if (!recipe) return {}
  const meta = primaryMeta(recipe)
  return {
    time: meta[0],
    tag: recipe.categories[0] ?? recipe.tags[0],
  }
}
</script>

<template>
  <div class="flex flex-col gap-8 md:flex-row md:gap-8">
    <aside class="w-full shrink-0 md:w-64">
      <div class="space-y-1">
        <button
          v-for="d in DAYS"
          :key="d.key"
          type="button"
          class="flex w-full items-center justify-between rounded-xl px-4 py-4 text-left font-body text-sm font-medium transition"
          :class="selectedDay === d.key
            ? 'bg-surface-container-low text-primary'
            : 'text-on-surface-variant hover:bg-surface-container-low/60'"
          @click="emit('update:selectedDay', d.key)"
        >
          {{ d.label }}
        </button>
      </div>
    </aside>

    <section class="max-w-4xl flex-1 space-y-8">
      <header class="mb-2 hidden md:block">
        <h3 class="font-headline text-3xl text-on-surface">
          Day {{ selectedDay }} overview
        </h3>
        <p class="mt-2 font-body text-sm text-on-surface-variant">
          Assign breakfast, lunch, and dinner for this day.
        </p>
      </header>

      <header class="mb-2 md:hidden">
        <h3 class="font-headline text-2xl text-on-surface">
          Day {{ selectedDay }}
        </h3>
      </header>

      <div class="space-y-6">
        <PlanMealSlotCard
          title="Breakfast"
          icon="wb_sunny"
          :recipe="recipeForSlot(selectedDay, 'breakfast')"
          :time-label="slotMeta(recipeForSlot(selectedDay, 'breakfast')).time"
          :tag-line="slotMeta(recipeForSlot(selectedDay, 'breakfast')).tag"
          @choose="emit('choose', { day: selectedDay, meal: 'breakfast' })"
          @remove="emit('remove', { day: selectedDay, meal: 'breakfast' })"
        />
        <PlanMealSlotCard
          title="Lunch"
          icon="restaurant"
          :recipe="recipeForSlot(selectedDay, 'lunch')"
          :time-label="slotMeta(recipeForSlot(selectedDay, 'lunch')).time"
          :tag-line="slotMeta(recipeForSlot(selectedDay, 'lunch')).tag"
          @choose="emit('choose', { day: selectedDay, meal: 'lunch' })"
          @remove="emit('remove', { day: selectedDay, meal: 'lunch' })"
        />
        <PlanMealSlotCard
          title="Dinner"
          icon="dark_mode"
          :recipe="recipeForSlot(selectedDay, 'dinner')"
          :time-label="slotMeta(recipeForSlot(selectedDay, 'dinner')).time"
          :tag-line="slotMeta(recipeForSlot(selectedDay, 'dinner')).tag"
          @choose="emit('choose', { day: selectedDay, meal: 'dinner' })"
          @remove="emit('remove', { day: selectedDay, meal: 'dinner' })"
        />
      </div>
    </section>
  </div>
</template>
