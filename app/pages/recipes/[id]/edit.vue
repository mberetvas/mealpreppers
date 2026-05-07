<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { validateRecipeImageFile } from '~/utils/recipeImageValidation'

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

const route = useRoute()
const router = useRouter()

/** Params can lag route.path on client navigation; path is authoritative. */
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

const isSaving = ref(false)
const errorMessage = ref('')

const { data: existingRecipe, error: loadError, pending } = await useFetch<RecipeCatalogItem>(
  () => (recipeId.value ? `/api/v1/recipes/${recipeId.value}` : null),
  { key: () => `recipe-edit-${recipeId.value || 'pending'}`, watch: [recipeId] },
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
        showDetails: !!(ing.quantity || ing.unit || (ing.name && ing.name !== ing.rawText)),
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
  return { rawText: '', name: '', quantity: '', unit: '', showDetails: false }
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
  <div class="min-h-screen bg-atelier-canvas px-4 pb-24 pt-8 text-atelier-ink sm:px-6 lg:px-10">
    <div v-if="pending" class="mx-auto grid max-w-7xl gap-8">
      <div class="h-10 w-2/3 animate-pulse rounded-2xl bg-atelier-skeleton" />
      <div class="h-64 animate-pulse rounded-[28px] bg-atelier-skeleton" />
    </div>

    <section
      v-else-if="loadError"
class="mx-auto max-w-3xl rounded-[28px] bg-atelier-cream-error p-6 text-atelier-error-foreground shadow-atelier-status-error"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
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

    <form v-else class="mx-auto grid max-w-7xl gap-8" @submit.prevent="saveRecipe">
      <header class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-atelier-warm-accent">
            Recipe Atelier
          </p>
          <h1 class="mt-3 font-['Newsreader'] text-5xl font-semibold leading-tight text-atelier-heading sm:text-6xl">
            Edit Recipe
          </h1>
        </div>

        <NuxtLink
          :to="`/recipes/${recipeId}`"
          class="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl px-1 py-1 text-sm font-bold text-primary transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
          Cancel
        </NuxtLink>
      </header>

      <FormFlowStatusSurfaces :error-message="errorMessage" />

      <div class="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <main class="grid min-w-0 gap-8">
          <AtelierParchmentSection>
            <div class="grid gap-5">
              <label class="grid gap-3 text-sm font-semibold text-atelier-field-label">
                Title
                <input
                  v-model="form.title"
                  type="text"
                  class="design-input"
                >
              </label>

              <label class="grid gap-3 text-sm font-semibold text-atelier-field-label">
                Description
                <textarea
                  v-model="form.description"
                  rows="4"
                  class="design-textarea"
                />
              </label>

              <label class="grid gap-3 text-sm font-semibold text-atelier-field-label">
                Image URL
                <input
                  v-model="form.imageUrl"
                  type="url"
                  class="design-input"
                >
              </label>

              <AtelierInsetWell>
                <p class="text-sm font-semibold text-atelier-field-label">
                  Or upload a photo
                </p>
                <p class="text-xs leading-relaxed text-atelier-muted">
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
                  <AtelierPillChipButton :disabled="isUploadingImage" @click="triggerRecipeImagePicker">
                    <span class="material-symbols-outlined text-[20px]">upload</span>
                    {{ isUploadingImage ? 'Uploading' : 'Choose image file' }}
                  </AtelierPillChipButton>
                  <button
                    v-if="imagePreviewSource"
                    type="button"
                    class="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-atelier-destructive underline-offset-2 hover:underline"
                    @click="clearRecipeImage"
                  >
                    Remove image
                  </button>
                </div>
              </AtelierInsetWell>
            </div>
          </AtelierParchmentSection>

          <AtelierParchmentSection>
            <div class="mb-5 flex items-center justify-between gap-4">
              <h2 class="font-['Newsreader'] text-3xl font-semibold text-atelier-heading">
                Ingredients
              </h2>
              <AtelierCircleIconButton aria-label="Add ingredient" @click="addIngredient">
                <span class="material-symbols-outlined text-[22px]">add</span>
              </AtelierCircleIconButton>
            </div>

            <p class="mb-4 text-xs leading-relaxed text-atelier-muted">
              Type ingredients as you'd write them on a shopping list. Expand a row to split quantity, unit, and name for structured data.
            </p>

            <div class="grid gap-4">
              <AtelierDenseFormRow v-for="(ingredient, index) in form.ingredients" :key="index">
                <div class="flex min-w-0 items-end gap-3">
                  <label class="grid min-w-0 flex-1 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-atelier-subtle">
                    As on your list
                    <input v-model="ingredient.rawText" type="text" placeholder="e.g. 2 tbsp olive oil" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <span class="mb-0.5 inline-flex">
                    <AtelierCircleIconButton
                      variant="ghost"
                      :aria-label="ingredient.showDetails ? 'Collapse details' : 'Split quantity'"
                      :aria-expanded="ingredient.showDetails"
                      :aria-controls="`ingredient-details-${index}`"
                      @click="ingredient.showDetails = !ingredient.showDetails"
                    >
                      <span class="material-symbols-outlined text-[18px]">{{ ingredient.showDetails ? 'unfold_less' : 'unfold_more' }}</span>
                    </AtelierCircleIconButton>
                  </span>
                  <span class="mb-0.5 inline-flex">
                    <AtelierCircleIconButton variant="danger" aria-label="Remove ingredient" @click="removeIngredient(index)">
                      <span class="material-symbols-outlined text-[19px]">delete</span>
                    </AtelierCircleIconButton>
                  </span>
                </div>

                <div v-if="ingredient.showDetails" :id="`ingredient-details-${index}`" class="grid min-w-0 gap-3 pt-1 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,2fr)]">
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-atelier-subtle">
                    Qty
                    <input v-model="ingredient.quantity" type="text" inputmode="decimal" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-atelier-subtle">
                    Unit
                    <input v-model="ingredient.unit" type="text" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                  <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-atelier-subtle">
                    Name
                    <input v-model="ingredient.name" type="text" class="design-input-sm min-w-0 normal-case tracking-normal">
                  </label>
                </div>
              </AtelierDenseFormRow>
            </div>
          </AtelierParchmentSection>

          <AtelierParchmentSection>
            <div class="mb-5 flex items-center justify-between gap-4">
              <h2 class="font-['Newsreader'] text-3xl font-semibold text-atelier-heading">
                Preparation
              </h2>
              <AtelierCircleIconButton no-shrink aria-label="Add step" @click="addStep">
                <span class="material-symbols-outlined text-[22px]">add</span>
              </AtelierCircleIconButton>
            </div>

            <div class="grid gap-4">
              <AtelierDenseFormRow v-for="(step, index) in form.steps" :key="index" layout="step">
                <AtelierStepIndexBadge :index="index + 1" />
                <textarea v-model="step.text" rows="3" class="design-textarea" />
                <AtelierCircleIconButton no-shrink variant="danger" aria-label="Remove step" @click="removeStep(index)">
                  <span class="material-symbols-outlined text-[21px]">delete</span>
                </AtelierCircleIconButton>
              </AtelierDenseFormRow>
            </div>
          </AtelierParchmentSection>
        </main>

        <aside class="grid min-w-0 content-start gap-6">
          <AtelierInversePanel>
            <div class="grid min-w-0 gap-4">
              <div class="grid min-w-0 grid-cols-2 gap-4">
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-atelier-inverse-on-muted">
                  Servings
                  <input v-model="form.servings" type="number" min="1" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-atelier-ink outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-atelier-focus-ring">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-atelier-inverse-on-muted">
                  Difficulty
                  <select v-model="form.difficulty" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-atelier-ink outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-atelier-focus-ring">
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
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-atelier-inverse-on-muted">
                  Prep
                  <input v-model="form.prepTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-atelier-ink outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-atelier-focus-ring">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-atelier-inverse-on-muted">
                  Cook
                  <input v-model="form.cookTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-atelier-ink outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-atelier-focus-ring">
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-semibold text-atelier-inverse-on-muted">
                  Total
                  <input v-model="form.totalTimeMinutes" type="number" min="0" class="min-h-12 w-full min-w-0 rounded-2xl bg-white/95 px-4 text-atelier-ink outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-atelier-focus-ring">
                </label>
              </div>
              <MultiSelect
                v-model="form.categories"
                :options="recipeOptions.categories"
                label="Categories"
                class="text-atelier-inverse-on-muted"
              />
              <MultiSelect
                v-model="form.tags"
                :options="recipeOptions.tags"
                label="Tags"
                class="text-atelier-inverse-on-muted"
              />
            </div>
          </AtelierInversePanel>

          <AtelierParchmentSection v-if="imagePreviewSource" bleed>
            <img :src="imagePreviewSource" :alt="form.title || 'Recipe image'" class="aspect-[4/3] w-full object-cover">
          </AtelierParchmentSection>

          <AtelierBlockButton variant="cta" native-type="submit" :disabled="!canSave">
            <span class="material-symbols-outlined text-[20px]">save</span>
            {{ isSaving ? 'Saving' : 'Save Changes' }}
          </AtelierBlockButton>
        </aside>
      </div>
    </form>
  </div>
</template>
