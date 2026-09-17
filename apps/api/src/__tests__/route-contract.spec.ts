import { describe, expect, it } from 'vitest'
import { app } from '../app'

const routes = [
  'GET /api/auth/get-session', 'POST /api/auth/sign-in/email', 'POST /api/auth/sign-out',
  'GET /files', 'DELETE /files/object', 'GET /files/object', 'POST /files/presigned-url',
  'GET /health', 'GET /me', 'GET /openapi.json',
  'GET /permissions/detail/{id}', 'GET /permissions/list',
  'POST /roles/create', 'DELETE /roles/delete/{id}', 'GET /roles/detail/{id}', 'GET /roles/list', 'PATCH /roles/update/{id}',
  'GET /roles/{roleId}/permissions', 'DELETE /roles/{roleId}/permissions/{permissionId}', 'PUT /roles/{roleId}/permissions/{permissionId}',
  'POST /users/create', 'GET /users/detail/{id}', 'GET /users/list', 'PATCH /users/update/{id}',
  'GET /users/{userId}/role-assignments', 'DELETE /users/{userId}/role-assignments/{roleId}', 'PUT /users/{userId}/role-assignments/{roleId}',
  'POST /vendors/register', 'GET /vendors/verify', 'POST /vendors/resend-verification',
  'GET /vendors/mine', 'PATCH /vendors/mine', 'POST /vendors/mine/submit',
  'POST /vendors/mine/contacts', 'PATCH /vendors/mine/contacts/{contactId}', 'DELETE /vendors/mine/contacts/{contactId}',
  'GET /vendors/mine/classifications', 'PUT /vendors/mine/classifications',
  'PUT /vendors/mine/documents/{requirementId}', 'DELETE /vendors/mine/documents/{requirementId}',
  'PUT /vendors/mine/bim',
  'GET /vendors/classifications/list', 'GET /vendors/classifications/detail/{id}', 'GET /vendors/divisions/list',
  'GET /vendors/list', 'GET /vendors/detail/{id}', 'POST /vendors/review/{id}',
  'GET /vendors/contacts/list',
].sort()

describe('HTTP route contract', () => {
  it('keeps the method and path set', async () => {
    const response = await app.request('/openapi.json')
    expect(response.status).toBe(200)
    const document = await response.json() as { paths: Record<string, Record<string, unknown>> }
    const actual = Object.entries(document.paths).flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`)).sort()
    expect(actual).toEqual(routes)
  })

  it('keeps public and authenticated access', async () => {
    expect((await app.request('/health')).status).toBe(200)
    expect((await app.request('/openapi.json')).status).toBe(200)
    for (const path of ['/me', '/files', '/users/list', '/roles/list', '/permissions/list']) {
      expect((await app.request(path)).status).toBe(401)
    }
  })
})
