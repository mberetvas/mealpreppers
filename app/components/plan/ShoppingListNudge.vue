<script setup lang="ts">
/**
 * Dismissible nudge banner shown immediately after a draft weekplan is first
 * persisted (POST). Renders only while planId is non-null. Parent is responsible
 * for clearing planId (by handling the dismissed event) and must not re-set it
 * on subsequent autosave PATCHes.
 */
defineProps<{ planId: string | null }>()
defineEmits<{ dismissed: [] }>()
</script>

<template>
  <div
    v-if="planId !== null"
    class="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl bg-atelier-mint-success px-4 py-2 font-body text-sm text-atelier-success-foreground shadow-atelier-status-success"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="font-semibold">Plan saved!</span>
    <NuxtLink
      :to="{ path: '/shopping-list', query: { plan: planId ?? undefined } }"
      class="font-semibold underline underline-offset-2 hover:opacity-80"
    >View shopping list</NuxtLink>
    <button
      type="button"
      aria-label="Dismiss"
      class="ml-auto rounded-full p-0.5 leading-none hover:opacity-70"
      @click="$emit('dismissed')"
    >
      ×
    </button>
  </div>
</template>
