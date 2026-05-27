<script setup lang="ts">
import { computed } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import { formatMergedLine } from '~~/utils/shoppingList'
import { groupLinesByAisle } from '~~/utils/aisleGrouping'

const props = withDefaults(defineProps<{
  /** Lines to display, already sorted in store walk order by the caller. */
  lines: MergedLine[]
  /** When true, hides all interaction affordances (checkboxes). */
  readonly?: boolean
  /** IDs of lines that differ from baseline — rendered with diff highlighting. */
  changedLineIds?: Set<string>
}>(), {
  readonly: false,
  changedLineIds: () => new Set<string>(),
})

/** Lines partitioned by Dutch aisle label in supermarket walk order. Empty groups are omitted. */
const aisleGroups = computed(() => groupLinesByAisle(props.lines))

/** Resolved set of changed IDs; defaults to empty so callers may omit the prop. */
const effectiveChangedIds = computed(() => props.changedLineIds)
</script>

<template>
  <div class="space-y-4" data-testid="aisle-section">
    <details
      v-for="group in aisleGroups"
      :key="group.category"
      open
      class="rounded-2xl bg-atelier-parchment ring-1 ring-primary/10"
      :data-testid="`aisle-group-${group.category}`"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-atelier-heading"
        :data-testid="`aisle-label-${group.category}`"
      >
        <span>{{ group.label }}</span>
        <span class="material-symbols-outlined text-[18px] text-atelier-description" aria-hidden="true">
          expand_more
        </span>
      </summary>

      <ul class="space-y-1 px-5 pb-4 pt-1" :aria-label="group.label">
        <li
          v-for="line in group.lines"
          :key="line.id"
          :data-testid="effectiveChangedIds.has(line.id) ? 'diff-changed' : undefined"
          class="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-atelier-entry-hover motion-reduce:transition-none"
          :class="effectiveChangedIds.has(line.id) ? 'bg-atelier-chip/60 border-l-4 border-l-primary' : ''"
        >
          <input
            v-if="!readonly"
            type="checkbox"
            class="size-4 shrink-0 rounded border-outline-variant/40 accent-primary"
            :aria-label="`Check off ${line.name}`"
          >
          <span
            v-if="effectiveChangedIds.has(line.id)"
            class="material-symbols-outlined text-[16px] text-primary"
            aria-hidden="true"
          >auto_fix_high</span>
          <span class="flex-1 text-sm text-atelier-heading">
            {{ formatMergedLine(line) }}
          </span>
        </li>
      </ul>
    </details>
  </div>
</template>
