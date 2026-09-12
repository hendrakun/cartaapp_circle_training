<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
/**
 * Collection surface shell.
 *
 * Owns Card, page title, toolbar, filters, and the selected collection
 * presentation. Collection owns the one data lifecycle for the body.
 */
import { computed, getCurrentInstance, ref, useSlots, watch } from "vue";
import { toast } from "vue-sonner";
import type {
  CollectionLoadContext,
  CollectionResult,
  CollectionSlotProps,
  FieldsInput,
  MaybePromise,
  QueryValues,
  RowReorderPayload,
  TableProps,
  ValidationSchema,
} from "../../contracts";
import { resolveFields } from "../../fields";
import Table from "../core/Table.vue";
import Form from "../core/Form.vue";
import Button from "../base/Button.vue";
import Card from "../base/Card.vue";
import Dialog from "../base/Dialog.vue";
import Icon from "../base/Icon.vue";
import Popover from "../base/Popover.vue";
import SearchBox from "../inputs/SearchBox.vue";
import Switch from "../inputs/Switch.vue";
import { exportTableRows, type ListExportOptions } from "../../services";
import { useTablePreferences } from "../core/useTablePreferences";

export interface ListFilters<TQuery extends object = Record<string, unknown>> {
  fields: FieldsInput<TQuery, TQuery>;
  schema?: ValidationSchema<TQuery>;
  defaults?: Partial<TQuery>;
  label?: string;
  resetLabel?: string;
}

/**
 * Standard record actions forwarded to the collection presentation slot.
 *
 * The values come from the same internal surface the table row actions use;
 * a collection presentation must not rebuild route or delete permission checks.
 */
/**
 * Standard record actions forwarded to the collection presentation slot.
 *
 * The values come from the same internal surface the table row actions use;
 * a collection presentation must not rebuild route or delete permission checks.
 * Optional: a bare `table` ListView has no resource context, so it exposes no
 * actions — consumers must handle their absence.
 */
export interface ListViewActions {
  createRoute?: import("vue-router").RouteLocationRaw;
  detailRoute?: (record: Record<string, unknown>) => import("vue-router").RouteLocationRaw | undefined;
  updateRoute?: (record: Record<string, unknown>) => import("vue-router").RouteLocationRaw | undefined;
  can?: (operation: import("../../contracts").ResourceOperation, record?: Record<string, unknown>) => boolean | undefined;
  deleteRecord?: (record: Record<string, unknown>) => Promise<unknown>;
}

type ListReorderProps = {
  reorderable?: boolean;
  rowKey?: TableProps<TRecord, TQuery>["rowKey"];
};

type ListTableProps = Omit<TableProps<TRecord, TQuery>, "reorderable" | "rowKey"> &
  ListReorderProps;

type ListViewRunProps = {
  run: (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>;
  fields: FieldsInput<TRecord>;
  resource?: string;
  namespace?: string;
  searchParameters?: Record<string, unknown>;
  schema?: ValidationSchema<TQuery>;
  pagination?: TableProps<TRecord, TQuery>["pagination"];
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
  minColumnWidth?: number;
  createRoute?: import("vue-router").RouteLocationRaw;
  detailRoute?: (record: TRecord) => import("vue-router").RouteLocationRaw | undefined;
  updateRoute?: (record: TRecord) => import("vue-router").RouteLocationRaw | undefined;
  can?: (operation: import("../../contracts").ResourceOperation, record?: TRecord) => boolean;
  deleteRecord?: (record: TRecord) => Promise<unknown>;
  table?: never;
} & ListReorderProps;

type ListViewProps = {
  title?: string;
  description?: string;
  /** Controlled user collection state. Search/filter values belong here. */
  query?: QueryValues;
  /** Explicit query fields for live filtering; record fields are never inferred. */
  filters?: ListFilters<TQuery>;
  export?: ListExportOptions<TRecord, TQuery> | false;
} & (
  | ListViewRunProps
  | { table: ListTableProps }
);

const props = defineProps<ListViewProps>();
const emit = defineEmits<{
  (event: "update:query", query: QueryValues): void;
  (event: "export-error", error: unknown): void;
  (event: "row-reorder", payload: RowReorderPayload): void;
}>();
const slots = useSlots();
defineSlots<{
  [name: `cell:${string}`]: (props: { value: unknown; record: Record<string, unknown>; field: unknown; index: number }) => unknown;
  collection?: (props: CollectionSlotProps<TRecord, TQuery> & { actions?: ListViewActions }) => unknown;
  /**
   * Per-standard-action overrides. The framework owns visibility: each region
   * renders only when its action is declared and permitted, so custom content
   * never needs its own permission checks. Props are for nuance only.
   */
  "row-actions-view"?: (props: { record: Record<string, unknown>; can?: ListViewActions["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-edit"?: (props: { record: Record<string, unknown>; can?: ListViewActions["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-delete"?: (props: { record: Record<string, unknown>; can?: ListViewActions["can"]; deleteRecord?: ListViewActions["deleteRecord"] }) => unknown;
  "create-action"?: (props: { can?: ListViewActions["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "resource-action"?: () => unknown;
  header?: () => unknown;
  filters?: () => unknown;
  body?: (props: { table: TableProps<TRecord, TQuery> }) => unknown;
  footer?: () => unknown;
  "row-actions"?: (props: { record: Record<string, unknown> }) => unknown;
}>();

type ListViewSurface = {
  table: TableProps<TRecord, TQuery>;
} & ListViewActions;

const surface = computed<ListViewSurface>(() => {
  if ("run" in props && props.run) {
    return {
      table: {
        // @ts-ignore -- vue-tsc TS2590: union too complex under unbound generics in
        // the app program only; remove when vue-tsc materializes this. plans/11
        fields: props.fields,
        load: props.run,
        resource: props.resource,
        namespace: props.namespace,
        searchParameters: props.searchParameters,
        schema: props.schema,
        pagination: props.pagination || "always",
        pageSizeOptions: props.pageSizeOptions,
        defaultPageSize: props.defaultPageSize,
        minColumnWidth: props.minColumnWidth,
        reorderable: props.reorderable,
        rowKey: props.rowKey,
      } as unknown as TableProps<TRecord, TQuery>,
      createRoute: props.createRoute,
      detailRoute: props.detailRoute,
      updateRoute: props.updateRoute,
      can: props.can,
      deleteRecord: props.deleteRecord as ((record: Record<string, unknown>) => Promise<unknown>) | undefined,
    } as ListViewSurface;
  }
  return {
    table: {
      ...props.table!,
      pagination: props.table!.pagination ?? "always",
    },
  };
});

/**
 * The table (and its Collection) owns query state; ListView only forwards
 * controlled bindings and toolbar mutations. `hasQueryBinding` keeps the
 * prop off the Table when the route did not bind one, so Collection's
 * uncontrolled URL-namespace mode stays intact.
 */
const hasQueryBinding = "query" in (getCurrentInstance()?.vnode.props ?? {});
const tableRef = ref<{ refresh: () => Promise<void>; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void }>();
const currentQuery = ref<QueryValues>({ page: 1 });
watch(
  () => props.query,
  (value) => {
    if (!hasQueryBinding || value === undefined) return;
    currentQuery.value = {
      page: 1,
      ...(props.filters?.defaults ?? {}),
      ...(value as QueryValues),
    };
  },
  { immediate: true },
);

/** Controlled query rides along only when the route actually bound one. */
const tableBindings = computed(() => {
  const base = { ...surface.value.table };
  if (hasQueryBinding) (base as Record<string, unknown>).query = props.query;
  return base;
});

function applyQuery(patch: QueryValues) {
  tableRef.value?.updateQuery(patch);
}

function onTableQuery(values: QueryValues) {
  currentQuery.value = values;
  emit("update:query", values);
}

function rowReorder(payload: RowReorderPayload) {
  emit("row-reorder", payload);
}

function updateFilters(next: Record<string, unknown>) {
  applyQuery({ ...next, page: 1 });
}

function resetFilters() {
  const preserved = {
    search: currentQuery.value.search,
    limit: currentQuery.value.limit,
  };
  const restored: QueryValues = Object.assign(
    {},
    { page: 1 },
    { limit: surface.value.table.defaultPageSize ?? 10 },
    props.filters?.defaults ?? {},
    preserved,
  );
  tableRef.value?.replaceQuery(restored);
}

const passthroughSlots = computed(() =>
  Object.entries(slots).filter(
    ([name]) =>
      ![
        "header",
        "filters",
        "body",
        "collection",
        "create-action",
        "resource-action",
        "row-actions-view",
        "row-actions-edit",
        "row-actions-delete",
        "footer",
        "row-actions",
      ].includes(name),
  ),
);

const deleting = ref(false);
const exporting = ref(false);
const columnFields = computed(() =>
  resolveFields({ fields: surface.value.table.fields as never, surface: "table" }),
);
const columnKeys = computed(() => columnFields.value.map((field) => field.key));
const tableNamespace = computed(() => surface.value.table.namespace);
const columnPreferences = useTablePreferences(
  tableNamespace,
  columnKeys,
  computed(() => surface.value.table.minColumnWidth ?? 96),
);
const columnSizing = ref<Record<string, number>>({
  ...columnPreferences.sizes.value,
});
watch(columnPreferences.sizes, (sizes) => {
  columnSizing.value = { ...sizes };
});

function setVisibleColumns(next: string[]) {
  const normalized = columnKeys.value.filter((key) => next.includes(key));
  const hasActions = Boolean(
    slots["row-actions"] ||
    surface.value.detailRoute ||
    surface.value.updateRoute ||
    surface.value.can,
  );
  if (!hasActions && normalized.length === 0 && columnKeys.value.length) return;
  columnPreferences.setVisible(normalized);
}

function setColumnSizing(next: Record<string, number>) {
  columnSizing.value = { ...next };
  columnPreferences.setSizes(next);
}

function resetColumns() {
  columnPreferences.resetColumns();
  columnSizing.value = {};
}

async function remove(
  record: Record<string, unknown>,
  close: (value: boolean) => void,
) {
  if (deleting.value) return;
  deleting.value = true;
  try {
    await surface.value.deleteRecord?.(record);
    close(false);
    toast.success("Record deleted.");
  } catch {
    toast.error("Could not delete record.");
  } finally {
    deleting.value = false;
  }
}

async function exportRows() {
  if (props.export === false || exporting.value) return;
  exporting.value = true;
  try {
    const { page: _page, limit: _limit, ...activeQuery } = currentQuery.value;
    const fields = columnFields.value.filter((field) =>
      columnPreferences.visibleKeys.value.includes(field.key),
    );
    await exportTableRows({
      activeQuery: activeQuery as TQuery,
      searchParameters: surface.value.table.searchParameters ?? {},
      data: surface.value.table.data as TRecord[] | undefined,
      load: surface.value.table.load as never,
      fields,
      options: (props.export ?? {}) as ListExportOptions<TRecord, TQuery>,
      fallbackNamespace: surface.value.table.namespace,
    });
    toast.success("Export created.");
  } catch (error) {
    toast.error("Could not create export.");
    emit("export-error", error);
  } finally {
    exporting.value = false;
  }
}

const canExport = computed(
  () =>
    props.export !== false &&
    Boolean(surface.value.table.data || surface.value.table.load),
);

const customActions = computed<ListViewActions>(() => ({
  createRoute: surface.value.createRoute,
  detailRoute: surface.value.detailRoute,
  updateRoute: surface.value.updateRoute,
  can: surface.value.can,
  deleteRecord: surface.value.deleteRecord,
}));
</script>

<template>
  <section class="is-list-view flex flex-col gap-2">
    <Card variant="outlined" color="surfaceContainer" class="gap-0 p-0">
      <header class="flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <slot name="header">
              <div class="min-w-0">
                <h1 v-if="title" class="text-lg font-semibold tracking-tight text-on-surface">
                  {{ title }}
                </h1>
                <p v-if="description" class="mt-1 text-sm text-on-surface-variant">
                  {{ description }}
                </p>
              </div>
            </slot>
            <div class="flex flex-wrap items-center gap-2">
              <SearchBox
                :model-value="String(currentQuery.search ?? '')"
                @update:model-value="
                  (search: string) =>
                    applyQuery({ search: search || undefined, page: 1 })
                "
              />
              <Popover v-if="filters">
                <template #trigger>
                  <Button kind="icon" variant="standard" aria-label="Filter">
                    <template #icon><Icon name="filter" /></template>
                  </Button>
                </template>
                <template #content>
                  <Form
                    :fields="filters.fields"
                    :schema="filters.schema"
                    :model-value="currentQuery"
                    @update:model-value="updateFilters"
                  />
                  <Button
                    type="button"
                    variant="text"
                    @click="resetFilters"
                    >{{ filters.resetLabel ?? "Reset filter" }}</Button
                  >
                </template>
              </Popover>
              <Dialog>
                <template #trigger>
                  <Button kind="icon" variant="standard" aria-label="Columns">
                    <template #icon><Icon name="table" /></template>
                  </Button>
                </template>
                <template #title>Columns</template>
                <template #content>
                  <slot
                    name="column-dialog"
                    :fields="columnFields"
                    :reset="resetColumns"
                  >
                    <label
                      v-for="field in columnFields"
                      :key="field.key"
                      class="flex items-center justify-between gap-4"
                    >
                      <span>{{ field.label ?? field.key }}</span>
                      <Switch
                        :model-value="
                          columnPreferences.visibleKeys.value.includes(field.key)
                        "
                        @update:model-value="
                          (visible) =>
                            setVisibleColumns(
                              visible
                                ? [
                                    ...columnPreferences.visibleKeys.value,
                                    field.key,
                                  ]
                                : columnPreferences.visibleKeys.value.filter(
                                    (key) => key !== field.key,
                                  ),
                            )
                        "
                      />
                    </label>
                    <Button type="button" variant="text" @click="resetColumns"
                      >Reset columns</Button
                    >
                  </slot>
                </template>
              </Dialog>
              <slot
                name="export-controls"
                :export="exportRows"
                :exporting="exporting"
              >
                <Button
                  v-if="canExport"
                  kind="icon"
                  variant="standard"
                  aria-label="Export Excel"
                  :disabled="exporting"
                  @click="exportRows"
                >
                  <template #icon><Icon name="file-excel" /></template>
                </Button>
              </slot>
            </div>
          </div>
          <div v-if="surface.createRoute || $slots['resource-action']" class="flex flex-row justify-end gap-2">
            <template v-if="surface.createRoute">
              <slot name="create-action" v-bind="{ can: surface.can, target: surface.createRoute }">
                <RouterLink :to="surface.createRoute">
                  <Button>
                    <template #icon><Icon name="add" /></template>Create
                  </Button>
                </RouterLink>
              </slot>
            </template>
            <slot v-if="$slots['resource-action']" name="resource-action" />
          </div>
        </div>
      </header>

      <div
        v-if="$slots.filters"
        class="border-t border-outline-variant px-5 py-3 sm:px-6"
      >
        <slot name="filters" />
      </div>
    </Card>

    <Card variant="outlined" color="surfaceContainer" class="gap-0 p-0">
      <slot name="body" v-bind="{ table: surface.table }">
        <div class="p-3 sm:p-4">
          <Table
            ref="tableRef"
            v-bind="tableBindings"
            :namespace="surface.table.namespace ?? 'table'"
            :visible-columns="columnPreferences.visibleKeys.value"
            :column-sizing="columnSizing"
            @update:query="onTableQuery"
            @update:visible-columns="setVisibleColumns"
            @update:column-sizing="setColumnSizing"
            @row-reorder="rowReorder"
          >
            <template v-if="$slots.collection" #collection="collection">
              <slot name="collection" v-bind="{ ...collection, actions: customActions }" />
            </template>
            <template
              v-if="
                $slots['row-actions'] ||
                surface.detailRoute ||
                surface.updateRoute ||
                surface.can
              "
              #row-actions="{ record }"
            >
                  <div
                    class="flex items-center justify-end gap-1"
                    aria-label="Row actions"
                  >
                    <template v-if="surface.detailRoute?.(record)">
                      <slot name="row-actions-view" v-bind="{ record, can: surface.can, target: surface.detailRoute(record)! }">
                        <RouterLink
                          v-slot="{ href, navigate }"
                          custom
                          :to="surface.detailRoute(record)!"
                        >
                          <Button
                            kind="icon"
                            variant="standard"
                            :href="href"
                            aria-label="View"
                            @click.stop="navigate"
                          >
                            <template #icon><Icon name="eye" size="base" /></template>
                          </Button>
                        </RouterLink>
                      </slot>
                    </template>
                    <template v-if="surface.updateRoute?.(record)">
                      <slot name="row-actions-edit" v-bind="{ record, can: surface.can, target: surface.updateRoute(record)! }">
                        <RouterLink
                          v-slot="{ href, navigate }"
                          custom
                          :to="surface.updateRoute(record)!"
                        >
                          <Button
                            kind="icon"
                            variant="standard"
                            :href="href"
                            aria-label="Edit"
                            @click.stop="navigate"
                          >
                            <template #icon><Icon name="edit" size="base" /></template>
                          </Button>
                        </RouterLink>
                      </slot>
                    </template>
                    <template v-if="surface.can?.('delete', record)">
                      <slot
                        name="row-actions-delete"
                        v-bind="{ record, can: surface.can, deleteRecord: surface.deleteRecord }"
                      >
                        <Dialog v-if="surface.deleteRecord">
                          <template #trigger>
                            <Button
                              kind="icon"
                              variant="standard"
                              color="error"
                              aria-label="Delete"
                              @click.stop
                            >
                              <template #icon><Icon name="delete-bin" size="base" /></template>
                            </Button>
                          </template>
                          <template #title>Delete record?</template>
                          <template #description>This action cannot be undone.</template>
                          <template #footer="{ setOpen }">
                            <div class="flex w-full justify-end gap-2">
                              <Button
                                type="button"
                                variant="text"
                                :disabled="deleting"
                                @click="setOpen(false)"
                              >Cancel</Button>
                              <Button
                                type="button"
                                color="error"
                                :disabled="deleting"
                                @click="remove(record, setOpen)"
                              >Delete</Button>
                            </div>
                          </template>
                        </Dialog>
                      </slot>
                    </template>
                    <slot name="row-actions" v-bind="{ record }" />
                  </div>
                </template>
                <template
                  v-for="([name], index) in passthroughSlots"
                  #[name]="slotProps"
                  :key="index"
                >
                  <slot :name="name" v-bind="slotProps ?? {}" />
                </template>
          </Table>
        </div>
      </slot>

      <footer
        v-if="$slots.footer"
        class="border-t border-outline-variant px-5 py-3"
      >
        <slot name="footer" />
      </footer>
    </Card>
  </section>
</template>
