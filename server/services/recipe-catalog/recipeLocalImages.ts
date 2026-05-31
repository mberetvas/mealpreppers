import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { H3Event } from 'h3'
import { createError, getRequestURL } from 'h3'
import { resolveRecipeImagesDir } from '../../db/paths'

const SAFE_FILENAME = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i

/** Persists validated recipe image bytes and returns the public loopback URL. */
export async function saveRecipeImageFile(
  event: H3Event,
  filename: string,
  bytes: Buffer,
): Promise<string> {
  if (!SAFE_FILENAME.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image filename.' })
  }

  const filePath = path.join(resolveRecipeImagesDir(), filename)
  await writeFile(filePath, bytes)

  const origin = getRequestURL(event).origin
  return `${origin}/recipe-images/${filename}`
}
