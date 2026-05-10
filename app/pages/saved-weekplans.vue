<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { SavedWeekplanListItem } from '~~/utils/savedWeekplansListSort'
import { sortSavedWeekplanListItems } from '~~/utils/savedWeekplansListSort'

useHead({ title: 'Manage plans' })

type SortMode = 'updated' | 'name'

const sortMode = ref<SortMode>('updated')

const { data: rawList, pending, error, refresh } = await useFetch<SavedWeekplanListItem[]>(
  '/api/v1/saved-weekplans',
  { default: () => [] },
)

const sortedList = computed(() =>
  sortSavedWeekplanListItems(rawList.value ?? [], sortMode.value),
)

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameBusy = ref(false)
const renameError = ref<string | null>(null)

watch(renamingId, async (id) => {
  if (!id) return
  await nextTick()
  const el = document.getElementById(`rename-${id}`) as HTMLInputElement | null
  el?.focus()
  el?.select()
})

function startRename(item: SavedWeekplanListItem): void {
  renamingId.value = item.id
  renameDraft.value = item.name
  renameError.value = null
  renameBusy.value = false
}

function cancelRename(): void {
  renamingId.value = null
  renameDraft.value = ''
  renameError.value = null
}

async function commitRename(id: string): Promise<void> {
  const item = rawList.value?.find(i => i.id === id)
  const next = renameDraft.value.trim()
  if (!next || (item && next === item.name)) {
    cancelRename()
    return
  }
  if (renameBusy.value) return
  renameBusy.value = true
  try {
    await $fetch(`/api/v1/saved-weekplans/${id}`, { method: 'PATCH', body: { name: next } })
    await refresh()
    cancelRename()
  }
  catch {
    renameError.value = 'Rename failed. Try again.'
  }
  finally {
    renameBusy.value = false
  }
}

function onRenameKeydown(id: string, e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelRename()
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void commitRename(id)
  }
}

const deleteTarget = ref<{ id: string, name: string } | null>(null)
const deleteOverlayRef = ref<HTMLElement | null>(null)
const deleteRestoreFocus = ref<HTMLElement | null>(null)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)
const deleteDialogOpen = computed(() => deleteTarget.value !== null)

function requestDelete(item: SavedWeekplanListItem, invoker?: HTMLElement | null): void {
  deleteRestoreFocus.value = invoker ?? (document.activeElement as HTMLElement | null)
  deleteTarget.value = { id: item.id, name: item.name }
}

function cancelDelete(): void {
  deleteTarget.value = null
  deleteError.value = null
}

useAccessibleOverlayInteraction({
  open: deleteDialogOpen,
  scopeRef: deleteOverlayRef,
  restoreFocusRef: deleteRestoreFocus,
  lockBackground: true,
  onRequestClose: cancelDelete,
})

async function confirmDelete(): Promise<void> {
  const t = deleteTarget.value
  if (!t || deleteBusy.value) return
  deleteBusy.value = true
  try {
    await $fetch(`/api/v1/saved-weekplans/${t.id}`, { method: 'DELETE' })
    cancelDelete()
    await refresh()
  }
  catch {
    deleteError.value = 'Could not delete. Try again.'
  }
  finally {
    deleteBusy.value = false
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

const hasPlans = computed(() => (rawList.value?.length ?? 0) > 0)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="space-y-2">
        <h1 class="font-headline text-3xl font-bold text-atelier-heading md:text-4xl">
          Manage plans
        </h1>
        <p class="max-w-xl text-sm text-atelier-description md:text-base">
          Your <strong>Saved Weekplans</strong> live here. Open one to keep editing in the weekly planner. A <strong>draft</strong> stays in your browser until you save; a <strong>Saved Weekplan</strong> is stored on the server for this session or account.
        </p>
      </div>

      <div
        v-if="hasPlans"
        class="flex shrink-0 rounded-full bg-atelier-chip/80 p-1 ring-1 ring-primary/10"
        role="group"
        aria-label="Sort Saved Weekplans"
      >
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none"
          :class="sortMode === 'updated'
            ? 'bg-primary text-on-primary shadow-atelier-primary-btn'
            : 'text-atelier-neutral-action hover:text-atelier-heading'"
          :aria-pressed="sortMode === 'updated'"
          @click="sortMode = 'updated'"
        >
          Updated
        </button>
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none"
          :class="sortMode === 'name'
            ? 'bg-primary text-on-primary shadow-atelier-primary-btn'
            : 'text-atelier-neutral-action hover:text-atelier-heading'"
          :aria-pressed="sortMode === 'name'"
          @click="sortMode = 'name'"
        >
          Name
        </button>
      </div>
    </header>

    <section v-if="pending" class="space-y-3" aria-busy="true" aria-label="Loading Saved Weekplans">
      <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-2xl bg-atelier-parchment ring-1 ring-primary/10 motion-reduce:animate-none" />
    </section>

    <section
      v-else-if="error"
      class="rounded-2xl bg-atelier-cream-error p-6 text-atelier-error-foreground shadow-atelier-status-error"
    >
      <p class="font-semibold">
        Saved Weekplans could not be loaded.
      </p>
      <button
        type="button"
        class="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-error-foreground px-5 text-sm font-bold text-on-primary"
        @click="() => refresh()"
      >
        Retry
      </button>
    </section>

    <section
      v-else-if="!hasPlans"
      class="rounded-[28px] bg-atelier-parchment p-8 text-center shadow-atelier-float ring-1 ring-primary/10"
    >
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-atelier-chip text-primary">
        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">calendar_month</span>
      </div>
      <h2 class="mt-5 font-['Newsreader'] text-2xl font-semibold text-atelier-heading md:text-3xl">
        No Saved Weekplans yet
      </h2>
      <p class="mx-auto mt-3 max-w-md text-sm text-atelier-description">
        A <strong>draft</strong> is a week you are shaping before anything is stored. When you save from the planner, it becomes a <strong>Saved Weekplan</strong> and appears here.
      </p>
      <NuxtLink
        to="/weekly-plan"
        class="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit_calendar</span>
        Create a week plan
      </NuxtLink>
    </section>

    <ul v-else class="space-y-4" aria-label="Saved Weekplans">
      <li
        v-for="item in sortedList"
        :key="item.id"
        class="flex flex-col gap-4 rounded-2xl bg-atelier-parchment p-5 shadow-atelier-float ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <div v-if="renamingId === item.id" class="flex flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <input
                :id="`rename-${item.id}`"
                v-model="renameDraft"
                type="text"
                class="min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-base font-semibold text-atelier-heading focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                :aria-label="`Rename Saved Weekplan ${item.name}`"
                @keydown="onRenameKeydown(item.id, $event)"
                @blur="() => commitRename(item.id)"
              >
            </div>
            <p v-if="renameError" role="alert" class="text-sm text-atelier-error-foreground">
              {{ renameError }}
            </p>
          </div>
          <button
            v-else
            type="button"
            class="block w-full text-left"
            @click="startRename(item)"
          >
            <span class="font-['Newsreader'] text-xl font-semibold text-atelier-heading hover:text-primary md:text-2xl">
              {{ item.name }}
            </span>
            <span class="mt-1 block text-xs text-atelier-meta">Click to rename</span>
          </button>
          <p class="mt-2 text-sm text-atelier-description">
            Updated {{ formatUpdatedAt(item.updatedAt) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-atelier-neutral-action transition hover:bg-atelier-chip hover:text-atelier-heading"
            aria-label="Rename Saved Weekplan"
            @click="startRename(item)"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">edit</span>
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-atelier-neutral-action transition hover:bg-error-container hover:text-atelier-error-foreground"
            aria-label="Delete Saved Weekplan"
            @click="requestDelete(item, $event.currentTarget as HTMLElement)"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">delete</span>
          </button>
          <NuxtLink
            :to="{ path: '/weekly-plan', query: { template: item.id } }"
            class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-on-primary shadow-atelier-primary-btn transition hover:bg-atelier-primary-hover motion-reduce:transition-none"
          >
            Open
          </NuxtLink>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
        aria-modal="true"
        role="presentation"
        @click.self="cancelDelete"
      >
        <div
          ref="deleteOverlayRef"
          role="alertdialog"
          aria-labelledby="saved-weekplan-delete-heading"
          aria-describedby="saved-weekplan-delete-desc"
          class="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-atelier-panel ring-1 ring-primary/15"
          @click.stop
        >
          <h2 id="saved-weekplan-delete-heading" class="font-headline text-lg font-bold text-atelier-heading">
            Delete Saved Weekplan?
          </h2>
          <p id="saved-weekplan-delete-desc" class="mt-2 text-sm text-atelier-description">
            “{{ deleteTarget.name }}” will be removed. This cannot be undone.
          </p>
          <p v-if="deleteError" role="alert" class="mt-2 text-sm font-semibold text-atelier-error-foreground">
            {{ deleteError }}
          </p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-chip px-5 text-sm font-bold text-atelier-heading transition hover:bg-atelier-chip-hover"
              @click="cancelDelete"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-atelier-error-foreground px-5 text-sm font-bold text-on-primary shadow-atelier-status-error transition hover:brightness-95 disabled:opacity-50"
              :disabled="deleteBusy"
              @click="confirmDelete"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
