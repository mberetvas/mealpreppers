<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isDesktopShell } from '../../utils/desktopRuntime'
import {
  buildAiPolishUnavailableMessage,
  useNetworkFeatureState,
} from '~/composables/useNetworkFeatureState'
import {
  invokeDesktopCommand,
  normalizeOpenRouterKeyInput,
  OPENROUTER_SETTINGS_URL,
  openExternalUrl,
} from '~/utils/tauriDesktop'

const isDesktop = isDesktopShell()

const {
  isOnline,
  hasOpenRouterKey,
  openRouterKeyHint,
  offline,
  missingApiKey,
  onlineReady,
  refreshOpenRouterKeyState,
} = useNetworkFeatureState()

const apiKeyInput = ref('')
const openrouterShoppingListModel = ref('')
const savedModel = ref('')
const appVersion = ref('')
const dataDir = ref('')
const statusMessage = ref('')
const errorMessage = ref('')
const saving = ref(false)
const clearing = ref(false)
const savingModel = ref(false)
const loadingMeta = ref(true)
const loadingSettings = ref(true)

const keyPlaceholder = computed(() =>
  hasOpenRouterKey.value ? 'Key saved — enter a new key to replace' : 'sk-or-...',
)

const aiStatusSummary = computed(() => {
  if (onlineReady.value) {
    return 'Shopping list AI polish is ready.'
  }
  return buildAiPolishUnavailableMessage(offline.value, missingApiKey.value)
})

const apiKeyStatusLabel = computed(() =>
  hasOpenRouterKey.value ? 'Saved in keychain' : 'Not set',
)

const apiKeyStatusBadgeClasses = computed(() =>
  hasOpenRouterKey.value
    ? 'bg-atelier-mint-success text-atelier-success-foreground'
    : 'bg-atelier-chip text-atelier-neutral-action',
)

const internetStatusLabel = computed(() =>
  isOnline.value ? 'Online' : 'Offline',
)

const internetStatusBadgeClasses = computed(() =>
  isOnline.value
    ? 'bg-atelier-mint-success text-atelier-success-foreground'
    : 'bg-atelier-cream-warning text-atelier-warning-foreground',
)

async function loadInstallSettings(): Promise<void> {
  loadingSettings.value = true
  try {
    const settings = await $fetch<{ openrouterShoppingListModel: string }>('/api/v1/settings')
    savedModel.value = settings.openrouterShoppingListModel
    openrouterShoppingListModel.value = settings.openrouterShoppingListModel
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Install settings could not be loaded.'
  }
  finally {
    loadingSettings.value = false
  }
}

async function loadSettingsMeta(): Promise<void> {
  loadingMeta.value = true
  errorMessage.value = ''

  try {
    if (isDesktop) {
      const [version, dir] = await Promise.all([
        invokeDesktopCommand<string>('get_app_version'),
        invokeDesktopCommand<string>('get_data_dir'),
      ])
      appVersion.value = version ?? '—'
      dataDir.value = dir ?? '—'
    }
    await refreshOpenRouterKeyState()
    await loadInstallSettings()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings could not be loaded.'
  }
  finally {
    loadingMeta.value = false
  }
}

async function saveApiKey(): Promise<void> {
  errorMessage.value = ''
  statusMessage.value = ''

  const normalized = normalizeOpenRouterKeyInput(apiKeyInput.value)
  if (!normalized) {
    errorMessage.value = 'Enter a valid OpenRouter API key before saving.'
    return
  }

  saving.value = true
  try {
    await invokeDesktopCommand('set_openrouter_key', { key: normalized })
    apiKeyInput.value = ''
    await refreshOpenRouterKeyState()
    if (!hasOpenRouterKey.value) {
      errorMessage.value = 'The key could not be stored in the OS keychain. Try saving again.'
      return
    }
    statusMessage.value = 'OpenRouter key saved. AI shopping-list polish is ready to use.'
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Key could not be saved.'
  }
  finally {
    saving.value = false
  }
}

async function clearApiKey(): Promise<void> {
  errorMessage.value = ''
  statusMessage.value = ''
  clearing.value = true

  try {
    await invokeDesktopCommand('clear_openrouter_key')
    apiKeyInput.value = ''
    await refreshOpenRouterKeyState()
    statusMessage.value = 'OpenRouter key cleared from the OS keychain.'
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Key could not be cleared.'
  }
  finally {
    clearing.value = false
  }
}

async function saveModel(): Promise<void> {
  errorMessage.value = ''
  statusMessage.value = ''
  savingModel.value = true

  try {
    const settings = await $fetch<{ openrouterShoppingListModel: string }>('/api/v1/settings', {
      method: 'PATCH',
      body: { openrouterShoppingListModel: openrouterShoppingListModel.value },
    })
    savedModel.value = settings.openrouterShoppingListModel
    openrouterShoppingListModel.value = settings.openrouterShoppingListModel
    statusMessage.value = 'Model saved. It applies on the next shopping-list consolidation.'
  }
  catch (error) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchError.data?.statusMessage
      ?? (error instanceof Error ? error.message : 'Model could not be saved.')
  }
  finally {
    savingModel.value = false
  }
}

async function revealDataFolder(): Promise<void> {
  errorMessage.value = ''
  try {
    await invokeDesktopCommand('open_data_folder')
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Data folder could not be opened.'
  }
}

onMounted(() => {
  void loadSettingsMeta()
})
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <header class="space-y-2">
      <NuxtLink
        v-if="!isDesktop"
        to="/more"
        class="inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition-colors hover:text-primary dark:text-stone-400"
      >
        <span class="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        More
      </NuxtLink>
      <h1 class="font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-400">
        Settings
      </h1>
      <p class="text-stone-600 dark:text-stone-400">
        Configure optional AI features and inspect local app data paths.
      </p>
    </header>

    <section
      v-if="!isDesktop"
      class="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      Settings for OpenRouter and app data are available in the packaged desktop app. For local web
      development, set <code class="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">OPENROUTER_API_KEY</code>
      in <code class="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">.env</code>.
    </section>

    <section class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 space-y-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
          OpenRouter / AI
        </h2>
        <p class="text-sm text-stone-600 dark:text-stone-400">
          Optional. Powers <strong>Shopping list AI polish</strong>: merges ingredients from your
          Saved Weekplan into one store-ready list, normalizes quantities, and groups items by
          supermarket aisle for Belgian stores. Requires an OpenRouter API key and internet.
          <button
            type="button"
            class="ml-1 font-medium text-primary underline-offset-2 hover:underline"
            @click="openExternalUrl(OPENROUTER_SETTINGS_URL)"
          >
            Get a key on OpenRouter
          </button>
        </p>
      </div>

      <dl class="grid gap-3 rounded-xl border border-outline-variant/15 bg-surface-container p-4 text-sm">
        <div class="flex items-center justify-between gap-4">
          <dt class="font-medium text-stone-600 dark:text-stone-400">
            API key
          </dt>
          <dd class="flex flex-col items-end gap-1">
            <span
              class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold"
              :class="apiKeyStatusBadgeClasses"
              role="status"
              aria-live="polite"
            >
              <span
                class="material-symbols-outlined text-sm"
                aria-hidden="true"
              >{{ hasOpenRouterKey ? 'key' : 'key_off' }}</span>
              {{ apiKeyStatusLabel }}
            </span>
            <span
              v-if="hasOpenRouterKey && openRouterKeyHint"
              class="font-mono text-xs text-stone-600 dark:text-stone-400"
            >
              {{ openRouterKeyHint }}
            </span>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="font-medium text-stone-600 dark:text-stone-400">
            Internet
          </dt>
          <dd>
            <span
              class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold"
              :class="internetStatusBadgeClasses"
              role="status"
            >
              {{ internetStatusLabel }}
            </span>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="font-medium text-stone-600 dark:text-stone-400">
            Model
          </dt>
          <dd class="font-mono text-xs text-stone-900 dark:text-stone-100">
            {{ loadingSettings ? '…' : savedModel }}
          </dd>
        </div>
        <div class="border-t border-outline-variant/15 pt-3 text-stone-700 dark:text-stone-300">
          {{ aiStatusSummary }}
        </div>
      </dl>

      <template v-if="isDesktop">
        <p
          v-if="hasOpenRouterKey"
          class="text-sm text-stone-600 dark:text-stone-400"
        >
          A key is stored securely in the OS keychain
          <span v-if="openRouterKeyHint" class="font-mono text-stone-800 dark:text-stone-200">({{ openRouterKeyHint }})</span>.
          Enter a new key below to replace it.
        </p>
        <p
          v-else
          class="text-sm text-stone-600 dark:text-stone-400"
        >
          No key is stored yet. Paste your OpenRouter key below.
        </p>

        <label class="grid gap-2 text-sm font-medium text-stone-800 dark:text-stone-200">
          {{ hasOpenRouterKey ? 'Replace API key' : 'API key' }}
          <input
            v-model="apiKeyInput"
            type="password"
            autocomplete="off"
            class="design-input font-mono text-sm"
            :placeholder="keyPlaceholder"
          >
        </label>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            :disabled="saving || clearing"
            @click="saveApiKey"
          >
            {{ saving ? 'Saving…' : 'Save key' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800"
            :disabled="saving || clearing || !hasOpenRouterKey"
            @click="clearApiKey"
          >
            {{ clearing ? 'Clearing…' : 'Clear key' }}
          </button>
        </div>
      </template>

      <label class="grid gap-2 text-sm font-medium text-stone-800 dark:text-stone-200">
        OpenRouter model
        <input
          v-model="openrouterShoppingListModel"
          type="text"
          autocomplete="off"
          class="design-input font-mono text-sm"
          placeholder="deepseek/deepseek-v4-flash"
          :disabled="loadingSettings || savingModel"
        >
      </label>

      <button
        type="button"
        class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        :disabled="loadingSettings || savingModel"
        @click="saveModel"
      >
        {{ savingModel ? 'Saving…' : 'Save model' }}
      </button>
    </section>

    <section
      v-if="isDesktop"
      class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 space-y-4"
    >
      <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
        App info
      </h2>

      <dl class="grid gap-4 text-sm">
        <div class="grid gap-1">
          <dt class="font-medium text-stone-500 dark:text-stone-400">
            Version
          </dt>
          <dd class="font-mono text-stone-900 dark:text-stone-100">
            {{ loadingMeta ? '…' : appVersion }}
          </dd>
        </div>
        <div class="grid gap-1">
          <dt class="font-medium text-stone-500 dark:text-stone-400">
            Data directory
          </dt>
          <dd class="break-all font-mono text-xs text-stone-800 dark:text-stone-200">
            {{ loadingMeta ? '…' : dataDir }}
          </dd>
          <dd class="text-xs text-stone-500 dark:text-stone-400">
            Contains <code class="rounded bg-black/5 px-1 dark:bg-white/10">mealprepper.db</code> and
            <code class="rounded bg-black/5 px-1 dark:bg-white/10">recipe-images/</code>.
          </dd>
        </div>
      </dl>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
        :disabled="loadingMeta"
        @click="revealDataFolder"
      >
        <span class="material-symbols-outlined text-base" aria-hidden="true">folder_open</span>
        Open data folder
      </button>
    </section>

    <FormFlowStatusSurfaces
      :error-message="errorMessage"
      :success-message="statusMessage"
    />
  </div>
</template>
