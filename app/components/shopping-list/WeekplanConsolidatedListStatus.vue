<script setup lang="ts">
import { computed } from 'vue'

/**
 * Presentational badge that maps two shopping-list flags to one of three visible states:
 * "List ready", "List outdated", or "No list yet".
 *
 * Has no side-effects or API calls; all data comes from props.
 */
const props = defineProps<{
  /** True when a consolidated shopping list row exists for this plan. */
  hasSavedShoppingList: boolean
  /** True when the saved list's fingerprint no longer matches the current plan body. */
  shoppingListDeprecated: boolean
}>()

const label = computed<string>(() => {
  if (!props.hasSavedShoppingList) return 'No list yet'
  if (props.shoppingListDeprecated) return 'List outdated'
  return 'List ready'
})

const variantClasses = computed<string>(() => {
  if (!props.hasSavedShoppingList) return 'bg-atelier-chip text-atelier-neutral-action'
  if (props.shoppingListDeprecated) return 'bg-atelier-cream-warning text-atelier-warning-foreground'
  return 'bg-atelier-mint-success text-atelier-success-foreground'
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold"
    :class="variantClasses"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >{{ label }}</span>
</template>
