import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { defineRoute } from '@southneuhof/sprindle/routes'
import { installSprindle, sprindleOnError } from '@southneuhof/sprindle/hono'
import { assetRequestContext, projectStoredAssets, publicRecord, runWithAssetRequestUrl, storedAsset, storedAssetResponse } from './assets'
import { storedAssetSchema } from '../schema'
import { z } from 'zod/v4'

const apiOrigin = 'https://api.test:3000/projects/1'

describe('stored asset contract', () => {
  it('maps an upload key with the active request origin and metadata', () => {
    const result = runWithAssetRequestUrl(apiOrigin, () => storedAsset('uploads/report.pdf', {
      size: 12,
      updatedAt: new Date('2026-08-27T00:00:00.000Z'),
      metadata: { contentType: 'application/pdf' },
    }))

    expect(result).toEqual({
      kind: 'file',
      id: 'uploads/report.pdf',
      url: 'https://api.test:3000/files/object?key=uploads%2Freport.pdf',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      size: 12,
      updatedAt: '2026-08-27T00:00:00.000Z',
      metadata: { contentType: 'application/pdf' },
    })
  })

  it('requires an active request URL and rejects a non-upload key', () => {
    expect(() => storedAsset('uploads/report.pdf')).toThrow(/active request URL/)
    expect(() => runWithAssetRequestUrl(apiOrigin, () => storedAsset('https://files.test/report.pdf'))).toThrow()
  })

  it('keeps request origins isolated across concurrent projections', async () => {
    const [first, second] = await Promise.all([
      runWithAssetRequestUrl('https://api-one.test:3000/one', async () => {
        await Promise.resolve()
        return storedAsset('uploads/one.jpg')
      }),
      runWithAssetRequestUrl('https://api-two.test:4000/two', async () => {
        await Promise.resolve()
        return storedAsset('uploads/two.jpg')
      }),
    ])

    expect(first.url).toBe('https://api-one.test:3000/files/object?key=uploads%2Fone.jpg')
    expect(second.url).toBe('https://api-two.test:4000/files/object?key=uploads%2Ftwo.jpg')
  })

  it('projects only exact upload-key strings recursively', () => {
    const canonical = runWithAssetRequestUrl(apiOrigin, () => storedAsset('uploads/already.pdf'))
    const ordinary = 'uploads-not-a-key/report.pdf'
    const external = 'https://files.test/report.pdf'
    const projected = runWithAssetRequestUrl(apiOrigin, () => projectStoredAssets({
      single: 'uploads/single.jpg',
      nested: { many: ['uploads/many.png', ordinary, external, 42] },
      canonical,
    })) as { single: unknown; nested: { many: unknown[] }; canonical: unknown }

    expect(storedAssetSchema.parse(projected.single).url).toContain('https://api.test:3000/')
    expect(storedAssetSchema.parse(projected.nested.many[0]).id).toBe('uploads/many.png')
    expect(projected.nested.many.slice(1)).toEqual([ordinary, external, 42])
    expect(projected.canonical).toBe(canonical)
  })

  it('parses a public record after recursive projection', async () => {
    const schema = z.object({ file: storedAssetSchema, files: z.array(storedAssetSchema) }).strict()
    const result = await runWithAssetRequestUrl(apiOrigin, () => publicRecord(schema, {
      file: 'uploads/one.pdf',
      files: ['uploads/two.pdf'],
    }))

    expect(result.file.id).toBe('uploads/one.pdf')
    expect(result.files[0]?.url).toBe('https://api.test:3000/files/object?key=uploads%2Ftwo.pdf')
  })

  it('projects stored IDs back to object arrays without equating client metadata', async () => {
    const readSchema = z.object({ attachments: z.array(storedAssetSchema) }).strict()
    const stored = await runWithAssetRequestUrl(apiOrigin, () => publicRecord(readSchema, {
      attachments: ['uploads/one.pdf', 'uploads/two.pdf'],
    }))

    expect(stored.attachments.map((asset) => asset.id)).toEqual(['uploads/one.pdf', 'uploads/two.pdf'])
    expect(stored.attachments[0]?.url).toBe('https://api.test:3000/files/object?key=uploads%2Fone.pdf')
    expect(stored.attachments.every((asset) => storedAssetSchema.safeParse(asset).success)).toBe(true)
  })

  it('projects nested JSON responses through the install after hook', async () => {
    const response = new Response(JSON.stringify({ data: { file: 'uploads/rtm.jpg', plain: 'hello' } }), {
      status: 201,
      headers: { 'content-type': 'application/json', 'content-length': '64' },
    })
    const projected = await runWithAssetRequestUrl(apiOrigin, () => storedAssetResponse({ response } as Parameters<typeof storedAssetResponse>[0]))

    expect(projected).toBeInstanceOf(Response)
    expect(projected?.status).toBe(201)
    expect(projected?.headers.get('content-type')).toContain('application/json')
    expect(projected?.headers.get('content-length')).toBeNull()
    await expect(projected?.json()).resolves.toEqual({
      data: {
        file: expect.objectContaining({ id: 'uploads/rtm.jpg', url: 'https://api.test:3000/files/object?key=uploads%2Frtm.jpg' }),
        plain: 'hello',
      },
    })
  })

  it('projects raw keys through the installed JSON response boundary', async () => {
    const route = defineRoute({
      authorize: [() => undefined],
      action: ({ c }) => c.json({ data: { file: 'uploads/installed.jpg', files: ['uploads/installed-a.jpg', 'hello'] } }),
    })
    const app = installSprindle(
      new Hono().onError(sprindleOnError).use('*', assetRequestContext()),
      [{ sourcePath: 'probe/+server.ts', httpPath: '/probe', parameters: [], methods: ['GET'], scopes: [], handlers: { GET: route } }] as const,
      { pipeline: { after: storedAssetResponse } },
    )

    const response = await app.request('https://api.test:3000/probe')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        file: expect.objectContaining({ id: 'uploads/installed.jpg', url: 'https://api.test:3000/files/object?key=uploads%2Finstalled.jpg' }),
        files: [expect.objectContaining({ id: 'uploads/installed-a.jpg', url: 'https://api.test:3000/files/object?key=uploads%2Finstalled-a.jpg' }), 'hello'],
      },
    })
  })
})
