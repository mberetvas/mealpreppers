<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAccessibleOverlayInteraction } from '~/composables/useAccessibleOverlayInteraction'
import { usePlanningSupabaseAccessToken } from '~/composables/usePlanningSupabaseAccessToken'

const HANDOFF_DEFER_KEY = 'mp_anon_saved_weekplans_handoff_defer'

const accessToken = usePlanningSupabaseAccessToken()
const overlayRootRef = ref<HTMLElement | null>(null)
const pendingCount = ref(0)
const dialogOpen = ref(false)
const busy = ref(false)
const errorMessage = ref<string | null>(null)

const dialogVisible = computed(() => (dialogOpen.value && pendingCount.value > 0) || busy.value)

watch(
  () => accessToken.value,
  async (t) => {
    if (!import.meta.client) return
    if (!t) {
      dialogOpen.value = false
      pendingCount.value = 0
      errorMessage.value = null
      return
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(HANDOFF_DEFER_KEY) === '1') return
    errorMessage.value = null
    try {
      const res = await $fetch<{ count: number }>('/api/v1/saved-weekplans/anonymous-merge-preview', {
        headers: { Authorization: `Bearer ${t}` },
        credentials: 'include',
      })
      pendingCount.value = res.count
      dialogOpen.value = res.count > 0
    }
    catch {
      pendingCount.value = 0
      dialogOpen.value = false
    }
  },
  { immediate: true },
)

useAccessibleOverlayInteraction({
  open: dialogVisible,
  scopeRef: overlayRootRef,
  lockBackground: true,
  onRequestClose: () => { if (!busy.value) deferDecision() },
  getInitialFocus: () => overlayRootRef.value?.querySelector<HTMLElement>('button:not([disabled])') ?? null,
})

function deferDecision(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(HANDOFF_DEFER_KEY, '1')
  dialogOpen.value = false
}

async function runHandoff(action: 'move' | 'discard'): Promise<void> {
  const t = accessToken.value
  if (!t || busy.value) return
  busy.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/v1/saved-weekplans/anonymous-merge', {
      method: 'POST',
      body: { action },
      headers: { Authorization: `Bearer ${t}` },
      credentials: 'include',
    })
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(HANDOFF_DEFER_KEY)
    pendingCount.value = 0
    dialogOpen.value = false
  }
  catch (e: unknown) {
    let msg = 'Something went wrong. Try again.'
    if (e && typeof e === 'object' && 'statusMessage' in e && typeof (e as { statusMessage?: string }).statusMessage === 'string') {
      msg = (e as { statusMessage: string }).statusMessage
    }
    errorMessage.value = msg
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dialogVisible"
      class="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none sm:items-center"
      role="presentation"
      @click.self="busy ? undefined : deferDecision()"
    >
      <div
        ref="overlayRootRef"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="anon-weekplan-handoff-title"
        aria-describedby="anon-weekplan-handoff-desc"
        class="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-atelier-panel ring-1 ring-primary/15"
        @click.stop
      >
        <h2 id="anon-weekplan-handoff-title" class="font-headline text-lg font-bold text-atelier-heading">
          Save your week plans?
        </h2>
        <p id="anon-weekplan-handoff-desc" class="mt-2 text-sm text-atelier-description">
          You have {{ pendingCount }} Saved Weekplan{{ pendingCount === 1 ? '' : 's' }} from before you signed in.
          Move them to your account, or discard them permanently.
        </p>
        <p
          v-if="errorMessage"
          class="mt-3 rounded-xl bg-atelier-cream-error px-3 py-2 text-sm text-atelier-error-foreground"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-chip px-5 text-sm font-bold text-atelier-heading transition hover:bg-atelier-chip-hover disabled:opacity-50"
            :disabled="busy"
            @click="deferDecision"
          >
            Decide later
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-outline-variant/50 px-5 text-sm font-bold text-atelier-heading transition hover:bg-surface-container-low disabled:opacity-50"
            :disabled="busy"
            @click="() => runHandoff('discard')"
          >
            Discard
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover disabled:opacity-50"
            :disabled="busy"
            @click="() => runHandoff('move')"
          >
            Move to my account
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
