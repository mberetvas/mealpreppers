<script setup lang="ts">
/**
 * Animated popover/sheet picker for a single-select chip filter.
 * Owns: panel chrome, inline search, chip grid, dismissal (outside click + Escape),
 * focus management. Selection state lives in the parent via v-model.
 */
const props = withDefaults(defineProps<{
  label: string
  options: string[]
  modelValue: string
  open: boolean
  panelId: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}>(), {
  searchable: false,
  searchPlaceholder: 'Filter…',
  emptyLabel: 'No matches',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'close': []
}>()

const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const panelQuery = ref('')

const filteredOptions = computed(() => {
  const q = panelQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.toLowerCase().includes(q))
})

function pick(option: string): void {
  const next = props.modelValue === option ? '' : option
  emit('update:modelValue', next)
  emit('close')
}

function clearSelection(): void {
  emit('update:modelValue', '')
}

function onDocumentMousedown(event: MouseEvent): void {
  if (!props.open) return
  const target = event.target as Node | null
  if (rootRef.value && target && !rootRef.value.contains(target)) {
    emit('close')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMousedown)
  window.removeEventListener('keydown', onKeydown)
})

watch(() => props.open, async (isOpen) => {
  if (!isOpen) {
    panelQuery.value = ''
    return
  }
  await nextTick()
  if (props.searchable && searchInputRef.value) {
    searchInputRef.value.focus()
    return
  }
  const firstChip = panelRef.value?.querySelector<HTMLButtonElement>('[data-filter-chip]')
  firstChip?.focus()
})

const chipBaseClass
  = 'inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-bold transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238] motion-reduce:transition-none'
</script>

<template>
  <div ref="rootRef" class="relative">
    <slot
      name="trigger"
      :open="open"
      :selected="modelValue"
      :panel-id="panelId"
    />

    <Transition name="filter-panel">
      <div
        v-if="open"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="label"
        class="filter-panel absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-[#fffaf0] shadow-[0_22px_70px_rgba(15,82,56,0.18)] ring-1 ring-[#0f5238]/10"
      >
        <div class="flex items-center justify-between gap-3 px-4 pt-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {{ label }}
          </p>
          <div class="flex items-center gap-1">
            <button
              v-if="modelValue"
              type="button"
              class="inline-flex min-h-9 items-center justify-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9c3d16] transition hover:bg-[#fff1e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c3d16]"
              @click="clearSelection"
            >
              Clear
            </button>
            <button
              type="button"
              class="inline-flex size-9 items-center justify-center rounded-full text-[#485746] transition hover:bg-[#f0e4d2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5238]"
              :aria-label="`Close ${label.toLowerCase()} picker`"
              @click="$emit('close')"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          </div>
        </div>

        <div v-if="searchable" class="px-4 pt-3">
          <label class="flex min-h-11 items-center gap-2 rounded-full bg-white px-3 ring-1 ring-[#0f5238]/10 focus-within:ring-2 focus-within:ring-[#0f5238]/45">
            <span class="material-symbols-outlined text-[18px] text-[#6b7b6e]" aria-hidden="true">search</span>
            <input
              ref="searchInputRef"
              v-model="panelQuery"
              type="search"
              class="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1e261f] outline-none"
              :placeholder="searchPlaceholder"
              autocomplete="off"
            >
          </label>
        </div>

        <div class="max-h-[55vh] overflow-y-auto px-4 py-4 [scrollbar-color:rgba(15,82,56,0.35)_transparent] [scrollbar-width:thin]">
          <div v-if="filteredOptions.length === 0" class="px-1 py-6 text-center text-xs font-medium text-[#6a786b]">
            {{ emptyLabel }}
          </div>
          <div v-else class="filter-panel-chips flex flex-wrap gap-2">
            <button
              v-for="option in filteredOptions"
              :key="option"
              type="button"
              data-filter-chip
              :aria-pressed="modelValue === option"
              :class="[
                chipBaseClass,
                modelValue === option
                  ? 'bg-primary-fixed text-on-primary-fixed'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high',
              ]"
              @click="pick(option)"
            >
              {{ option }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.filter-panel-enter-active,
.filter-panel-leave-active {
  transition: opacity 180ms cubic-bezier(0.33, 1, 0.68, 1),
    transform 180ms cubic-bezier(0.33, 1, 0.68, 1);
}

.filter-panel-enter-from,
.filter-panel-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

.filter-panel-enter-to,
.filter-panel-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.filter-panel-chips > button {
  opacity: 0;
  transform: translateY(4px);
  animation: filter-chip-in 220ms cubic-bezier(0.33, 1, 0.68, 1) forwards;
}

.filter-panel-chips > button:nth-child(1) { animation-delay: 20ms; }
.filter-panel-chips > button:nth-child(2) { animation-delay: 40ms; }
.filter-panel-chips > button:nth-child(3) { animation-delay: 60ms; }
.filter-panel-chips > button:nth-child(4) { animation-delay: 80ms; }
.filter-panel-chips > button:nth-child(5) { animation-delay: 100ms; }
.filter-panel-chips > button:nth-child(6) { animation-delay: 120ms; }
.filter-panel-chips > button:nth-child(7) { animation-delay: 140ms; }
.filter-panel-chips > button:nth-child(8) { animation-delay: 160ms; }
.filter-panel-chips > button:nth-child(9) { animation-delay: 175ms; }
.filter-panel-chips > button:nth-child(10) { animation-delay: 190ms; }
.filter-panel-chips > button:nth-child(11) { animation-delay: 200ms; }
.filter-panel-chips > button:nth-child(n+12) { animation-delay: 210ms; }

@keyframes filter-chip-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .filter-panel-enter-active,
  .filter-panel-leave-active {
    transition: opacity 80ms linear;
  }
  .filter-panel-enter-from,
  .filter-panel-leave-to {
    transform: none;
  }
  .filter-panel-chips > button {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
