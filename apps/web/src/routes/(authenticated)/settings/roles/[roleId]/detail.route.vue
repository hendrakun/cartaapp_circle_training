<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DetailView } from '@southneuhof/loom'
import AppRouterView from '@/components/routing/AppRouterView.vue'
import PermissionList from './detail/permissions/index.route.vue'
import { resourceCan } from '@/framework/access'
import { rolePermissions } from './detail/permissions/role-permissions.resource'
import { roles } from '../roles.resource'

const route = useRoute('settings-roles-detail')
const roleId = route.params.roleId

const canListPermissions = computed(() => resourceCan(rolePermissions)('list'))
</script>

<template>
  <div class="flex flex-col gap-2">
    <DetailView v-bind="roles.detail({ id: roleId })" />
    <PermissionList v-if="route.name === 'settings-roles-detail' && canListPermissions" />
    <AppRouterView />
  </div>
</template>
