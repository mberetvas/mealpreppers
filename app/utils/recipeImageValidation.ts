/** Limits for manual recipe image uploads (aligned with storage bucket). */
export const RECIPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const RECIPE_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * Validates MIME type and size before uploading to storage.
 * Returns a stable English message suitable for API responses.
 */
export function validateRecipeImageFile(
  mimeType: string,
  byteLength: number,
): { ok: true } | { ok: false; statusMessage: string } {
  if (byteLength <= 0) {
    return { ok: false, statusMessage: 'Image file is empty.' }
  }

  if (byteLength > RECIPE_IMAGE_MAX_BYTES) {
    return { ok: false, statusMessage: `Image must be at most ${RECIPE_IMAGE_MAX_BYTES / (1024 * 1024)}MB.` }
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false, statusMessage: 'Use a JPEG, PNG, WebP, or GIF image.' }
  }

  return { ok: true }
}
