<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ConfirmationDialog from '@southneuhof/loom/components/composites/ConfirmationDialog.vue'
import { DetailView } from '@southneuhof/loom'
import AppRouterView from '@/components/routing/AppRouterView.vue'
import PermissionList from './detail/permissions/index.route.vue'
import { resourceCan } from '@/framework/access'
import { rolePermissions } from './detail/permissions/role-permissions.resource'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { roles } from '../roles.resource'

const route = useRoute('settings-roles-detail')
const router = useRouter()
const roleId = route.params.roleId
const detail = roles.detail({ id: roleId })
const canDelete = detail.can?.('delete') ?? false
const deleting = ref(false)
const updateTarget = roles.list().updateRoute?.({ id: roleId } as never)

const canListPermissions = computed(() => resourceCan(rolePermissions)('list'))

async function remove() {
  if (deleting.value) return
  deleting.value = true
  try {
    await roles.delete({ id: roleId }).run()
    toast.success('Data berhasil dihapus.')
    await router.replace({ name: 'settings-roles' })
  } catch (error) {
    toast.error(errorMessage(error, 'Role could not be deleted.'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <DetailView v-bind="roles.detail({ id: roleId })">
      <template #controls>
        <RouterLink v-if="updateTarget" :to="updateTarget"><Button>Ubah</Button></RouterLink>
        <ConfirmationDialog v-if="canDelete" title="Hapus role?" message="Data yang dihapus tidak dapat dikembalikan." :on-confirm="remove">
          <template #trigger>
            <Button color="error" :disabled="deleting">Hapus</Button>
          </template>
        </ConfirmationDialog>
      </template>
    </DetailView>
    <PermissionList v-if="route.name === 'settings-roles-detail' && canListPermissions" />
    <AppRouterView />
  </div>
</template>
