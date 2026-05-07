<script setup lang="ts">
/**
 * Surfaces validation, import, and save-related messages with consistent
 * visible styling and matching ARIA live semantics for screen readers.
 */
withDefaults(
  defineProps<{
    errorMessage?: string | null
    warnings?: readonly string[] | null
    successMessage?: string | null
  }>(),
  {
    errorMessage: null,
    warnings: null,
    successMessage: null,
  },
)
</script>

<template>
  <div
    v-if="errorMessage || (warnings && warnings.length > 0) || successMessage"
    class="grid gap-4"
  >
    <div
      v-if="errorMessage"
      class="rounded-2xl bg-atelier-cream-error px-5 py-4 text-sm font-semibold text-atelier-error-foreground shadow-atelier-status-error"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="warnings && warnings.length > 0"
      class="rounded-2xl bg-atelier-cream-warning px-5 py-4 text-sm font-semibold text-atelier-warning-foreground shadow-atelier-status-warn"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p v-for="(warning, index) in warnings" :key="index">
        {{ warning }}
      </p>
    </div>

    <div
      v-if="successMessage"
      class="rounded-2xl bg-atelier-mint-success px-5 py-4 text-sm font-semibold text-atelier-success-foreground shadow-atelier-status-success"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ successMessage }}
    </div>
  </div>
</template>
