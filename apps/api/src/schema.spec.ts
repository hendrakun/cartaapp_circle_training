import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { selectionQuery, selectionValues, storedAssetInput, storedAssetSchema, uploadKey } from './schema'

describe('uploadKey', () => {
  it('accepts uploaded object keys with or without an extension', () => {
    expect(uploadKey.parse('uploads/photo-1.jpg')).toBe('uploads/photo-1.jpg')
    expect(uploadKey.parse('uploads/photo-1')).toBe('uploads/photo-1')
  })

  it('rejects URLs, bare names, nested keys, and traversal-like keys', () => {
    for (const value of ['https://files.test/photo.jpg', 'photo.jpg', 'uploads/nested/photo.jpg', 'uploads/../photo.jpg']) {
      expect(uploadKey.safeParse(value).success).toBe(false)
    }
  })
})

describe('stored asset', () => {
  const asset = {
    kind: 'file' as const,
    id: 'uploads/photo-1.jpg',
    url: 'https://api.test/files/object?key=uploads%2Fphoto-1.jpg',
    name: 'photo-1.jpg',
    mimeType: 'image/jpeg',
    size: 12,
    updatedAt: '2026-08-27T00:00:00.000Z',
    metadata: { source: 'upload' },
  }

  it('requires one strict browser-safe file object', () => {
    expect(storedAssetSchema.parse(asset)).toEqual(asset)
    expect(storedAssetSchema.safeParse({ ...asset, extra: true }).success).toBe(false)
    for (const value of [
      'uploads/photo-1.jpg',
      'https://files.test/photo.jpg',
      { ...asset, id: 'photo.jpg' },
      { ...asset, url: '/files/photo.jpg' },
      { ...asset, name: '' },
    ]) expect(storedAssetSchema.safeParse(value).success).toBe(false)
  })

  it('stores only the validated id and composes for nullable and array input', () => {
    expect(storedAssetInput.parse(asset)).toBe(asset.id)
    expect(storedAssetInput.nullable().parse(null)).toBeNull()
    expect(storedAssetInput.array().parse([asset, { ...asset, id: 'uploads/second.pdf' }])).toEqual(['uploads/photo-1.jpg', 'uploads/second.pdf'])
    expect(storedAssetInput.parse({ ...asset, name: 'client name', url: 'https://client.test/file' })).toBe(asset.id)
  })

  it('keeps an omitted patch collection omitted and accepts an explicit empty clear', () => {
    const patch = z.object({ attachments: storedAssetInput.array().optional() })
    expect(patch.parse({})).toEqual({})
    expect(patch.parse({ attachments: [] })).toEqual({ attachments: [] })
    expect(patch.parse({ attachments: [asset, { ...asset, id: 'uploads/second.pdf' }] })).toEqual({
      attachments: ['uploads/photo-1.jpg', 'uploads/second.pdf'],
    })
  })
})

describe('selection values', () => {
  const permissionSelection = z.object({
    userProjectId: z.string().trim().min(1),
    permission_name: z.string().trim().min(1),
  })

  it('keeps arbitrary item keys and strips undeclared keys', () => {
    expect(selectionValues(permissionSelection).parse([
      { userProjectId: 'project-user-1', permission_name: 'view-projects', ignored: true },
    ])).toEqual([
      { userProjectId: 'project-user-1', permission_name: 'view-projects' },
    ])
  })

  it('rejects scalar arrays', () => {
    expect(selectionValues(permissionSelection).safeParse(['project-user-1']).success).toBe(false)
  })

  it('accepts JSON and already-decoded object arrays in queries', () => {
    const query = selectionQuery(permissionSelection)
    const values = [{ userProjectId: 'project-user-1', permission_name: 'view-projects' }]

    expect(query.parse(JSON.stringify(values))).toEqual(values)
    expect(query.parse(values)).toEqual(values)
  })

  it('rejects invalid JSON and invalid item fields', () => {
    const query = selectionQuery(permissionSelection)

    expect(query.safeParse('{not-json').success).toBe(false)
    expect(query.safeParse(JSON.stringify([{ userProjectId: 'project-user-1', permission_name: 1 }])).success).toBe(false)
  })
})
