<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import type { MonthPlanV1, WeekPlanV1 } from '~~/types/planning'
import { deepCloneWeek, emptyMonthPlan, emptyWeekPlan, getDuplicateRecipeIds, isWeekPlanValid } from '~~/utils/weekPlan'
import { duplicatePlannerMessage } from '~~/utils/plannerDuplicateMessages'
import { fetchMonthPlanBodyForPlanner, fetchWeekTemplateRowForPlanner } from '~~/utils/planningHydration'
import { ariaForPlannerWeekSaveStatus } from '~~/utils/stateMessagingContract'

type Tab = 'week' | 'month' | 'templates'
type Meal = 'breakfast' | 'lunch' | 'dinner'
type DayKey = keyof WeekPlanV1['days']

const route = useRoute()
const router = useRouter()

const activeTab = ref<Tab>('week')
const selectedDay = ref<DayKey>('1')
const weekPlan = ref<WeekPlanV1>(emptyWeekPlan())
const monthPlan = ref<MonthPlanV1>(emptyMonthPlan())
const activeTemplateId = ref<string | null>(null)
const activeMonthId = ref<string | null>(null)

const saveStatus = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved')

usePlanningWeekAutosave(weekPlan, activeTemplateId, saveStatus)
usePlanningMonthAutosave(monthPlan, activeMonthId)

const pickerOpen = ref(false)
const pickerRestoreTarget = shallowRef<HTMLElement | null>(null)
const pickerTarget = ref<{ day: DayKey, meal: Meal } | null>(null)
const duplicateHint = ref<string | null>(null)
const pendingPickId = ref<string | null>(null)

const removeTarget = ref<{ day: DayKey, meal: Meal } | null>(null)
const removeOverlayRef = ref<HTMLElement | null>(null)
const removeRestoreTarget = shallowRef<HTMLElement | null>(null)
const removeDialogOpen = computed(() => removeTarget.value !== null)

const { data: recipes, pending: recipesPending } = await useFetch<RecipeCatalogItem[]>('/api/v1/recipes')
const { data: options } = await useFetch<{ categories: string[], tags: string[] }>('/api/v1/recipes/options')

const recipeById = computed(() => {
  const m = new Map<string, RecipeCatalogItem>()
  for (const r of recipes.value ?? []) m.set(r.id, r)
  return m
})

const recentlyUsedIds = useState<string[]>('planner-recent-recipes', () => [])

function pushRecent(id: string): void {
  const cur = [...recentlyUsedIds.value].filter(x => x !== id)
  cur.unshift(id)
  recentlyUsedIds.value = cur.slice(0, 12)
}

const { data: templateList, refresh: refreshTemplates } = await useFetch<Array<{ id: string, name: string, updatedAt: string }>>(
  '/api/v1/planning/week-templates',
  { immediate: false },
)
const { data: monthList, refresh: refreshMonthList } = await useFetch<Array<{ id: string, name: string | null, updatedAt: string }>>(
  '/api/v1/planning/month-plans',
  { immediate: false },
)

const templateBusyId = ref<string | null>(null)

function closePicker(): void {
  pickerOpen.value = false
  duplicateHint.value = null
  pendingPickId.value = null
}

function requestRemove(target: { day: DayKey, meal: Meal, invoker?: HTMLElement | null }): void {
  removeRestoreTarget.value = target.invoker ?? (document.activeElement as HTMLElement | null)
  removeTarget.value = { day: target.day, meal: target.meal }
}

function cancelRemove(): void {
  removeTarget.value = null
}

useAccessibleOverlayInteraction({
  open: removeDialogOpen,
  scopeRef: removeOverlayRef,
  restoreFocusRef: removeRestoreTarget,
  lockBackground: true,
  onRequestClose: cancelRemove,
})

async function hydrateTemplateFromRoute(): Promise<void> {
  const tid = typeof route.query.template === 'string' ? route.query.template.trim() : ''
  if (!tid) {
    return
  }
  const loaded = await fetchWeekTemplateRowForPlanner($fetch, tid)
  if (!loaded.ok) {
    saveStatus.value = 'error'
    return
  }
  weekPlan.value = loaded.body
  activeTemplateId.value = loaded.id
  saveStatus.value = 'saved'
}

onMounted(() => {
  void hydrateTemplateFromRoute()
})

watch(() => route.query.template, () => {
  void hydrateTemplateFromRoute()
})

watch(activeTab, async (t) => {
  if (t === 'templates') {
    await refreshTemplates()
  }
  if (t === 'month') {
    await refreshMonthList()
    const list = monthList.value
    if (!list?.length) {
      activeMonthId.value = null
      monthPlan.value = emptyMonthPlan()
      return
    }
    const first = list[0]
    if (!first) {
      activeMonthId.value = null
      monthPlan.value = emptyMonthPlan()
      return
    }
    activeMonthId.value = first.id
    const loaded = await fetchMonthPlanBodyForPlanner($fetch, first.id)
    if (loaded.ok) {
      monthPlan.value = loaded.body
    }
    else {
      monthPlan.value = emptyMonthPlan()
    }
  }
})

function setTab(t: Tab): void {
  activeTab.value = t
}

function openPicker(target: { day: DayKey, meal: Meal, invoker?: HTMLElement | null }): void {
  pickerRestoreTarget.value = target.invoker ?? (document.activeElement as HTMLElement | null)
  pickerTarget.value = { day: target.day, meal: target.meal }
  duplicateHint.value = null
  pendingPickId.value = null
  pickerOpen.value = true
}

function onRecipePicked(recipeId: string, forceDuplicate?: boolean): void {
  if (!pickerTarget.value) {
    return
  }
  const { day, meal } = pickerTarget.value
  const next = deepCloneWeek(weekPlan.value)
  next.days[day][meal] = { recipeId }
  const dupes = getDuplicateRecipeIds(next)
  if (dupes.has(recipeId) && !forceDuplicate) {
    duplicateHint.value = duplicatePlannerMessage(recipeId)
    pendingPickId.value = recipeId
    return
  }
  weekPlan.value = next
  pushRecent(recipeId)
  pickerOpen.value = false
  pickerTarget.value = null
  duplicateHint.value = null
  pendingPickId.value = null
}

function confirmRemove(): void {
  if (!removeTarget.value) {
    return
  }
  const { day, meal } = removeTarget.value
  const next = deepCloneWeek(weekPlan.value)
  next.days[day][meal] = { recipeId: null }
  weekPlan.value = next
  removeTarget.value = null
}

function saveAsNewTemplate(): void {
  const name = window.prompt('Template name')
  if (!name?.trim()) {
    return
  }
  void (async () => {
    try {
      const created = await $fetch<{ id: string }>('/api/v1/planning/week-templates', {
        method: 'POST',
        body: { name: name.trim(), body: weekPlan.value },
      })
      activeTemplateId.value = created.id
      const q = { ...route.query, template: created.id }
      await router.replace({ query: q })
      saveStatus.value = 'saved'
      await refreshTemplates()
    }
    catch {
      saveStatus.value = 'error'
    }
  })()
}

async function loadTemplateIntoWeek(id: string): Promise<void> {
  templateBusyId.value = id
  try {
    const row = await $fetch<{ id: string, body: WeekPlanV1 }>(`/api/v1/planning/week-templates/${id}`)
    weekPlan.value = row.body
    activeTemplateId.value = row.id
    const q = { ...route.query, template: row.id }
    await router.replace({ query: q })
    activeTab.value = 'week'
    saveStatus.value = 'saved'
  }
  finally {
    templateBusyId.value = null
  }
}

async function deleteTemplate(id: string): Promise<void> {
  if (!window.confirm('Delete this template?')) {
    return
  }
  templateBusyId.value = id
  try {
    await $fetch(`/api/v1/planning/week-templates/${id}`, { method: 'DELETE' })
    if (activeTemplateId.value === id) {
      activeTemplateId.value = null
      weekPlan.value = emptyWeekPlan()
      const q = { ...route.query } as Record<string, string | string[] | undefined>
      delete q.template
      await router.replace({ query: q })
    }
    await refreshTemplates()
  }
  finally {
    templateBusyId.value = null
  }
}

async function createNewMonthPlan(): Promise<void> {
  const created = await $fetch<{ id: string, body: MonthPlanV1 }>('/api/v1/planning/month-plans', {
    method: 'POST',
    body: { body: emptyMonthPlan() },
  })
  activeMonthId.value = created.id
  monthPlan.value = created.body
  await refreshMonthList()
}

function onSnapshotCurrent(weekIndex: number): void {
  const w = [...monthPlan.value.weeks] as MonthPlanV1['weeks']
  w[weekIndex] = deepCloneWeek(weekPlan.value)
  monthPlan.value = { ...monthPlan.value, weeks: w }
}

function onOpenWeek(_index: number, snapshot: WeekPlanV1): void {
  weekPlan.value = deepCloneWeek(snapshot)
  activeTemplateId.value = null
  saveStatus.value = 'dirty'
  activeTab.value = 'week'
}

const headerTitle = computed(() => {
  if (activeTab.value === 'month') return 'Monthly horizon'
  if (activeTab.value === 'templates') return 'The template library'
  return 'Weekly atelier'
})

const savePillText = computed(() => {
  if (!activeTemplateId.value) {
    return 'Not linked to a saved template'
  }
  if (saveStatus.value === 'saving') {
    return 'Saving…'
  }
  if (saveStatus.value === 'error') {
    return 'Save failed'
  }
  if (saveStatus.value === 'dirty') {
    return 'Unsaved changes'
  }
  return 'All changes saved'
})

const weekSaveStatusAria = computed(() => ariaForPlannerWeekSaveStatus(saveStatus.value))

const savePillIcon = computed(() => {
  if (saveStatus.value === 'saving') return 'sync'
  if (saveStatus.value === 'error') return 'error_outline'
  if (saveStatus.value === 'dirty') return 'pending'
  return 'check_circle'
})

const weekValid = computed(() => isWeekPlanValid(weekPlan.value))

const categoryOptions = computed(() => options.value?.categories ?? [])
</script>

<template>
  <div class="mx-auto min-w-0 max-w-7xl">
    <!-- Desktop header -->
    <header class="mb-6 hidden flex-col gap-4 md:flex md:flex-row md:items-start md:justify-between">
      <div class="flex flex-wrap items-end gap-8">
        <h1
          class="font-headline text-3xl font-medium tracking-tight text-primary md:text-4xl"
          :class="activeTab === 'week' ? 'italic' : ''"
        >
          {{ headerTitle }}
        </h1>
        <nav class="flex gap-6 pt-1" aria-label="Planner views">
          <button
            type="button"
            class="border-b-2 pb-1 font-body text-sm font-medium transition"
            :class="activeTab === 'week' ? 'border-primary text-primary' : 'border-transparent text-on-surface/60 hover:text-primary'"
            @click="setTab('week')"
          >
            Week
          </button>
          <button
            type="button"
            class="border-b-2 pb-1 font-body text-sm font-medium transition"
            :class="activeTab === 'month' ? 'border-primary text-primary' : 'border-transparent text-on-surface/60 hover:text-primary'"
            @click="setTab('month')"
          >
            Month
          </button>
          <button
            type="button"
            class="border-b-2 pb-1 font-body text-sm font-medium transition"
            :class="activeTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-on-surface/60 hover:text-primary'"
            @click="setTab('templates')"
          >
            Templates
          </button>
        </nav>
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <span
          v-if="activeTab === 'week'"
          class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 break-words rounded-full bg-surface-container-low px-3 py-1 font-body text-xs text-on-surface-variant"
          :role="weekSaveStatusAria.role"
          :aria-live="weekSaveStatusAria.ariaLive"
          aria-atomic="true"
        >
          <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">{{ savePillIcon }}</span>
          {{ savePillText }}
        </span>
        <span
          v-if="activeTab === 'week' && !weekValid"
          class="max-w-full min-w-0 break-words rounded-full bg-error-container/60 px-3 py-1 font-body text-xs font-semibold text-on-error-container"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Add at least one recipe
        </span>
        <button
          v-if="activeTab === 'week'"
          type="button"
          class="rounded-full bg-surface-container-low px-4 py-2 font-body text-xs font-semibold text-primary hover:bg-primary-fixed/30"
          @click="saveAsNewTemplate"
        >
          Save as template
        </button>
      </div>
    </header>

    <!-- Mobile header + tabs -->
    <div class="mb-4 min-w-0 md:hidden">
      <h1 class="font-headline text-2xl font-medium text-primary" :class="activeTab === 'week' ? 'italic' : ''">
        {{ headerTitle }}
      </h1>
      <nav class="mt-3 -mx-1 flex min-w-0 gap-6 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" aria-label="Planner views">
        <button
          v-for="t in (['week', 'month', 'templates'] as const)"
          :key="t"
          type="button"
          class="whitespace-nowrap border-b-2 pb-1 font-body text-sm font-medium"
          :class="activeTab === t ? 'border-primary text-primary' : 'border-transparent text-on-surface/60'"
          @click="setTab(t)"
        >
          {{ t === 'week' ? 'Week' : t === 'month' ? 'Month' : 'Templates' }}
        </button>
      </nav>
      <div v-if="activeTab === 'week'" class="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        <span
          class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 break-words rounded-full bg-surface-container-low px-3 py-1 font-body text-xs text-on-surface-variant"
          :role="weekSaveStatusAria.role"
          :aria-live="weekSaveStatusAria.ariaLive"
          aria-atomic="true"
        >
          <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">{{ savePillIcon }}</span>
          {{ savePillText }}
        </span>
        <span
          v-if="!weekValid"
          class="max-w-full min-w-0 break-words rounded-full bg-error-container/50 px-2 py-0.5 text-[11px] font-semibold text-on-error-container"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Need 1+ recipe
        </span>
      </div>
    </div>

    <div v-if="recipesPending" class="grid gap-4 rounded-2xl bg-surface-container p-4 md:p-8" aria-busy="true" aria-label="Loading recipes">
      <div class="h-6 w-1/3 animate-pulse rounded-lg bg-surface-container-high motion-reduce:animate-none" />
      <div class="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <div v-for="n in 7" :key="n" class="h-28 animate-pulse rounded-2xl bg-surface-container-high motion-reduce:animate-none" />
      </div>
    </div>

    <template v-else>
      <div v-show="activeTab === 'week'" class="rounded-2xl bg-surface-container p-4 md:p-8">
        <PlanWeekPlanEditor
          v-model:selected-day="selectedDay"
          :model-value="weekPlan"
          :recipe-by-id="recipeById"
          @choose="openPicker"
          @remove="requestRemove"
        />
      </div>

      <div v-show="activeTab === 'month'" class="rounded-2xl bg-surface-container p-4 md:p-8">
        <div v-if="!activeMonthId" class="mb-6 flex min-w-0 flex-wrap items-center gap-3">
          <p class="min-w-0 max-w-full break-words font-body text-sm text-on-surface-variant">
            No month plans yet. Create one to store four weekly snapshots.
          </p>
          <button
            type="button"
            class="rounded-2xl bg-primary px-5 py-2 font-body text-sm font-semibold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
            @click="createNewMonthPlan"
          >
            New month plan
          </button>
        </div>
        <PlanMonthPlanOverview
          v-else
          :model-value="monthPlan"
          :recipe-by-id="recipeById"
          @snapshot-current="onSnapshotCurrent"
          @open-week="onOpenWeek"
        />
        <div v-if="activeMonthId" class="mt-6">
          <button
            type="button"
            class="rounded-full bg-surface-container-low px-4 py-2 font-body text-xs font-semibold text-primary hover:bg-primary-fixed/30"
            @click="createNewMonthPlan"
          >
            Add another month plan
          </button>
        </div>
      </div>

      <div v-show="activeTab === 'templates'" class="rounded-2xl bg-surface-container p-4 md:p-8">
        <PlanTemplateLibraryPanel
          :items="templateList ?? []"
          :busy-id="templateBusyId"
          @load="loadTemplateIntoWeek"
          @delete="deleteTemplate"
          @refresh="() => refreshTemplates()"
        />
      </div>
    </template>

    <PlanRecipePickerModal
      :open="pickerOpen"
      :focus-restore-target="pickerRestoreTarget"
      :recipes="recipes ?? []"
      :categories="categoryOptions"
      :recently-used-ids="recentlyUsedIds"
      :duplicate-banner="duplicateHint"
      :staged-recipe-id="pendingPickId"
      @close="closePicker"
      @pick="onRecipePicked"
    />

    <Teleport to="body">
      <div
        v-if="removeTarget"
        ref="removeOverlayRef"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-meal-title"
      >
        <div class="max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-atelier-panel ring-1 ring-outline-variant/20">
          <h2 id="remove-meal-title" class="font-headline text-xl font-semibold text-on-surface">
            Remove this meal?
          </h2>
          <p class="mt-2 font-body text-sm text-on-surface-variant">
            The slot will be empty until you choose another recipe.
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-xl bg-surface-container-low px-4 py-2 font-body text-sm font-semibold text-on-surface"
              @click="cancelRemove"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-xl bg-error px-4 py-2 font-body text-sm font-semibold text-on-error"
              @click="confirmRemove"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
