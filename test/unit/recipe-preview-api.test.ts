import { describe, expect, it } from 'vitest'
import { createError, createEvent, eventHandler, readBody, toNodeListener } from 'h3'
import { createApp } from 'h3'
import { recipePreviewRequestSchema } from '../../types/recipe-preview.schema'

/**
 * Minimal reproduction of the preview handler's validation logic,
 * tested without the full Nuxt build (avoids the MagicString/vite-node
 * interop bug tracked in nuxt/nuxt#34645).
 */
const previewHandler = eventHandler(async (event) => {
  const parsedBody = recipePreviewRequestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe preview request.', data: parsedBody.error.flatten() })
  }
  return { ok: true }
})

function createTestApp() {
  const app = createApp()
  app.use('/api/v1/recipes/preview', previewHandler)
  return toNodeListener(app)
}

describe('recipe preview API handler', () => {
  it('returns 400 for invalid preview request body', async () => {
    const listener = createTestApp()

    const body = JSON.stringify({ url: 'not-a-valid-url' })
    const response = await callListener(listener, {
      method: 'POST',
      url: '/api/v1/recipes/preview',
      headers: { 'content-type': 'application/json' },
      body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when url is missing', async () => {
    const listener = createTestApp()

    const body = JSON.stringify({})
    const response = await callListener(listener, {
      method: 'POST',
      url: '/api/v1/recipes/preview',
      headers: { 'content-type': 'application/json' },
      body,
    })

    expect(response.statusCode).toBe(400)
  })
})

/** Invokes an h3 node listener with a minimal mock request. */
function callListener(
  listener: ReturnType<typeof toNodeListener>,
  opts: { method: string, url: string, headers: Record<string, string>, body: string },
): Promise<{ statusCode: number, body: string }> {
  const { Readable } = require('stream')
  const { ServerResponse, IncomingMessage } = require('http')

  return new Promise((resolve) => {
    const req = new Readable() as InstanceType<typeof IncomingMessage>
    req.push(opts.body)
    req.push(null)
    Object.assign(req, {
      method: opts.method,
      url: opts.url,
      headers: { ...opts.headers, 'content-length': String(Buffer.byteLength(opts.body)) },
    })

    const res = new ServerResponse(req)
    const chunks: Buffer[] = []
    const originalWrite = res.write.bind(res)
    const originalEnd = res.end.bind(res)

    res.write = ((chunk: any) => {
      chunks.push(Buffer.from(chunk))
      return originalWrite(chunk)
    }) as any

    res.end = ((chunk?: any) => {
      if (chunk) chunks.push(Buffer.from(chunk))
      resolve({
        statusCode: res.statusCode,
        body: Buffer.concat(chunks).toString(),
      })
      return originalEnd(chunk)
    }) as any

    listener(req as any, res)
  })
}
