<script setup lang="ts">
/**
 * Acceptance fixture for the design requirements that are easiest to regress
 * during simplification. It is a framework contract test, not demo code, and it
 * is deliberately not reachable from production navigation.
 *
 * It proves:
 *  - two different resources own independent URL query namespaces with no
 *    `v-model:query`;
 *  - one resource mounted twice needs an explicit `namespace` only on the
 *    second instance;
 *  - synchronous/offline and asynchronous loaders use the same contract;
 *  - a local query object never touches the URL;
 *  - an exceptional `read` field and a `behavior` option coexist with ordinary
 *    fields that need neither.
 */
import { ref } from 'vue'
import { defineFields, defineResource, Form, Table } from '@southneuhof/loom'
import type { FieldsInput, WebResourceSchema } from '@southneuhof/loom'
import { defineSchema } from '@/framework/schema'

interface Row extends Record<string, unknown> {
  id: string
  name: string
  owner: string
  rel_owner_name: string
}

const rows: Row[] = [
  { id: '1', name: 'Pertama', owner: '', rel_owner_name: 'Budi' },
  { id: '2', name: 'Kedua', owner: '', rel_owner_name: 'Sari' },
]

type FixtureSchema = WebResourceSchema<Row, Record<string, unknown>, Record<string, never>, Record<string, never>, string>
const schema = defineSchema<FixtureSchema>({ identity: 'id' })
const fields = defineFields(schema, {
  name: { label: 'Nama', table: { sortable: true } },
  owner: { label: 'Pemilik', display: { read: (record) => record.rel_owner_name } },
})

/** Ordinary resource: everything it needs is the catalog plus a loader. */
const alpha = defineResource(schema, {
  key: 'alpha',
  actions: { list: { run: async () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }), fields: [fields.name, fields.owner] } },
})

const beta = defineResource(schema, {
  key: 'beta',
  actions: { list: { run: async () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }), fields: [fields.name, fields.owner] } },
})

/** The same contract, resolved synchronously with no promise in sight. */
const offline = defineResource(schema, {
  key: 'offline',
  actions: { list: { run: () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }), fields: [fields.name, fields.owner] } },
})

const alphaList = alpha.list()
const alphaArchivedList = alpha.list({ namespace: 'archived' })
const betaList = beta.list()
const offlineList = offline.list()

const localQuery = ref<Record<string, unknown>>({ page: 1, limit: 10 })

interface Draft extends Record<string, unknown> {
  kind?: string
  reason?: string
}

const draftFields: FieldsInput<Draft> = {
  kind: { label: 'Jenis', form: { renderer: undefined } },
  reason: {
    label: 'Alasan',
    form: { behavior: { visible: ({ draft }) => draft.kind === 'lain' } },
  },
}

const submitted = ref<Draft>()
</script>

<template>
  <div>
    <section data-fixture="two-resources">
      <Table :fields="alphaList.fields" :load="alphaList.run" :namespace="alphaList.namespace" />
      <Table :fields="betaList.fields" :load="betaList.run" :namespace="betaList.namespace" />
    </section>

    <section data-fixture="duplicate-resource">
      <Table :fields="alphaList.fields" :load="alphaList.run" :namespace="alphaList.namespace" />
      <Table :fields="alphaArchivedList.fields" :load="alphaArchivedList.run" :namespace="alphaArchivedList.namespace" />
    </section>

    <section data-fixture="offline">
      <Table :fields="offlineList.fields" :load="offlineList.run" :namespace="offlineList.namespace" />
    </section>

    <section data-fixture="local-query">
      <Table :fields="alphaList.fields" :load="() => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } })" :query="localQuery" />
    </section>

    <section data-fixture="draft">
      <Form :fields="draftFields" :initial-data="{ kind: 'biasa' }" :submit="(draft: Draft) => (submitted = draft)" />
    </section>
  </div>
</template>
