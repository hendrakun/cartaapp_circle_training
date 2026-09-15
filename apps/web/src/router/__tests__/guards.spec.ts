import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineResource, resetResourceActionRegistry } from '@southneuhof/loom'
import type { WebResourceSchema } from '@southneuhof/loom'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineSchema } from '@/framework/schema'

const authState = { identity: null as null | { userId: string } }
const loadIdentitySpy = vi.hoisted(() => vi.fn())
const saveRedirectSpy = vi.fn()
const getDefaultRouteSpy = vi.fn(() => ({ name: 'dashboard' }))

vi.mock('@/framework/identity', () => ({ loadIdentity: loadIdentitySpy }))

vi.mock('@/utils/post-login-redirect', () => ({
  savePostLoginRedirect: (path: string) => saveRedirectSpy(path),
}))

vi.mock('../navigation', () => ({
  getDefaultAuthenticatedRouteLocation: () => getDefaultRouteSpy(),
}))

import { createAuthGuard, createPermissionGuard } from '../guards'

const next = (() => {}) as any
const schema = defineSchema<WebResourceSchema<{ id: string }, Record<string, never>, Record<string, never>, Record<string, never>, string>>({ identity: 'id' })

afterEach(() => resetResourceActionRegistry())

describe('createAuthGuard', () => {
  beforeEach(() => {
    authState.identity = null
    loadIdentitySpy.mockReset()
    loadIdentitySpy.mockResolvedValue(null)
    saveRedirectSpy.mockReset()
    getDefaultRouteSpy.mockClear()
    getDefaultRouteSpy.mockReturnValue({ name: 'dashboard' })
  })

  it('allows public login route without a profile', async () => {
    const guard = createAuthGuard()
    const result = await guard({ name: 'auth-login', fullPath: '/auth/login', path: '/auth/login', meta: { requiresAuth: false }, matched: [{}] } as any, {} as any, next)

    expect(result).toBe(true)
  })

  it('does not redirect authenticated login to itself without an accessible destination', async () => {
    authState.identity = { userId: 'user-1' }
    loadIdentitySpy.mockResolvedValue(authState.identity)
    getDefaultRouteSpy.mockReturnValue(null as any)
    const guard = createAuthGuard()
    const result = await guard({ name: 'auth-login', fullPath: '/auth/login', path: '/auth/login', meta: { requiresAuth: false }, matched: [{}] } as any, {} as any, next)

    expect(result).toBe(true)
  })

  it('redirects protected route without a profile and saves redirect', async () => {
    const guard = createAuthGuard()
    const result = await guard({ name: 'users', fullPath: '/settings/users?tab=roles', path: '/settings/users', meta: { requiresAuth: true }, matched: [{}] } as any, {} as any, next)

    expect(saveRedirectSpy).toHaveBeenCalledWith('/settings/users?tab=roles')
    expect(result).toEqual({ name: 'auth-login' })
  })

  it('redirects root route with a profile to first accessible route', async () => {
    authState.identity = { userId: 'user-1' }
    loadIdentitySpy.mockResolvedValue(authState.identity)
    const guard = createAuthGuard()
    const result = await guard({ name: 'root', fullPath: '/', path: '/', meta: {}, matched: [{}] } as any, {} as any, next)

    expect(getDefaultRouteSpy).toHaveBeenCalled()
    expect(result).toEqual({ name: 'dashboard' })
  })

  it('redirects unknown route without a profile to login', async () => {
    const guard = createAuthGuard()
    const result = await guard({ name: 'not-found', fullPath: '/missing', path: '/missing', meta: {}, matched: [{}] } as any, {} as any, next)

    expect(result).toBe(true)
  })

  it('allows unknown route with a profile without signing out', async () => {
    authState.identity = { userId: 'user-1' }
    loadIdentitySpy.mockResolvedValue(authState.identity)
    const guard = createAuthGuard()
    const result = await guard({ name: 'not-found', fullPath: '/missing', path: '/missing', meta: {}, matched: [{}] } as any, {} as any, next)

    expect(result).toBe(true)
  })

  it('awaits one in-flight identity load before protecting a direct URL', async () => {
    let resolve: (value: { userId: string }) => void = () => undefined
    loadIdentitySpy.mockReturnValue(
      new Promise((promiseResolve) => {
        resolve = promiseResolve
      })
    )
    const guard = createAuthGuard()
    const result = guard({ name: 'users', fullPath: '/settings/users', path: '/settings/users', meta: { requiresAuth: true }, matched: [{}] } as any, {} as any, next)

    expect(saveRedirectSpy).not.toHaveBeenCalled()
    resolve({ userId: 'user-1' })
    expect(await result).toBe(true)
  })

  it('keeps the current route when identity loading fails', async () => {
    loadIdentitySpy.mockRejectedValue(new Error('network failure'))
    const guard = createAuthGuard()

    await expect(guard({ name: 'users', fullPath: '/settings/users', path: '/settings/users', meta: { requiresAuth: true }, matched: [{}] } as any, {} as any, next)).resolves.toBe(true)
    expect(saveRedirectSpy).not.toHaveBeenCalled()
  })
})

describe('permission guard', () => {
  const allowDetail = { allows: ({ operation }: { operation: string }) => operation === 'detail' }
  const denyAll = { allows: () => false }

  beforeEach(() => {
    getDefaultRouteSpy.mockReset()
    getDefaultRouteSpy.mockReturnValue({ name: 'dashboard' })
  })

  it('uses explicit extraordinary metadata only when no resource action owns route', () => {
    const allowed = createPermissionGuard(allowDetail)({ meta: { permission: 'view-roles' } } as any, {} as any, next)
    const denied = createPermissionGuard(denyAll)({ meta: { permission: 'view-roles' } } as any, {} as any, next)

    expect(allowed).toBe(true)
    expect(denied).toEqual({ name: 'dashboard' })
    expect(getDefaultRouteSpy).toHaveBeenCalledOnce()
  })

  it('allows unregistered routes without explicit permission', () => {
    expect(createPermissionGuard(denyAll)({ meta: {} } as any, {} as any, next)).toBe(true)
  })

  it('checks a registered project create action through the access adapter', () => {
    defineResource(schema, {
      key: 'project-create-route',
      actions: {
        create: {
          run: async (input) => ({ id: 'project-created', input }),
          permission: 'create-quality-inspection',
          route: { name: 'project-create-route' },
        },
      },
    })

    expect(createPermissionGuard(denyAll)({ name: 'project-create-route', meta: {} } as any, {} as any, next)).toEqual({ name: 'dashboard' })
  })

  it('checks a registered project update action through the access adapter', () => {
    defineResource(schema, {
      key: 'project-update-route',
      actions: {
        update: {
          run: async (id, input) => ({ id: String(id), input }),
          permission: 'update-quality-inspection',
          route: { name: 'project-update-route', params: (id) => ({ id: String(id) }) },
        },
      },
    })

    expect(createPermissionGuard(denyAll)({ name: 'project-update-route', meta: {} } as any, {} as any, next)).toEqual({ name: 'dashboard' })
  })

  it('still rejects denied browser access for a registered system create action', () => {
    defineResource(schema, {
      key: 'system-create-route',
      actions: {
        create: {
          run: async (input) => ({ id: 'system-created', input }),
          permission: 'create-users',
          route: { name: 'system-create-route' },
        },
      },
    })

    expect(createPermissionGuard(denyAll)({ name: 'system-create-route', meta: {} } as any, {} as any, next)).toEqual({ name: 'dashboard' })
  })

  it('discovers lazy route action before resolving direct entry', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/dashboard', name: 'dashboard', component: { template: '<main>dashboard</main>' } },
        {
          path: '/detail/:id',
          name: 'lazy-detail',
          component: async () => {
            defineResource(schema, {
              key: 'lazy-roles',
              actions: {
                detail: {
                  run: async () => undefined,
                  permission: 'view-roles',
                  route: { name: 'lazy-detail', params: (id) => ({ id: String(id) }) },
                },
              },
            })
            return { default: { template: '<main>detail</main>' } }
          },
        },
      ],
    })
    router.beforeResolve(createPermissionGuard(denyAll))

    await router.push('/detail/7')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('falls back to root when no accessible route exists', () => {
    getDefaultRouteSpy.mockReturnValue(null as any)
    const result = createPermissionGuard(denyAll)({ meta: { permission: 'view-roles' } } as any, {} as any, next)
    expect(result).toEqual({ path: '/' })
  })
})
