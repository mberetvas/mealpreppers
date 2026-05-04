<script setup lang="ts">
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

defineProps<{
  title: string
  icon: string
  recipe: RecipeCatalogItem | null
  timeLabel?: string
  tagLine?: string
}>()

const emit = defineEmits<{
  choose: []
  remove: []
}>()

const menuOpen = ref(false)

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeMenu(): void {
  menuOpen.value = false
}

function onDocClick(e: MouseEvent): void {
  if (!menuOpen.value) return
  const t = e.target as Node
  const root = menuRoot.value
  if (root && !root.contains(t)) closeMenu()
}

const menuRoot = ref<HTMLElement | null>(null)

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
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
      class="rounded-2xl bg-surface-container-lowest p-3 shadow-[0_8px_24px_rgba(15,82,56,0.06)] ring-1 ring-outline-variant/20"
    >
      <div class="flex gap-4">
        <div class="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container">
          <img
            v-if="recipe.imageUrl"
            :src="recipe.imageUrl"
            :alt="`Photo of ${recipe.title}`"
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
            type="button"
            class="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
            aria-label="Meal actions"
            @click.stop="toggleMenu"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">more_horiz</span>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-xl bg-surface-container-lowest py-1 shadow-[0_12px_32px_rgba(15,82,56,0.12)] ring-1 ring-outline-variant/20"
            role="menu"
          >
            <button
              type="button"
              class="block w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low"
              role="menuitem"
              @click="emit('choose'); closeMenu()"
            >
              Change recipe
            </button>
            <button
              type="button"
              class="block w-full px-4 py-2 text-left text-sm text-error hover:bg-error-container/30"
              role="menuitem"
              @click="emit('remove'); closeMenu()"
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
      class="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container-low py-10 text-center transition hover:bg-primary-fixed/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="emit('choose')"
    >
      <span class="material-symbols-outlined text-3xl text-primary/80" aria-hidden="true">add_circle</span>
      <span class="font-body text-sm font-semibold text-primary">Choose recipe</span>
    </button>
  </article>
</template>
