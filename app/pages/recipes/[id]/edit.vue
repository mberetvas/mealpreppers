<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { validateRecipeImageFile } from '~/utils/recipeImageValidation'

interface IngredientFormRow {
  rawText: string
  name: string
  quantity: string
  unit: string
}

interface StepFormRow {
  text: string
}

const route = useRoute()
const router = useRouter()
const recipeId = computed(() => String(route.params.id))

const isSaving = ref(false)
const errorMessage = ref('')

const { data: existingRecipe, error: loadError, pending } = await useFetch<RecipeCatalogItem>(
  () => `/api/v1/recipes/${recipeId.value}`,
  { key: () => `recipe-edit-${recipeId.value}` },
)

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
  ingredients: [blankIngredient()] as IngredientFormRow[],
  steps: [blankStep()] as StepFormRow[],
})

const localPreviewUrl = ref<string | null>(null)
const isUploadingImage = ref(false)
const recipeImageInputRef = ref<HTMLInputElement | null>(null)

const imagePreviewSource = computed(() => localPreviewUrl.value || form.imageUrl.trim())
const canSave = computed(() => form.title.trim().length > 0 && normalizedIngredients().length > 0 && !isSaving.value)

// Populate form with existing recipe data once loaded
if (existingRecipe.value) {
  populateForm(existingRecipe.value)
}

function populateForm(recipe: RecipeCatalogItem): void {
  form.title = recipe.title
  form.description = recipe.description ?? ''
  form.imageUrl = recipe.imageUrl ?? ''
  form.sourceUrl = recipe.sourceUrl ?? ''
  form.sourceHost = recipe.sourceHost ?? ''
  form.servings = recipe.servings !== undefined ? String(recipe.servings) : ''
  form.prepTimeMinutes = recipe.prepTimeMinutes !== undefined ? String(recipe.prepTimeMinutes) : ''
  form.cookTimeMinutes = recipe.cookTimeMinutes !== undefined ? String(recipe.cookTimeMinutes) : ''
  form.totalTimeMinutes = recipe.totalTimeMinutes !== undefined ? String(recipe.totalTimeMinutes) : ''
  form.difficulty = recipe.difficulty ?? ''
  form.categories = [...recipe.categories]
  form.tags = [...recipe.tags]
  form.ingredients = recipe.ingredients.length > 0
    ? recipe.ingredients.map(ing => ({
        rawText: ing.rawText,
        name: ing.name,
        quantity: ing.quantity !== undefined ? String(ing.quantity) : '',
        unit: ing.unit ?? '',
      }))
    : [blankIngredient()]
  form.steps = recipe.steps.length > 0
    ? recipe.steps.map(step => ({ text: step.text }))
    : [blankStep()]
}

async function saveRecipe(): Promise<void> {
  errorMessage.value = ''

  if (!canSave.value) {
    errorMessage.value = 'Title and ingredients are required.'
    return
  }

  isSaving.value = true

  try {
    await $fetch(`/api/v1/recipes/${recipeId.value}`, {
      method: 'PUT',
      body: buildPayload(),
    })

    await router.push(`/recipes/${recipeId.value}`)
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error, 'Recipe could not be saved.')
  }
  finally {
    isSaving.value = false
  }
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
      return { rawText, name, quantity, unit: optionalText(ingredient.unit) }
    })
    .filter(ingredient => ingredient.rawText.length > 0 && ingredient.name.length > 0)
}

function blankIngredient(): IngredientFormRow {
  return { rawText: '', name: '', quantity: '', unit: '' }
}

function blankStep(): StepFormRow {
  return { text: '' }
}

function optionalText(value: string): string | undefined {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

function optionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim().replace(',', '.')
  if (!trimmedValue) return undefined
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
  if (!file) return

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
    const result = await $fetch<{ url: string }>('/api/v1/recipes/upload-image', { method: 'POST', body })
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

useSeoMeta({
  title: () => (existingRecipe.value
    ? `Edit ${existingRecipe.value.title} | Your Atelier`
    : 'Edit Recipe | Your Atelier'),
})
</script>

<template>
  <div class="min-h-screen bg-[#f7f2e8] px-4 pb-24 pt-8 text-[#1e261f] sm:px-6 lg:px-10">
    <div v-if="pending" class="mx-auto grid max-w-7xl gap-8">
      <div class="h-10 w-2/3 animate-pulse rounded-2xl bg-[#fffaf0]" />
      <div class="h-64 animate-pulse rounded-[28px] bg-[#fffaf0]" />
    </div>

    <section
      v-else-if="loadError"
      class="mx-auto max-w-3xl rounded-[28px] bg-[#fff1e8] p-6 text-[#9c3d16] shadow-[0_18px_54px_rgba(156,61,22,0.08)]"
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

    <form v-else class="mx-auto grid max-w-7xl gap-8" @submit.prevent="saveRecipe">
      <header class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7662f]">
            Recipe Atelier
          </p>
          <h1 class="mt-3 font-['Newsreader'] text-5xl font-semibold leading-tight text-[#123628] sm:text-6xl">
            Edit Recipe
          </h1>
        </div>

        <NuxtLink
          :to="`/recipes/${recipeId}`"
          class="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl px-1 py-1 text-sm font-bold text-[#0f5238] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
        >
          <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
          Cancel
        </NuxtLink>
      </header>

      <div v-if="errorMessage" class="rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-semibold text-[#9c3d16] shadow-[0_10px_30px_rgba(156,61,22,0.08)]">
        {{ errorMessage }}
      </div>

      <div class="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
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

            <div class="grid gap-4">
              <div v-for="(ingredient, index) in form.ingredients" :key="index" class="grid min-w-0 gap-3 rounded-3xl bg-white/80 p-4 shadow-inner shadow-[#0f5238]/5 lg:grid-cols-[minmax(0,2fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto] lg:items-end">
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                  Name
                  <input v-model="ingredient.name" type="text" class="min-h-11 w-full min-w-0 rounded-xl bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#1e261f] outline-none ring-1 ring-[#0f5238]/10 focus:ring-2 focus:ring-[#0f5238]/45">
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                  Qty
                  <input v-model="ingredient.quantity" type="text" inputmode="decimal" class="min-h-11 w-full min-w-0 rounded-xl bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#1e261f] outline-none ring-1 ring-[#0f5238]/10 focus:ring-2 focus:ring-[#0f5238]/45">
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                  Unit
                  <input v-model="ingredient.unit" type="text" class="min-h-11 w-full min-w-0 rounded-xl bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#1e261f] outline-none ring-1 ring-[#0f5238]/10 focus:ring-2 focus:ring-[#0f5238]/45">
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#708071]">
                  Raw text
                  <input v-model="ingredient.rawText" type="text" class="min-h-11 w-full min-w-0 rounded-xl bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#1e261f] outline-none ring-1 ring-[#0f5238]/10 focus:ring-2 focus:ring-[#0f5238]/45">
                </label>
                <button type="button" class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[#8d4b2b] transition hover:bg-[#f7e0d2]" aria-label="Remove ingredient" @click="removeIngredient(index)">
                  <span class="material-symbols-outlined text-[21px]">delete</span>
                </button>
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
                <textarea v-model="step.text" rows="3" class="rounded-2xl bg-white px-4 py-3 text-sm text-[#1e261f] outline-none ring-1 ring-[#0f5238]/10 focus:ring-2 focus:ring-[#0f5238]/45" />
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
                  <input v-model="form.difficulty" type="text" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-[#1e261f] outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f09b54]">
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
            {{ isSaving ? 'Saving' : 'Save Changes' }}
          </button>
        </aside>
      </div>
    </form>
  </div>
</template>
