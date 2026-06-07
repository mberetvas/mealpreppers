import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { sendStream } from 'h3'
import { resolveRecipeImagesDir } from '../../db/paths'

const SAFE_FILENAME = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export default defineEventHandler((event) => {
  const filename = getRouterParam(event, 'filename')?.trim()
  if (!filename || !SAFE_FILENAME.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image filename.' })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const type = MIME_BY_EXT[ext]
  if (!type) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported image type.' })
  }

  const filePath = path.join(resolveRecipeImagesDir(), filename)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  }

  setHeader(event, 'Content-Type', type)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return sendStream(event, createReadStream(filePath))
})
