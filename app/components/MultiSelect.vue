<script setup lang="ts">
/**
 * Multi-select combobox that displays selected values as removable chips and
 * allows picking from a filtered listbox or typing a new value.
 *
 * Implements the ARIA combobox pattern (APG 1.2):
 * - input: role="combobox" + aria-expanded + aria-controls + aria-activedescendant
 * - dropdown: role="listbox" + aria-multiselectable
 * - options: role="option" + aria-selected
 * - keyboard: ArrowDown/Up to navigate, Enter/Space to select, Escape to close,
 *   Backspace on empty input removes last chip
 */
const props = defineProps<{
  modelValue: string[]
  options: string[]
  label: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const isOpen = ref(false)
const inputValue = ref('')
const activeIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const listboxId = useId()
const labelId = useId()

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  const selected = new Set(props.modelValue)
  return props.options
    .filter(option => !selected.has(option))
    .filter(option => !query || option.toLowerCase().includes(query))
})

const showDropdown = computed(
  () => isOpen.value && (filteredOptions.value.length > 0 || inputValue.value.trim().length > 0),
)

const canAddNew = computed(() => {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return (
    !props.options.some(o => o.toLowerCase() === lower)
    && !props.modelValue.some(v => v.toLowerCase() === lower)
  )
})

/** All navigable entries in the dropdown: existing options + optional "Add new" row. */
const navigableCount = computed(
  () => filteredOptions.value.length + (canAddNew.value ? 1 : 0),
)

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

const activeDescendant = computed(() => {
  if (activeIndex.value < 0 || !showDropdown.value) return undefined
  return optionId(activeIndex.value)
})

function openDropdown(): void {
  isOpen.value = true
  activeIndex.value = -1
}

function closeDropdown(): void {
  isOpen.value = false
  activeIndex.value = -1
}

function select(option: string): void {
  emit('update:modelValue', [...props.modelValue, option])
  inputValue.value = ''
  activeIndex.value = -1
  inputRef.value?.focus()
}

function addNew(): void {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return
  emit('update:modelValue', [...props.modelValue, trimmed])
  inputValue.value = ''
  activeIndex.value = -1
  inputRef.value?.focus()
}

function remove(option: string): void {
  emit('update:modelValue', props.modelValue.filter(v => v !== option))
}

function activateIndex(i: number): void {
  activeIndex.value = Math.max(-1, Math.min(i, navigableCount.value - 1))
}

function commitActiveOption(): void {
  if (activeIndex.value < 0) return
  if (activeIndex.value < filteredOptions.value.length) {
    select(filteredOptions.value[activeIndex.value])
  }
  else if (canAddNew.value) {
    addNew()
  }
}

function onInputKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!showDropdown.value) openDropdown()
      activateIndex(activeIndex.value + 1)
      break

    case 'ArrowUp':
      event.preventDefault()
      activateIndex(activeIndex.value - 1)
      break

    case 'Enter':
      event.preventDefault()
      if (activeIndex.value >= 0) {
        commitActiveOption()
      }
      else if (canAddNew.value) {
        addNew()
      }
      else if (filteredOptions.value.length > 0) {
        select(filteredOptions.value[0])
      }
      break

    case 'Escape':
      event.preventDefault()
      closeDropdown()
      break

    case 'Backspace':
      if (inputValue.value === '' && props.modelValue.length > 0) {
        remove(props.modelValue[props.modelValue.length - 1])
      }
      break
  }
}

function onClickOutside(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative grid gap-2">
    <span :id="labelId" class="text-sm font-semibold">{{ label }}</span>

    <div
      class="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl bg-atelier-parchment/95 px-3 py-2 outline-none ring-1 ring-primary/10 transition focus-within:ring-2 focus-within:ring-atelier-focus-ring"
      @click="inputRef?.focus()"
    >
      <span
        v-for="item in modelValue"
        :key="item"
        class="inline-flex items-center gap-1 rounded-full bg-atelier-chip px-3 py-1 text-xs font-bold text-atelier-neutral-action"
      >
        {{ item }}
        <button
          type="button"
          class="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-atelier-warm-accent transition hover:bg-atelier-image-well"
          :aria-label="`Remove ${item}`"
          @click.stop="remove(item)"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
        </button>
      </span>

      <input
        :id="`${listboxId}-input`"
        ref="inputRef"
        v-model="inputValue"
        type="text"
        role="combobox"
        autocomplete="off"
        :aria-labelledby="labelId"
        :aria-expanded="showDropdown"
        aria-haspopup="listbox"
        :aria-controls="listboxId"
        :aria-activedescendant="activeDescendant"
        class="min-w-[80px] flex-1 bg-transparent text-sm font-medium text-atelier-ink outline-none focus-visible:outline-none"
        :placeholder="modelValue.length === 0 ? (placeholder ?? `Add ${label.toLowerCase()}...`) : ''"
        @focus="openDropdown"
        @keydown="onInputKeydown"
      >
    </div>

    <ul
      v-if="showDropdown"
      :id="listboxId"
      role="listbox"
      aria-multiselectable="true"
      :aria-label="`${label} options`"
      class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl bg-atelier-parchment p-2 shadow-atelier-panel"
    >
      <li
        v-for="(option, i) in filteredOptions"
        :id="optionId(i)"
        :key="option"
        role="option"
        aria-selected="false"
        :class="[
          'flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-atelier-ink transition',
          activeIndex === i ? 'bg-atelier-chip' : 'hover:bg-atelier-chip',
        ]"
        @mousedown.prevent="select(option)"
        @mousemove="activeIndex = i"
      >
        {{ option }}
      </li>

      <li
        v-if="canAddNew"
        :id="optionId(filteredOptions.length)"
        role="option"
        aria-selected="false"
        :class="[
          'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-primary transition',
          activeIndex === filteredOptions.length ? 'bg-atelier-chip' : 'hover:bg-atelier-chip',
        ]"
        @mousedown.prevent="addNew"
        @mousemove="activeIndex = filteredOptions.length"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
        Add "{{ inputValue.trim() }}"
      </li>

      <li
        v-if="filteredOptions.length === 0 && !canAddNew"
        role="option"
        aria-disabled="true"
        aria-selected="false"
        class="px-3 py-2 text-xs text-atelier-meta"
      >
        No options available
      </li>
    </ul>
  </div>
</template>
