<script setup lang="ts">
export interface WeekTemplateListItem {
  id: string
  name: string
  updatedAt: string
}

defineProps<{
  items: WeekTemplateListItem[]
  busyId: string | null
}>()

const emit = defineEmits<{
  load: [id: string]
  delete: [id: string]
  refresh: []
}>()

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  }
  catch {
    return iso
  }
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="font-headline text-4xl font-medium text-on-surface md:text-5xl">
          The template library
        </h2>
        <p class="mt-2 max-w-2xl font-body text-on-surface-variant">
          Saved week layouts. Load one into the week editor — it becomes a working copy until you save again.
        </p>
      </div>
      <button
        type="button"
        class="rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-fixed/30"
        @click="emit('refresh')"
      >
        Refresh list
      </button>
    </div>

    <div v-if="items.length === 0" class="rounded-2xl bg-surface-container-low p-12 text-center font-body text-on-surface-variant">
      No templates yet. Save your first week plan as a template from the week tab.
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="t in items"
        :key="t.id"
        class="flex flex-col rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant/20"
      >
        <h3 class="font-headline text-xl font-semibold leading-snug text-on-surface line-clamp-2">
          {{ t.name }}
        </h3>
        <p class="mt-2 font-body text-xs text-on-surface-variant">
          Last updated {{ formatDate(t.updatedAt) }}
        </p>
        <div class="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            class="flex-1 min-w-[8rem] rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 text-center text-sm font-semibold text-on-primary disabled:opacity-50"
            :disabled="busyId === t.id"
            @click="emit('load', t.id)"
          >
            Load into week
          </button>
          <button
            type="button"
            class="rounded-xl p-3 text-on-surface-variant hover:bg-error-container/30 hover:text-error"
            :disabled="busyId === t.id"
            aria-label="Delete template"
            @click="emit('delete', t.id)"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">delete</span>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
