<script setup lang="ts">
import { computed, ref, type DirectiveBinding } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { ListView } from '@southneuhof/loom'
import Switch from '@southneuhof/loom/components/inputs/Switch.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { permissions } from '@/stores/permissions'
import type { RolePermission } from './role-permissions.schema'
import { rolePermissions } from './role-permissions.resource'

const route = useRoute('settings-roles-detail-permissions')
const roleId = computed(() => String(route.params.roleId))
const pending = ref(new Map<string, boolean>())
const access = permissions()
const list = computed(() => rolePermissions.list({ searchParameters: { role_id: roleId.value } }))

function rowKey(id: string) {
  return `${roleId.value}:${id}`
}

function permissionRow(record: Record<string, unknown>) {
  return record as unknown as RolePermission
}

function assigned(row: RolePermission) {
  return pending.value.get(rowKey(row.id)) ?? row.assigned
}

function canToggle(row: RolePermission) {
  return access.can(row.assigned ? 'delete-role-permissions' : 'create-role-permissions')
}

// Switch applies attributes to its wrapper. Label the focusable button locally.
function switchAttributes(element: HTMLElement, { value }: DirectiveBinding<RolePermission>) {
  const button = element.querySelector('button')
  button?.setAttribute('role', 'switch')
  button?.setAttribute('aria-label', `Permission ${value.name}`)
  button?.setAttribute('aria-checked', String(assigned(value)))
}
const vPermissionSwitch = { mounted: switchAttributes, updated: switchAttributes }

async function toggle(row: RolePermission) {
  const key = rowKey(row.id)
  if (!canToggle(row) || pending.value.has(key)) return
  const next = !row.assigned
  pending.value.set(key, next)
  try {
    await rolePermissions.actions.set.run(roleId.value, row.id, next)
    await rolePermissions.invalidate()
  } catch (error) {
    toast.error(errorMessage(error, 'Permission update failed.'))
  } finally {
    pending.value.delete(key)
  }
}
</script>

<template>
  <ListView v-bind="list" title="Permissions" :export="false">
    <template #cell:assigned="{ record }">
      <Switch
        v-permission-switch="permissionRow(record)"
        :model-value="assigned(permissionRow(record))"
        :data-permission="permissionRow(record).id"
        :disabled="!canToggle(permissionRow(record)) || pending.has(rowKey(permissionRow(record).id))"
        @update:model-value="toggle(permissionRow(record))"
      />
    </template>
  </ListView>
</template>
