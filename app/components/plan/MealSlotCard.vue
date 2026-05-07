<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import { useAccessibleOverlayInteraction } from '~/composables/useAccessibleOverlayInteraction'
import {
  LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS,
  recipeIdentityListImageAlt,
} from '~/constants/listImageLoadingStrategy'

defineProps<{
  title: string
  icon: string
  recipe: RecipeCatalogItem | null
  timeLabel?: string
  tagLine?: string
}>()

const emit = defineEmits<{
  choose: [invoker?: HTMLElement | null]
  remove: [invoker?: HTMLElement | null]
}>()

const menuOpen = ref(false)

const menuButtonRef = ref<HTMLButtonElement | null>(null)
const menuPanelRef = ref<HTMLElement | null>(null)

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeMenu(): void {
  menuOpen.value = false
}

async function pickChangeRecipe(): Promise<void> {
  closeMenu()
  await nextTick()
  emit('choose', menuButtonRef.value)
}

async function pickRemove(): Promise<void> {
  closeMenu()
  await nextTick()
  emit('remove', menuButtonRef.value)
}

function onDocMousedown(e: MouseEvent): void {
  if (!menuOpen.value) return
  const t = e.target as Node
  const root = menuRoot.value
  if (root && !root.contains(t)) closeMenu()
}

const menuRoot = ref<HTMLElement | null>(null)

onMounted(() => document.addEventListener('mousedown', onDocMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMousedown))

useAccessibleOverlayInteraction({
  open: menuOpen,
  scopeRef: menuPanelRef,
  restoreFocusRef: menuButtonRef,
  lockBackground: false,
  onRequestClose: closeMenu,
  getInitialFocus: () => menuPanelRef.value?.querySelector<HTMLElement>('[role="menuitem"]') ?? null,
})
</script>

<template>
  <article class="rounded-2xl bg-surface-container p-4 md:p-5">
    <header class="mb-4 flex items-center gap-2 text-on-surface-variant">
      <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">{{ icon }}</span>
      <h4 class="font-body text-sm font-semibold tracking-wide text-on-surface">
        {{ title }}
      </h4>
    </header>

    <div
      v-if="recipe"
      class="rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant/25"
    >
      <div class="flex gap-4">
        <div class="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container">
          <img
            v-if="recipe.imageUrl"
            v-bind="LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS"
            :src="recipe.imageUrl"
            :alt="recipeIdentityListImageAlt(recipe.title)"
            class="h-full w-full object-cover"
          >
          <div v-else class="flex h-full items-center justify-center text-primary">
            <span class="material-symbols-outlined text-3xl" aria-hidden="true">restaurant</span>
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-headline text-lg font-semibold leading-snug text-on-surface line-clamp-2">
            {{ recipe.title }}
          </p>
          <p v-if="timeLabel || tagLine" class="mt-1 flex flex-wrap gap-2 text-xs text-on-surface-variant">
            <span v-if="timeLabel">{{ timeLabel }}</span>
            <span v-if="timeLabel && tagLine">·</span>
            <span v-if="tagLine">{{ tagLine }}</span>
          </p>
        </div>
        <div ref="menuRoot" class="relative shrink-0 self-start">
          <button
            ref="menuButtonRef"
            type="button"
            class="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
            aria-label="Meal actions"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            @click.stop="toggleMenu"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">more_horiz</span>
          </button>
          <div
            v-if="menuOpen"
            ref="menuPanelRef"
            class="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-xl bg-surface-container-lowest py-1 shadow-atelier-menu ring-1 ring-outline-variant/20"
            role="menu"
            :aria-label="`${title} actions`"
          >
            <button
              type="button"
              class="flex min-h-11 w-full items-center px-4 text-left text-sm text-on-surface hover:bg-surface-container-low"
              role="menuitem"
              @click="pickChangeRecipe"
            >
              Change recipe
            </button>
            <button
              type="button"
              class="flex min-h-11 w-full items-center px-4 text-left text-sm text-error hover:bg-error-container/30"
              role="menuitem"
              @click="pickRemove"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container-low py-10 text-center transition motion-reduce:transition-none hover:bg-primary-fixed/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="emit('choose', $event.currentTarget as HTMLElement)"
    >
      <span class="material-symbols-outlined text-3xl text-primary/80" aria-hidden="true">add_circle</span>
      <span class="font-body text-sm font-semibold text-primary">Choose recipe</span>
    </button>
  </article>
</template>
