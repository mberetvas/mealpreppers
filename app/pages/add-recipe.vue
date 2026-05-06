<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { RecipePreviewResponse } from '~~/types/recipe-preview'
import { validateRecipeImageFile } from '~/utils/recipeImageValidation'

definePageMeta({
  layout: 'fullwidth',
})

type EntryMode = 'url' | 'manual'

interface IngredientFormRow {
  rawText: string
  name: string
  quantity: string
  unit: string
  showDetails: boolean
}

interface StepFormRow {
  text: string
}

const router = useRouter()
const entryMode = ref<EntryMode>('url')
const importUrl = ref('')
const isImporting = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const warnings = ref<string[]>([])

const { data: recipeOptions } = await useFetch<{ categories: string[], tags: string[] }>('/api/v1/recipes/options', {
  default: () => ({ categories: [], tags: [] }),
})

const form = reactive({
  title: '',
  description: '',
  imageUrl: '',
  sourceUrl: '',
  sourceHost: '',
  servings: '',
  prepTimeMinutes: '',
  cookTimeMinutes: '',
  totalTimeMinutes: '',
  difficulty: '',
  categories: [] as string[],
  tags: [] as string[],
  ingredients: [blankIngredient()],
  steps: [blankStep()],
})

const localPreviewUrl = ref<string | null>(null)
const isUploadingImage = ref(false)
const recipeImageInputRef = ref<HTMLInputElement | null>(null)

const imagePreviewSource = computed(() => localPreviewUrl.value || form.imageUrl.trim())

const canSave = computed(() => form.title.trim().length > 0 && normalizedIngredients().length > 0 && !isSaving.value)

async function importRecipe(): Promise<void> {
  errorMessage.value = ''
  warnings.value = []
  isImporting.value = true

  try {
    const result = await $fetch<RecipePreviewResponse>('/api/v1/recipes/preview', {
      method: 'POST',
      body: { url: importUrl.value.trim() },
    })

    applyPreviewDraft(result.draft)
    warnings.value = result.warnings
    entryMode.value = 'manual'
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error, 'Recipe could not be imported.')
  }
  finally {
    isImporting.value = false
  }
}

async function saveRecipe(): Promise<void> {
  errorMessage.value = ''

  if (!canSave.value) {
    errorMessage.value = 'Title and ingredients are required.'
    return
  }

  isSaving.value = true

  try {
    await $fetch('/api/v1/recipes', {
      method: 'POST',
      body: buildPayload(),
    })

    await router.push('/recipes')
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error, 'Recipe could not be saved.')
  }
  finally {
    isSaving.value = false
  }
}

function applyPreviewDraft(draft: RecipePreviewResponse['draft']): void {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = null
  }

  form.title = draft.title
  form.description = draft.description ?? ''
  form.imageUrl = draft.imageUrl ?? ''
  form.sourceUrl = draft.source.url
  form.sourceHost = draft.source.host
  form.servings = stringifyNumber(draft.servings)
  form.prepTimeMinutes = stringifyNumber(draft.prepTimeMinutes)
  form.cookTimeMinutes = stringifyNumber(draft.cookTimeMinutes)
  form.totalTimeMinutes = stringifyNumber(draft.totalTimeMinutes)
  form.difficulty = draft.difficulty ?? ''
  form.categories = [...draft.categories]
  form.tags = [...draft.tags]
  form.ingredients = draft.ingredients.length > 0
    ? draft.ingredients.map(ingredient => ({
        rawText: ingredient.rawText,
        name: ingredient.name,
        quantity: stringifyNumber(ingredient.quantity),
        unit: ingredient.unit ?? '',
        showDetails: !!(ingredient.quantity || ingredient.unit || (ingredient.name && ingredient.name !== ingredient.rawText)),
      }))
    : [blankIngredient()]
  form.steps = draft.steps.length > 0
    ? draft.steps.map(step => ({ text: step.text }))
    : [blankStep()]
}

function addIngredient(): void {
  form.ingredients.push(blankIngredient())
}

function removeIngredient(index: number): void {
  form.ingredients.splice(index, 1)

  if (form.ingredients.length === 0) {
    form.ingredients.push(blankIngredient())
  }
}

function addStep(): void {
  form.steps.push(blankStep())
}

function removeStep(index: number): void {
  form.steps.splice(index, 1)

  if (form.steps.length === 0) {
    form.steps.push(blankStep())
  }
}

function buildPayload() {
  return {
    title: form.title.trim(),
    description: optionalText(form.description),
    sourceUrl: optionalText(form.sourceUrl),
    sourceHost: optionalText(form.sourceHost),
    imageUrl: optionalText(form.imageUrl),
    servings: optionalNumber(form.servings),
    prepTimeMinutes: optionalNumber(form.prepTimeMinutes),
    cookTimeMinutes: optionalNumber(form.cookTimeMinutes),
    totalTimeMinutes: optionalNumber(form.totalTimeMinutes),
    difficulty: optionalText(form.difficulty),
    categories: form.categories,
    tags: form.tags,
    ingredients: normalizedIngredients(),
    steps: form.steps
      .map((step, index) => ({ position: index + 1, text: step.text.trim() }))
      .filter(step => step.text.length > 0),
  }
}

function normalizedIngredients() {
  return form.ingredients
    .map((ingredient) => {
      const rawText = ingredient.rawText.trim() || [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ').trim()
      const name = ingredient.name.trim() || rawText
      const quantity = optionalNumber(ingredient.quantity)

      return {
        rawText,
        name,
        quantity,
        unit: optionalText(ingredient.unit),
      }
    })
    .filter(ingredient => ingredient.rawText.length > 0 && ingredient.name.length > 0)
}

function blankIngredient(): IngredientFormRow {
  return { rawText: '', name: '', quantity: '', unit: '', showDetails: false }
}

function blankStep(): StepFormRow {
  return { text: '' }
}

function stringifyNumber(value: number | undefined): string {
  return value === undefined ? '' : value.toString()
}

function optionalText(value: string): string | undefined {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

function optionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim().replace(',', '.')

  if (!trimmedValue) {
    return undefined
  }

  const parsed = Number(trimmedValue)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'statusMessage' in error && typeof error.statusMessage === 'string') {
    return error.statusMessage
  }

  return fallback
}

function triggerRecipeImagePicker(): void {
  recipeImageInputRef.value?.click()
}

function clearRecipeImage(): void {
  form.imageUrl = ''

  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = null
  }

  if (recipeImageInputRef.value) {
    recipeImageInputRef.value.value = ''
  }
}

async function onRecipeImageSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  errorMessage.value = ''

  const validated = validateRecipeImageFile(file.type || 'application/octet-stream', file.size)

  if (!validated.ok) {
    errorMessage.value = validated.statusMessage
    input.value = ''
    return
  }

  const previousUrl = form.imageUrl.trim()

  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = null
  }

  localPreviewUrl.value = URL.createObjectURL(file)
  isUploadingImage.value = true

  try {
    const body = new FormData()
    body.append('file', file)

    const result = await $fetch<{ url: string }>('/api/v1/recipes/upload-image', {
      method: 'POST',
      body,
    })

    form.imageUrl = result.url

    if (localPreviewUrl.value) {
      URL.revokeObjectURL(localPreviewUrl.value)
      localPreviewUrl.value = null
    }
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error, 'Image could not be uploaded.')
    form.imageUrl = previousUrl

    if (localPreviewUrl.value) {
      URL.revokeObjectURL(localPreviewUrl.value)
      localPreviewUrl.value = null
    }
  }
  finally {
    isUploadingImage.value = false
    input.value = ''
  }
}

onBeforeUnmount(() => {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#f7f2e8] px-4 pb-24 pt-8 text-[#1e261f] sm:px-6 lg:px-10">
    <form class="mx-auto grid max-w-7xl gap-8" @submit.prevent="saveRecipe">
      <header class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7662f]">
            Recipe Atelier
          </p>
          <h1 class="mt-3 font-['Newsreader'] text-5xl font-semibold leading-tight text-[#123628] sm:text-6xl">
            Add Recipe
          </h1>
        </div>

        <div class="inline-grid grid-cols-2 rounded-full bg-white/75 p-1 shadow-[0_12px_40px_rgba(15,82,56,0.10)]">
          <button
            type="button"
            class="rounded-full px-5 py-3 text-sm font-semibold transition"
            :class="entryMode === 'url' ? 'bg-[#0f5238] text-white shadow-[0_10px_24px_rgba(15,82,56,0.22)]' : 'text-[#526458] hover:bg-[#f3eadb]'"
            @click="entryMode = 'url'"
          >
            URL
          </button>
          <button
            type="button"
            class="rounded-full px-5 py-3 text-sm font-semibold transition"
            :class="entryMode === 'manual' ? 'bg-[#0f5238] text-white shadow-[0_10px_24px_rgba(15,82,56,0.22)]' : 'text-[#526458] hover:bg-[#f3eadb]'"
            @click="entryMode = 'manual'"
          >
            Manual
          </button>
        </div>
      </header>

      <section v-if="entryMode === 'url'" class="rounded-[28px] bg-[#fffaf0] p-5 shadow-[0_22px_70px_rgba(15,82,56,0.10)] sm:p-6">
        <label class="grid gap-3 text-sm font-semibold text-[#31463a]">
          Recipe URL
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              v-model="importUrl"
              type="url"
              class="min-h-14 rounded-2xl bg-white px-4 text-base font-medium text-[#1e261f] shadow-inner shadow-[#0f5238]/5 outline-none ring-1 ring-[#0f5238]/10 transition focus:ring-2 focus:ring-[#0f5238]/45"
              placeholder="https://..."
            >
            <button
              type="button"
              class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0f5238] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,82,56,0.22)] transition hover:bg-[#174d38] disabled:cursor-not-allowed disabled:bg-[#8aa092]"
              :disabled="isImporting || importUrl.trim().length === 0"
              @click="importRecipe"
            >
              <span class="material-symbols-outlined text-[20px]">download</span>
              {{ isImporting ? 'Importing' : 'Import' }}
            </button>
          </div>
        </label>
      </section>

      <div v-if="errorMessage" class="rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-semibold text-[#9c3d16] shadow-[0_10px_30px_rgba(156,61,22,0.08)]">
        {{ errorMessage }}
      </div>

      <div v-if="warnings.length > 0" class="rounded-2xl bg-[#fff8d9] px-5 py-4 text-sm font-semibold text-[#735a08] shadow-[0_10px_30px_rgba(115,90,8,0.08)]">
        <p v-for="warning in warnings" :key="warning">
          {{ warning }}
        </p>
      </div>

      <div v-if="entryMode === 'manual'" class="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <main class="grid min-w-0 gap-8">
          <section class="rounded-[28px] bg-[#fffaf0] p-5 shadow-[0_22px_70px_rgba(15,82,56,0.10)] sm:p-7">
            <div class="grid gap-5">
              <label class="grid gap-3 text-sm font-semibold text-[#31463a]">
                Title
                <input
                  v-model="form.title"
                  type="text"
                  class="min-h-14 rounded-2xl bg-white px-4 text-base font-medium text-[#1e261f] shadow-inner shadow-[#0f5238]/5 outline-none ring-1 ring-[#0f5238]/10 transition focus:ring-2 focus:ring-[#0f5238]/45"
                >
              </label>

              <label class="grid gap-3 text-sm font-semibold text-[#31463a]">
                Description
                <textarea
                  v-model="form.description"
                  rows="4"
                  class="rounded-2xl bg-white px-4 py-3 text-base text-[#1e261f] shadow-inner shadow-[#0f5238]/5 outline-none ring-1 ring-[#0f5238]/10 transition focus:ring-2 focus:ring-[#0f5238]/45"
                />
              </label>

              <label class="grid gap-3 text-sm font-semibold text-[#31463a]">
                Image URL
                <input
                  v-model="form.imageUrl"
                  type="url"
                  class="min-h-14 rounded-2xl bg-white px-4 text-base text-[#1e261f] shadow-inner shadow-[#0f5238]/5 outline-none ring-1 ring-[#0f5238]/10 transition focus:ring-2 focus:ring-[#0f5238]/45"
                >
              </label>

              <div class="grid gap-3 rounded-2xl bg-white/60 p-4 ring-1 ring-[#0f5238]/10">
                <p class="text-sm font-semibold text-[#31463a]">
                  Or upload a photo
                </p>
                <p class="text-xs leading-relaxed text-[#526458]">
                  JPEG, PNG, WebP, or GIF, up to 5MB. Saves to your library and fills the image URL.
                </p>
                <input
                  ref="recipeImageInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="sr-only"
                  @change="onRecipeImageSelected"
                >
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f0e4d2] px-5 text-sm font-bold text-[#0f5238] transition hover:bg-[#e6d6bd] disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isUploadingImage"
                    @click="triggerRecipeImagePicker"
                  >
                    <span class="material-symbols-outlined text-[20px]">upload</span>
                    {{ isUploadingImage ? 'Uploading' : 'Choose image file' }}
                  </button>
                  <button
                    v-if="imagePreviewSource"
                    type="button"
                    class="text-sm font-semibold text-[#8d4b2b] underline-offset-2 hover:underline"
                    @click="clearRecipeImage"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[28px] bg-[#fffaf0] p-5 shadow-[0_22px_70px_rgba(15,82,56,0.10)] sm:p-7">
            <div class="mb-5 flex items-center justify-between gap-4">
              <h2 class="font-['Newsreader'] text-3xl font-semibold text-[#123628]">
                Ingredients
              </h2>
              <button type="button" class="inline-flex size-11 items-center justify-center rounded-full bg-[#f0e4d2] text-[#0f5238] transition hover:bg-[#e6d6bd]" aria-label="Add ingredient" @click="addIngredient">
                <span class="material-symbols-outlined text-[22px]">add</span>
              </button>
            </div>

            <p class="mb-4 text-xs leading-relaxed text-[#526458]">
              Type ingredients as you'd write them on a shopping list. Expand a row to split quantity, unit, and name for structured data.
            </p>

            <div class="grid gap-4">
              <div v-for="(ingredient, index) in form.ingredients" :key="index" class="grid min-w-0 gap-3 rounded-3xl bg-white/80 p-4 shadow-inner shadow-[#0f5238]/5">
                <div class="flex min-w-0 items-end gap-3">
                  <label class="grid min-w-0 flex-1 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                    As on your list
                    <input v-model="ingredient.rawText" type="text" placeholder="e.g. 2 tbsp olive oil" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <button
                    type="button"
                    class="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[#526458] transition hover:bg-[#f0e4d2]"
                    :aria-label="ingredient.showDetails ? 'Collapse details' : 'Split quantity'"
                    @click="ingredient.showDetails = !ingredient.showDetails"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ ingredient.showDetails ? 'unfold_less' : 'unfold_more' }}</span>
                  </button>
                  <button type="button" class="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[#8d4b2b] transition hover:bg-[#f7e0d2]" aria-label="Remove ingredient" @click="removeIngredient(index)">
                    <span class="material-symbols-outlined text-[19px]">delete</span>
                  </button>
                </div>

                <div v-if="ingredient.showDetails" class="grid min-w-0 gap-3 pt-1 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,2fr)]">
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                    Qty
                    <input v-model="ingredient.quantity" type="text" inputmode="decimal" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                    Unit
                    <input v-model="ingredient.unit" type="text" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                    Name
                    <input v-model="ingredient.name" type="text" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[28px] bg-[#fffaf0] p-5 shadow-[0_22px_70px_rgba(15,82,56,0.10)] sm:p-7">
            <div class="mb-5 flex items-center justify-between gap-4">
              <h2 class="font-['Newsreader'] text-3xl font-semibold text-[#123628]">
                Preparation
              </h2>
              <button type="button" class="inline-flex size-11 items-center justify-center rounded-full bg-[#f0e4d2] text-[#0f5238] transition hover:bg-[#e6d6bd]" aria-label="Add step" @click="addStep">
                <span class="material-symbols-outlined text-[22px]">add</span>
              </button>
            </div>

            <div class="grid gap-4">
              <div v-for="(step, index) in form.steps" :key="index" class="grid gap-3 rounded-3xl bg-white/80 p-4 shadow-inner shadow-[#0f5238]/5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                <div class="flex size-10 items-center justify-center rounded-full bg-[#0f5238] font-bold text-white">
                  {{ index + 1 }}
                </div>
                <textarea v-model="step.text" rows="3" class="design-textarea" />
                <button type="button" class="inline-flex size-10 items-center justify-center rounded-full text-[#8d4b2b] transition hover:bg-[#f7e0d2]" aria-label="Remove step" @click="removeStep(index)">
                  <span class="material-symbols-outlined text-[21px]">delete</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        <aside class="grid min-w-0 content-start gap-6">
          <section class="min-w-0 rounded-[28px] bg-[#123628] p-5 text-white shadow-[0_22px_70px_rgba(15,82,56,0.20)] sm:p-6">
            <div class="grid min-w-0 gap-4">
              <div class="grid min-w-0 grid-cols-2 gap-4">
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-[#d8e4db]">
                  Servings
                  <input v-model="form.servings" type="number" min="1" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-[#d8e4db]">
                  Difficulty
                  <select v-model="form.difficulty" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
                    <option value="">
                      —
                    </option>
                    <option value="Easy">
                      Easy
                    </option>
                    <option value="Medium">
                      Medium
                    </option>
                    <option value="Hard">
                      Hard
                    </option>
                  </select>
                </label>
              </div>
              <div class="grid min-w-0 grid-cols-3 gap-4">
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-[#d8e4db]">
                  Prep
                  <input v-model="form.prepTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-[#d8e4db]">
                  Cook
                  <input v-model="form.cookTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-[#d8e4db]">
                  Total
                  <input v-model="form.totalTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
                </label>
              </div>
              <MultiSelect
                v-model="form.categories"
                :options="recipeOptions.categories"
                label="Categories"
                class="text-[#d8e4db]"
              />
              <MultiSelect
                v-model="form.tags"
                :options="recipeOptions.tags"
                label="Tags"
                class="text-[#d8e4db]"
              />
            </div>
          </section>

          <section v-if="imagePreviewSource" class="overflow-hidden rounded-[28px] bg-[#fffaf0] shadow-[0_22px_70px_rgba(15,82,56,0.10)]">
            <img :src="imagePreviewSource" :alt="form.title || 'Recipe image'" class="aspect-[4/3] w-full object-cover">
          </section>

          <button
            type="submit"
            class="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#b7662f] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(183,102,47,0.24)] transition hover:bg-[#9f5526] disabled:cursor-not-allowed disabled:bg-[#c7aa93]"
            :disabled="!canSave"
          >
            <span class="material-symbols-outlined text-[20px]">save</span>
            {{ isSaving ? 'Saving' : 'Save Recipe' }}
          </button>
        </aside>
      </div>
    </form>
  </div>
</template>
