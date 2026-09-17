<script setup lang="ts">
import { ListView } from '@southneuhof/loom'
import { vendors } from './vendors.resource'
</script>

<template>
  <div class="flex flex-col gap-2">
    <ListView v-bind="vendors.list()" title="Vendors" />
  </div>
</template>
