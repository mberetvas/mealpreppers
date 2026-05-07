<script setup lang="ts">
import { computed } from 'vue'

/**
 * Primary parchment card shell for recipe add/edit and catalog-adjacent forms.
 */
const props = withDefaults(defineProps<{
  /** `compact` matches URL import blocks; `default` matches main form sections. */
  density?: 'default' | 'compact'
  /** Full-bleed chrome (e.g. recipe image preview) — no inner padding. */
  bleed?: boolean
}>(), {
  density: 'default',
  bleed: false,
})

const shellClass = computed(() => {
  if (props.bleed) {
    return 'overflow-hidden rounded-[28px] bg-atelier-parchment shadow-atelier-card'
  }
  const padding = props.density === 'compact' ? 'sm:p-6' : 'sm:p-7'
  return `rounded-[28px] bg-atelier-parchment p-5 shadow-atelier-card ${padding}`
})
</script>

<template>
  <section :class="shellClass">
    <slot />
  </section>
</template>
