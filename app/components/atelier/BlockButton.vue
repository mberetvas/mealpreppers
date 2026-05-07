<script setup lang="ts">
import { computed } from 'vue'

/**
 * Full-width rectangular actions: inline primary (import) vs CTA (save).
 */
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'cta'
  disabled?: boolean
  nativeType?: 'button' | 'submit'
}>(), {
  variant: 'primary',
  disabled: false,
  nativeType: 'button',
})

const buttonClass = computed(() => {
  const layout = 'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition disabled:cursor-not-allowed'
  if (props.variant === 'cta') {
    return `${layout} bg-atelier-cta shadow-atelier-cta-btn hover:bg-atelier-cta-hover disabled:bg-atelier-cta-disabled`
  }
  return `${layout} bg-primary shadow-atelier-primary-btn hover:bg-atelier-primary-hover disabled:bg-atelier-primary-disabled`
})
</script>

<template>
  <button :type="nativeType" :class="buttonClass" :disabled="disabled">
    <slot />
  </button>
</template>
