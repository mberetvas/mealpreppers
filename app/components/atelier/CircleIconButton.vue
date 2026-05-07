<script setup lang="ts">
import { computed } from 'vue'

/**
 * Circular icon-only control for dense form toolbars (add row, expand, delete).
 */
const props = withDefaults(defineProps<{
  variant?: 'accent' | 'ghost' | 'danger'
  /** When true, does not add horizontal shrink-0 (ingredient row uses shrink-0 on siblings). */
  noShrink?: boolean
}>(), {
  variant: 'accent',
  noShrink: false,
})

const buttonClass = computed(() => {
  const touch = 'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full transition'
  const shrink = props.noShrink ? '' : ' shrink-0'
  if (props.variant === 'ghost') {
    return `${touch}${shrink} text-atelier-muted hover:bg-atelier-chip`
  }
  if (props.variant === 'danger') {
    return `${touch}${shrink} text-atelier-destructive hover:bg-atelier-destructive-soft`
  }
  return `${touch}${shrink} bg-atelier-chip text-primary hover:bg-atelier-chip-hover`
})
</script>

<template>
  <button type="button" :class="buttonClass">
    <slot />
  </button>
</template>
