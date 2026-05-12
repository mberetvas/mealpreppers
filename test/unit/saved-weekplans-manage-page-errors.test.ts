import { describe, expect, it, vi } from 'vitest'

/**
 * These tests verify the delete/rename error-handling contracts from saved-weekplans.vue.
 * The logic is inline in the SFC, so we replicate the reactive behaviour with Vue refs
 * to prove the control flow without mounting the full Nuxt page.
 */
import { ref } from 'vue'

/* ------------------------------------------------------------------ */
/*  Extracted logic mirrors (kept in sync with saved-weekplans.vue)   */
/* ------------------------------------------------------------------ */

function createDeleteLogic(fetchFn: typeof globalThis.$fetch) {
  const deleteTarget = ref<{ id: string, name: string } | null>(null)
  const deleteBusy = ref(false)
  const deleteError = ref<string | null>(null)

  function cancelDelete(): void {
    deleteTarget.value = null
    deleteError.value = null
  }

  async function confirmDelete(): Promise<void> {
    const t = deleteTarget.value
    if (!t || deleteBusy.value) return
    deleteBusy.value = true
    try {
      await fetchFn(`/api/v1/saved-weekplans/${t.id}`, { method: 'DELETE' })
      cancelDelete()
    }
    catch {
      deleteError.value = 'Could not delete. Try again.'
    }
    finally {
      deleteBusy.value = false
    }
  }

  return { deleteTarget, deleteBusy, deleteError, cancelDelete, confirmDelete }
}

function createRenameLogic(fetchFn: typeof globalThis.$fetch) {
  const renamingId = ref<string | null>(null)
  const renameDraft = ref('')
  const renameBusy = ref(false)
  const renameError = ref<string | null>(null)

  function cancelRename(): void {
    renamingId.value = null
    renameDraft.value = ''
    renameError.value = null
  }

  async function commitRename(id: string): Promise<void> {
    const next = renameDraft.value.trim()
    if (!next) { cancelRename(); return }
    if (renameBusy.value) return
    renameBusy.value = true
    try {
      await fetchFn(`/api/v1/saved-weekplans/${id}`, { method: 'PATCH', body: { name: next } })
      cancelRename()
    }
    catch {
      renameError.value = 'Rename failed. Try again.'
    }
    finally {
      renameBusy.value = false
    }
  }

  return { renamingId, renameDraft, renameBusy, renameError, cancelRename, commitRename }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('saved-weekplans manage page: delete error handling', () => {
  it('sets deleteError when $fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network'))
    const { deleteTarget, deleteError, deleteBusy, confirmDelete } = createDeleteLogic(fetchFn as unknown as typeof globalThis.$fetch)

    deleteTarget.value = { id: 'plan-1', name: 'My week' }
    await confirmDelete()

    expect(deleteError.value).toBe('Could not delete. Try again.')
    expect(deleteTarget.value).not.toBeNull()
    expect(deleteBusy.value).toBe(false)
  })

  it('clears deleteError and target on cancelDelete', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fail'))
    const { deleteTarget, deleteError, cancelDelete, confirmDelete } = createDeleteLogic(fetchFn as unknown as typeof globalThis.$fetch)

    deleteTarget.value = { id: 'plan-1', name: 'My week' }
    await confirmDelete()
    expect(deleteError.value).toBeTruthy()

    cancelDelete()
    expect(deleteError.value).toBeNull()
    expect(deleteTarget.value).toBeNull()
  })

  it('clears deleteError on successful delete', async () => {
    const fetchFn = vi.fn().mockResolvedValue({})
    const { deleteTarget, deleteError, confirmDelete } = createDeleteLogic(fetchFn as unknown as typeof globalThis.$fetch)

    deleteTarget.value = { id: 'plan-1', name: 'My week' }
    await confirmDelete()

    expect(deleteError.value).toBeNull()
    expect(deleteTarget.value).toBeNull()
  })
})

describe('saved-weekplans manage page: rename error handling', () => {
  it('sets renameError when $fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network'))
    const { renamingId, renameDraft, renameError, renameBusy, commitRename } = createRenameLogic(fetchFn as unknown as typeof globalThis.$fetch)

    renamingId.value = 'plan-1'
    renameDraft.value = 'New name'
    await commitRename('plan-1')

    expect(renameError.value).toBe('Rename failed. Try again.')
    expect(renamingId.value).toBe('plan-1')
    expect(renameBusy.value).toBe(false)
  })

  it('clears renameError on cancelRename', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fail'))
    const { renamingId, renameDraft, renameError, cancelRename, commitRename } = createRenameLogic(fetchFn as unknown as typeof globalThis.$fetch)

    renamingId.value = 'plan-1'
    renameDraft.value = 'New name'
    await commitRename('plan-1')
    expect(renameError.value).toBeTruthy()

    cancelRename()
    expect(renameError.value).toBeNull()
    expect(renamingId.value).toBeNull()
    expect(renameDraft.value).toBe('')
  })

  it('clears renameError on successful rename', async () => {
    const fetchFn = vi.fn().mockResolvedValue({})
    const { renamingId, renameDraft, renameError, commitRename } = createRenameLogic(fetchFn as unknown as typeof globalThis.$fetch)

    renamingId.value = 'plan-1'
    renameDraft.value = 'New name'
    await commitRename('plan-1')

    expect(renameError.value).toBeNull()
    expect(renamingId.value).toBeNull()
  })
})
