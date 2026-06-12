<script setup lang="ts">
import { computed } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import { formatMergedLine } from '~~/utils/shoppingList'
import { groupLinesByAisle, hasAisleCategories } from '~~/utils/aisleGrouping'

const props = withDefaults(defineProps<{
  /** Lines in display order (AI-assigned order when categories are present). */
  lines: MergedLine[]
  /** When true, hides all interaction affordances (checkboxes). */
  readonly?: boolean
  /** IDs of lines that differ from baseline — rendered with diff highlighting. */
  changedLineIds?: Set<string>
}>(), {
  readonly: false,
  changedLineIds: () => new Set<string>(),
})

/** Lines partitioned by aisle category (run-length groups) when categories exist. */
const aisleGroups = computed(() => groupLinesByAisle(props.lines))

/** Legacy saved lists without aisleCategory render as a single flat list. */
const isLegacyFlat = computed(() => props.lines.length > 0 && !hasAisleCategories(props.lines))

/** Resolved set of changed IDs; defaults to empty so callers may omit the prop. */
const effectiveChangedIds = computed(() => props.changedLineIds)
</script>

<template>
  <div class="space-y-4" data-testid="aisle-section">
    <p
      v-if="isLegacyFlat"
      data-testid="legacy-flat-banner"
      class="rounded-2xl bg-atelier-chip/40 px-5 py-3 text-sm text-atelier-description print:hidden"
      role="status"
    >
      Re-consolidate to group by supermarket aisle.
    </p>

    <ul
      v-if="isLegacyFlat"
      data-testid="aisle-flat-list"
      class="space-y-1 rounded-2xl bg-atelier-parchment px-5 py-4 ring-1 ring-primary/10"
      aria-label="Shopping list"
    >
      <li
        v-for="line in lines"
        :key="line.id"
        :data-testid="effectiveChangedIds.has(line.id) ? 'diff-changed' : undefined"
        class="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-atelier-entry-hover motion-reduce:transition-none"
        :class="effectiveChangedIds.has(line.id) ? 'bg-atelier-chip/60 border-l-4 border-l-primary' : ''"
      >
        <input
          v-if="!readonly"
          type="checkbox"
          class="size-4 shrink-0 rounded border-outline-variant/40 accent-primary print:hidden"
          :aria-label="`Check off ${line.name}`"
        >
        <span
          v-if="effectiveChangedIds.has(line.id)"
          class="material-symbols-outlined text-[16px] text-primary print:hidden"
          aria-hidden="true"
        >auto_fix_high</span>
        <span class="flex-1 text-sm text-atelier-heading">
          {{ formatMergedLine(line) }}
        </span>
      </li>
    </ul>

    <details
      v-for="(group, groupIndex) in aisleGroups"
      :key="`${group.category}-${groupIndex}`"
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
            class="size-4 shrink-0 rounded border-outline-variant/40 accent-primary print:hidden"
            :aria-label="`Check off ${line.name}`"
          >
          <span
            v-if="effectiveChangedIds.has(line.id)"
            class="material-symbols-outlined text-[16px] text-primary print:hidden"
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
