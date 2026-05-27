<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import type { PolishHint } from '~~/server/services/shopping-list/polishHintBuilder'
import type { ShoppingListSection } from '~~/utils/shoppingList'
import { formatShoppingListIngredient } from '~~/utils/shoppingList'
import ShoppingListAisleSection from '~/components/shopping-list/AisleSection.vue'

const props = withDefaults(defineProps<{
  reviewLines: MergedLine[]
  hints: PolishHint[]
  sections: ShoppingListSection[]
  saving?: boolean
  /**
   * When true, the reference panel shows reviewLines grouped by aisle
   * (using ShoppingListAisleSection, readonly) instead of recipe sections.
   */
  showAisleGroups?: boolean
}>(), {
  saving: false,
  showAisleGroups: false,
})

const emit = defineEmits<{
  'update-line': [lineId: string, fields: Partial<Pick<MergedLine, 'name' | 'quantity' | 'unit'>>]
  'confirm': []
}>()

const acknowledgedHintIds = ref<Set<string>>(new Set())

/** Hints grouped by line ID for inline display. */
const hintsByLine = computed(() => {
  const map = new Map<string, PolishHint[]>()
  for (const hint of props.hints) {
    if (!map.has(hint.lineId)) map.set(hint.lineId, [])
    map.get(hint.lineId)!.push(hint)
  }
  return map
})

function hintKey(hint: PolishHint): string {
  return `${hint.lineId}:${hint.rule}`
}

function acknowledgeHint(hint: PolishHint): void {
  acknowledgedHintIds.value = new Set([...acknowledgedHintIds.value, hintKey(hint)])
}

function handleConfirm(): void {
  if (props.saving) return
  emit('confirm')
}
</script>

<template>
  <div
    data-testid="polish-review"
    class="grid gap-6 lg:grid-cols-2"
  >
    <!-- Reference panel: aisle-grouped view or recipe sections depending on prop -->
    <section
      data-testid="review-reference"
      class="space-y-4 rounded-2xl bg-atelier-parchment p-4 ring-1 ring-primary/10"
    >
      <h3 class="text-sm font-semibold text-atelier-heading">
        {{ showAisleGroups ? 'Grouped by aisle' : 'Recipe sections' }}
      </h3>

      <ShoppingListAisleSection
        v-if="showAisleGroups"
        :lines="reviewLines"
        :readonly="true"
        data-testid="ref-aisle-groups"
      />

      <ul v-else data-testid="ref-sections" class="space-y-3" aria-label="Reference: recipe sections">
        <li v-for="section in sections" :key="section.recipeId" class="space-y-1">
          <p class="text-sm font-semibold text-atelier-heading">{{ section.recipeTitle }}</p>
          <ul class="space-y-0.5 pl-3">
            <li v-for="(ing, idx) in section.ingredients" :key="idx" class="text-xs text-atelier-description">
              {{ formatShoppingListIngredient(ing) }}
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <!-- Editable AI column -->
    <section class="space-y-4">
      <h3 class="text-sm font-semibold text-atelier-heading">
        AI-suggested list (editable)
      </h3>

      <ul data-testid="review-lines" class="space-y-3" aria-label="Editable review lines">
        <li
          v-for="line in reviewLines"
          :key="line.id"
          class="space-y-1 rounded-xl bg-atelier-parchment p-3 ring-1 ring-primary/10"
        >
          <div class="flex flex-wrap items-center gap-2">
            <input
              :data-testid="`edit-name-${line.id}`"
              type="text"
              :value="line.name"
              class="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-white px-2 py-1 text-sm text-atelier-heading"
              aria-label="Ingredient name"
              @input="emit('update-line', line.id, { name: ($event.target as HTMLInputElement).value })"
            >
            <input
              :data-testid="`edit-qty-${line.id}`"
              type="number"
              :value="line.quantity"
              class="w-20 rounded-lg border border-outline-variant/40 bg-white px-2 py-1 text-sm text-atelier-heading"
              aria-label="Quantity"
              @input="emit('update-line', line.id, { quantity: Number(($event.target as HTMLInputElement).value) || undefined })"
            >
            <input
              :data-testid="`edit-unit-${line.id}`"
              type="text"
              :value="line.unit"
              class="w-16 rounded-lg border border-outline-variant/40 bg-white px-2 py-1 text-sm text-atelier-heading"
              aria-label="Unit"
              @input="emit('update-line', line.id, { unit: ($event.target as HTMLInputElement).value || undefined })"
            >
          </div>

          <div v-if="hintsByLine.get(line.id)" class="space-y-1 pt-1">
            <div
              v-for="hint in hintsByLine.get(line.id)"
              :key="hintKey(hint)"
              :data-testid="`hint-${hint.severity}`"
              class="flex items-start gap-2 rounded-lg px-2 py-1 text-xs"
              :class="hint.severity === 'error' ? 'bg-error-container/30 text-error' : 'bg-atelier-chip/50 text-atelier-description'"
            >
              <span class="material-symbols-outlined text-[14px]" aria-hidden="true">
                {{ hint.severity === 'error' ? 'error' : 'info' }}
              </span>
              <span class="flex-1">{{ hint.message }}</span>
              <button
                v-if="hint.severity === 'error' && !acknowledgedHintIds.has(hintKey(hint))"
                type="button"
                data-testid="acknowledge-hint"
                class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-error underline hover:bg-error-container/50"
                @click="acknowledgeHint(hint)"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </li>
      </ul>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          data-testid="confirm-review"
          class="inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          :disabled="saving"
          :aria-busy="saving"
          @click="handleConfirm"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">check</span>
          {{ saving ? 'Saving…' : 'Approve' }}
        </button>
      </div>
    </section>
  </div>
</template>
