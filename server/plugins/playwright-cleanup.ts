import { closeLibellePlaywrightBrowser } from '../services/recipe-ingestion/fetchLibelleRecipePagePlaywright'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await closeLibellePlaywrightBrowser()
  })
})
