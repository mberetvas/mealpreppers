export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    const { closeLibellePlaywrightBrowser } = await import(
      '../services/recipe-ingestion/fetchLibelleRecipePagePlaywright'
    )
    await closeLibellePlaywrightBrowser()
  })
})
