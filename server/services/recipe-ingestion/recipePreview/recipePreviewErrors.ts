/**
 * Domain failures for recipe URL preview; HTTP layer maps these to createError.
 */

export class RecipePreviewDomainError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.statusCode = statusCode
  }
}

export class UnsupportedRecipeSourceError extends RecipePreviewDomainError {
  constructor() {
    super('This recipe source is not supported.', 400)
  }
}

export class RecipePageFetchError extends RecipePreviewDomainError {
  constructor() {
    super('The recipe page could not be fetched.', 502)
  }
}

export class RecipePublisherAuthWallError extends RecipePreviewDomainError {
  constructor(
    readonly diagnostics: { requestedUrl: string; finalUrl: string; status: number },
  ) {
    super(
      'The publisher returned a login page instead of the recipe. This importer only reads pages that are available without an account. Open the recipe in a private window: if it asks you to sign in, use manual entry or another source.',
      422,
    )
  }
}

/** Playwright/Chromium fetch failed; HTTP layer maps to 502. */
export class RecipeBrowserAutomationError extends RecipePreviewDomainError {
  constructor(
    message: string,
    readonly timedOut: boolean,
  ) {
    super(message, 502)
  }
}
