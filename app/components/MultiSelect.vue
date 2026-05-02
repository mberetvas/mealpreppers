<script setup lang="ts">
/**
 * Multi-select dropdown that displays existing options as selectable chips
 * and allows adding new values via a text input.
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
const containerRef = ref<HTMLElement | null>(null)

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  const selected = new Set(props.modelValue)

  return props.options
    .filter(option => !selected.has(option))
    .filter(option => !query || option.toLowerCase().includes(query))
})

const showDropdown = computed(() => isOpen.value && (filteredOptions.value.length > 0 || inputValue.value.trim().length > 0))

const canAddNew = computed(() => {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  const alreadyExists = props.options.some(o => o.toLowerCase() === lower)
  const alreadySelected = props.modelValue.some(v => v.toLowerCase() === lower)
  return !alreadyExists && !alreadySelected
})

function select(option: string): void {
  emit('update:modelValue', [...props.modelValue, option])
  inputValue.value = ''
}

function addNew(): void {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return
  emit('update:modelValue', [...props.modelValue, trimmed])
  inputValue.value = ''
}

function remove(option: string): void {
  emit('update:modelValue', props.modelValue.filter(v => v !== option))
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (canAddNew.value) {
      addNew()
    }
    else if (filteredOptions.value.length > 0) {
      select(filteredOptions.value[0])
    }
  }
  else if (event.key === 'Backspace' && inputValue.value === '' && props.modelValue.length > 0) {
    remove(props.modelValue[props.modelValue.length - 1])
  }
}

function onClickOutside(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative grid gap-2">
    <span class="text-sm font-semibold">{{ label }}</span>

    <div
      class="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 outline-none ring-1 ring-white/10 transition focus-within:ring-2 focus-within:ring-[#f09b54]"
      @click="isOpen = true"
    >
      <span
        v-for="item in modelValue"
        :key="item"
        class="inline-flex items-center gap-1 rounded-full bg-[#f0e4d2] px-3 py-1 text-xs font-bold text-[#485746]"
      >
        {{ item }}
        <button
          type="button"
          class="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-[#8d4b2b] transition hover:bg-[#e6d6bd]"
          aria-label="Remove"
          @click.stop="remove(item)"
        >
          <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
      </span>

      <input
        v-model="inputValue"
        type="text"
        class="min-w-[80px] flex-1 bg-transparent text-sm font-medium text-[#1e261f] outline-none"
        :placeholder="modelValue.length === 0 ? (placeholder ?? `Add ${label.toLowerCase()}...`) : ''"
        @focus="isOpen = true"
        @keydown="onInputKeydown"
      >
    </div>

    <div
      v-if="showDropdown"
      class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl bg-white p-2 shadow-[0_18px_54px_rgba(15,82,56,0.14)]"
    >
      <button
        v-for="option in filteredOptions"
        :key="option"
        type="button"
        class="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-[#1e261f] transition hover:bg-[#f0e4d2]"
        @mousedown.prevent="select(option)"
      >
        {{ option }}
      </button>

      <button
        v-if="canAddNew"
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#0f5238] transition hover:bg-[#f0e4d2]"
        @mousedown.prevent="addNew"
      >
        <span class="material-symbols-outlined text-[16px]">add</span>
        Add "{{ inputValue.trim() }}"
      </button>

      <p
        v-if="filteredOptions.length === 0 && !canAddNew"
        class="px-3 py-2 text-xs text-[#6a786b]"
      >
        No options available
      </p>
    </div>
  </div>
</template>
