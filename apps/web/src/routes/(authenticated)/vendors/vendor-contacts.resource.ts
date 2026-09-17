import { defineFields, defineResource } from '@southneuhof/loom'
import { vendorContactsActions } from './vendor-contacts.actions'
import { vendorContactsSchema } from './vendor-contacts.schema'

const fields = defineFields(vendorContactsSchema, {
  name: { label: 'Name', form: { renderer: 'text', props: { required: true } } },
  role: { label: 'Position', form: { renderer: 'text' } },
  phone: { label: 'Phone', form: { renderer: 'text' } },
  email: { label: 'Email', form: { renderer: 'text', props: { type: 'email' } } },
  createdAt: { label: 'Created at', display: { format: 'datetime' } },
})

/**
 * Contacts of one vendor. The record owner or staff with detail access reads a
 * vendor's contacts; the API enforces ownership.
 */
export const vendorContacts = defineResource(vendorContactsSchema, {
  key: 'vendor-contacts',
  actions: {
    list: {
      run: vendorContactsActions.list,
      fields: [fields.name, fields.role, fields.phone, fields.email],
      permission: null,
    },
    create: {
      run: vendorContactsActions.create,
      fields: [fields.name, fields.role, fields.phone, fields.email],
      permission: null,
    },
    update: {
      run: vendorContactsActions.update,
      fields: [fields.name, fields.role, fields.phone, fields.email],
      permission: null,
    },
    delete: { run: vendorContactsActions.remove, permission: null },
  },
})
