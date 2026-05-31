<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isDesktopShell } from '../../utils/desktopRuntime'
import {
  invokeDesktopCommand,
  normalizeOpenRouterKeyInput,
  OPENROUTER_SETTINGS_URL,
  openExternalUrl,
} from '~/utils/tauriDesktop'

const isDesktop = isDesktopShell()

const apiKeyInput = ref('')
const keyConfigured = ref(false)
const appVersion = ref('')
const dataDir = ref('')
const statusMessage = ref('')
const errorMessage = ref('')
const saving = ref(false)
const clearing = ref(false)
const loadingMeta = ref(true)

const keyPlaceholder = computed(() =>
  keyConfigured.value ? 'Key saved — enter a new key to replace' : 'sk-or-...',
)

async function loadSettingsMeta(): Promise<void> {
  if (!isDesktop) {
    loadingMeta.value = false
    return
  }

  loadingMeta.value = true
  errorMessage.value = ''

  try {
    const [version, dir, hasKey] = await Promise.all([
      invokeDesktopCommand<string>('get_app_version'),
      invokeDesktopCommand<string>('get_data_dir'),
      invokeDesktopCommand<boolean>('has_openrouter_key'),
    ])

    appVersion.value = version ?? '—'
    dataDir.value = dir ?? '—'
    keyConfigured.value = hasKey === true
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
    keyConfigured.value = true
    statusMessage.value = 'OpenRouter key saved. Restart the app for AI polish to use the new key.'
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
    keyConfigured.value = false
    statusMessage.value = 'OpenRouter key cleared from the OS keychain.'
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Key could not be cleared.'
  }
  finally {
    clearing.value = false
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

    <template v-else>
      <section class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 space-y-4">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
            OpenRouter API key
          </h2>
          <p class="text-sm text-stone-600 dark:text-stone-400">
            Optional. Powers AI shopping-list polish. Stored in the OS keychain — never in the app bundle.
            <button
              type="button"
              class="ml-1 font-medium text-primary underline-offset-2 hover:underline"
              @click="openExternalUrl(OPENROUTER_SETTINGS_URL)"
            >
              Get a key on OpenRouter
            </button>
          </p>
        </div>

        <label class="grid gap-2 text-sm font-medium text-stone-800 dark:text-stone-200">
          API key
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
            :disabled="saving || clearing || !keyConfigured"
            @click="clearApiKey"
          >
            {{ clearing ? 'Clearing…' : 'Clear key' }}
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 space-y-4">
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
    </template>

    <FormFlowStatusSurfaces
      :error-message="errorMessage"
      :success-message="statusMessage"
    />
  </div>
</template>
