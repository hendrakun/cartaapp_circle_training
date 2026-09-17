# Vendor onboarding

## Result and scope

- User result: A vendor can register from a public page, verify email, complete company data, and submit. Staff can review and approve or reject.
- Included: Public registration (domestic and foreign), email verification and resend, vendor company-profile completion, submit for review, staff list/detail/review.
- Excluded: Mandor/perorangan flow, CSMS/CQSMS/BIM questionnaires, SAP sync, contract and performance scoring, blacklist, historical data migration (29,581 vendor rows plus old answers). This delivery uses new records only. These stay as follow-up work unless you require them now.
- Requirement source: User request to port vendor onboarding. Reference is `D:/xampp/htdocs/HK-Circle`, controllers `Register_cp.php`, `Cp_input_data_v2.php`, `Hk_corporate_partner.php`, models `Registration_cp_m.php`, `Cp_input_data_m.php`, view `register_cp/index.php`. Database reference is `D:/Aplikasi/HK Circle Pengutan/Backup Database/db_circle_dev.sql` (PostgreSQL 14 dump, 121 tables).
- Design approval: Revision 3 approved by user reply "setuju", 2026-09-17. Revision 4 approved by the user correction the same day: NPWP is exactly 16 digits and registration adds a `username`. Revision 5 approved by user reply "setuju" after the seven scope answers: option A vendor menu rail; classifications in scope; fixed document list; no equipment or work-experience lists; BIM now; division choice and confirmations; per-aspect review.

## Data and access

- Records and fields:
  - `vendors`: id (uuid), company_name (required), company_type (required, master), email (required, unique), username (required, unique, 3 to 160 characters of letters, digits, dot, underscore or hyphen), npwp (required domestic, unique, exactly 16 digits, store as digits), tax_id (foreign only), business_field (required: subkon/supplier/jasa), address, province, city, district, village, postal_code, phone, status, email_verified_at, verification_token, submitted_at. Timestamps created_at and updated_at.
  - `vendor_contacts`: vendor_id, name, role, phone, email.
  - `vendor_documents`: vendor_id, doc_type (legal/finance/technical), file_key (storage), file_name, mime, size. Uses existing file storage flow.
  - Status values: `registered`, `email_verified`, `profile_complete`, `submitted`, `approved`, `rejected`. Start at `registered`. Rejected vendors can resubmit and return to `submitted`.
  - Master data: reuse simple tables or enums for company_type and business_field. No new framework package.
- Legacy mapping (from dump study, not a 1:1 port):
  - Legacy `peng_data_vendor` has 29,581 rows and about 180 columns. Only uniqueness rule is `UNIQUE (id_vendor_baru)`. The dump has no foreign keys to or from it. Child rows link by `id_vendor` integer or `id_vendor_baru` string with no enforcement.
  - Legacy identity: `id_vendor` integer plus `id_vendor_baru` string (generated from first company letter plus sequence). Login uses separate `username`, MD5 `password`, plain `retype_password` columns on the same row. Email, npwp, and username uniqueness is checked in code only (`cek_npwp_cp`, `cek_email_cp`, `cek_username_cp`).
  - Legacy state uses three columns together: `status` integer (0 new, 1 active, 9 perorangan path, 10 locked), `status_email` (0/1), `konfirmasi_calon_rekanan` (comment: 0 not yet, 1 done, 2 old data). New status strings map to this triple at migration time only.
  - Legacy company completion (`update_data_perusahaan`) writes: nama_perusahaan, tipe_usaha, email, npwp, file_logo, provinsi/kota/kecamatan/desa/kode_pos from `peng_master_postal_code_data`, telp_fax, lat/lon, bank fields (nama_bank, country_bank, no_rekening, nama_pemilik), alamat. Foreign vendors use country plus `country_key-region` and fixed postal code.
  - Legacy contacts live on the vendor row: nama_cp, jabatan_cp, email_cp, telp_fax_cp, handphone_cp plus nama_pimpinan and no_hp_pimpinan. New `vendor_contacts` normalizes this.
  - Legacy business lines: `peng_bidang_usaha` has 7 rows, but registration uses 5 (subkon), 6 (supplier), 7 (jasa). Detail choice is `peng_klasifikasi` (455 rows) with links in `peng_klasifikasi_vendor` (41,188 rows: id_vendor, id_bidang_usaha, id_klasifikasi). New model keeps business_field plus a classification link table.
  - Legacy documents are columns `file1`..`file26` plus score columns `nilaifile*` on the vendor row. The required set comes from `penilaiain_approval` (26 rows) with `kategoridata` (1 technical, 2 finance, 3 legal), `req_vendor`, `req_international`, `wajib_sunah`, and `urutan`. PDF only, max 16 MB. New `vendor_documents` normalizes this with doc_type from the same three categories.
  - Legacy questionnaires stay out of this delivery: CSMS masters 61 rows with 130,395 answers, BIM masters 11 rows with 29,071 answers, CQSMS masters 42 rows with 487 answers, plus alat and pengalaman tables. They become follow-up work.
  - Legacy review uses per-aspect columns (status_teknik, status_legal, status_keu, status_qhse, status_bim plus `_ver` variants, `_by`, `_date`, `_ket`), approver matrix `peng_approver_drt` (23 rows), request column `divisi_approve_req`, and history `peng_circle_timeline_history`. New review keeps one approve/reject action with note, reviewer, and timestamp.
- Relations: `vendor_contacts.vendor_id` shows vendor company_name. `vendor_documents.vendor_id` shows vendor company_name. Edit loads stored ids.
- Access:
  - Public (no login): create registration, verify email link, resend verification.
  - Vendor (authenticated owner): read and update own vendor, manage own contacts and documents, submit own vendor.
  - Staff (authenticated with permission): list and read all vendors, approve or reject. No delete. No edit of vendor business data.
  - Permission codes (new): `view-vendors`, `list-vendors`, `detail-vendors`, `approve-vendors`. Owner access uses row ownership, not a permission code. `view-vendors` is the page grant, consistent with `view-users`.
- Constraints:
  - Email, username and npwp are unique. Legacy also checked username uniqueness (`Registration_cp_m.php`: `cek_username_cp`), so revision 4 restores the username field with that rule.
  - Password and confirmation must match. Store only a hash. Legacy stored MD5 plus plain retype; new system must not store plain passwords (inferred default, needs approval).
  - NPWP domestic is exactly 16 digits in one input, stored as digits only. A database check enforces the same format.
  - Vendor identity: one Carta `users` account per vendor plus one `vendors` row owned by that user. Login uses email (Better Auth). The registered username becomes the account display name (`users.name`). The username is set at registration and is not editable afterwards, as in the legacy completion form.
  - Anti-spam: use rate limit and Better Auth email verification. Legacy captcha is not ported unless you require it (inferred default).
- Standard CRUD pattern: existing `apps/api/src/routes/(authenticated)/users` entity plus scope pattern. Public routes go outside `(authenticated)` group, near `apps/api/src/routes/auth`.

## Custom behavior

### Public registration

- Trigger and inputs: Public form sends company_name, company_type, email, username, npwp or tax_id, business_field, password, password_confirmation.
- Conditions: No login. Rate limited. Email, username and npwp must be unique.
- Successful result: System creates `non_active` user plus `vendors` row in `registered` state, returns a verification link in the response (temporary, until a mail provider exists), shows check-email page.
- Stored effects: One `users` row (emailVerified false) and one `vendors` row with verification token.
- Failure behavior: Duplicate email returns 409 `email_exists` (same as `users/create`). Duplicate username returns 422 `username_exists`. Duplicate npwp returns 422 `npwp_exists`. Password mismatch, a username outside the allowed shape, and a NPWP that is not exactly 16 digits return 400 field errors through the standard envelope. Input is kept on the page.
- Control states: Loading submit, success check-email notice, field error messages.

### Email verification and resend

- Trigger and inputs: User opens verification link with token. Resend action needs email only.
- Conditions: Public. Token must match and must not be used.
- Successful result: Sets `email_verified_at`, moves vendor to `email_verified`, moves user to verified and active. Shows success page with sign-in link.
- Stored effects: `vendors.email_verified_at` set, status change, `users.emailVerified` true.
- Failure behavior: Bad or used token shows invalid-link page. No state change.
- Control states: Verifying, success, invalid link, resent notice.

### Vendor completion and submit

- Trigger and inputs: Owner edits company data, contacts, and uploads documents, then selects Submit.
- Conditions: Owner only. Email must be verified. Required fields: address, province/city, phone, at least one contact. Document uploads are supported, but no document is mandatory until you supply the explicit mandatory list.
- Successful result: Status moves to `submitted` with `submitted_at` set. Vendor can no longer edit until staff decides.
- Stored effects: Vendor row update plus contact and document rows.
- Failure behavior: Missing data blocks submit with field errors. No partial submit.
- Control states: Draft save, validation errors, submitted lock notice.

### Staff review

- Trigger and inputs: Staff opens vendor detail and selects Approve or Reject with a note.
- Conditions: Staff with `approve-vendors` permission. Vendor must be in `submitted` state.
- Successful result: Status moves to `approved` or `rejected`. Vendor sees result on next sign-in. Approved vendor can enter later procurement flows.
- Stored effects: Status change plus review note and reviewer id with timestamp.
- Failure behavior: Approve on non-submitted vendor is rejected with 409. Repeat submit is blocked.
- Control states: Pending review, approved notice, rejected notice with reason.

## Acceptance and checks

| Required outcome | Check | Expected result |
|---|---|---|
| Public user can register a domestic vendor | API contract test POST public register | 201 creates user plus vendor in `registered` state; duplicate email returns 409; duplicate npwp returns 422 |
| Registration requires a unique username | API contract test POST public register | 201 stores the username and uses it as the account name; a duplicate username returns 422 `username_exists`; a username shorter than 3 characters returns 400 |
| NPWP must be exactly 16 digits | API contract test POST public register | 15 and 17 digits return 400; exactly 16 digits returns 201 |
| Foreign vendor can register with tax_id | API contract test POST public register foreign | 201 with tax_id and no npwp; domestic npwp rule does not apply |
| Vendor can verify email and resend | API contract test GET verify plus POST resend | Valid token sets `email_verified`; used token returns 404 or 410 |
| Owner can complete data and submit; others cannot edit | API unit test with owner and non-owner identity | Owner submit moves to `submitted`; other user gets 403; locked edit after submit |
| Staff can approve or reject submitted vendors only | API unit test with staff permission | Approve moves to `approved`; approve on draft returns 409; no permission returns 403 |
| Staff list shows name, status, and dates; detail shows contacts and documents | Web route check with ListView and DetailView | List shows company_name, status chip, submitted date; detail shows one copy of each field |

- Live checks: None. No production write. Development target only after approval.
- Unresolved decisions: Vendor identity (one Carta user per vendor vs separate vendor login); password storage change; captcha needed or not; explicit mandatory document list per business_field (you rejected the `wajib_sunah` rule, so you must supply the list); staff roles that approve.
- Browser and E2E checks: excluded.

## Progress and evidence

- Status: Preview ready (revision 5 implemented). Design revision 5 is approved. The vendor area with its own eight-item menu, the reference masters, the fixed document slots, the BIM questionnaire and the per-aspect review are implemented, migrated, seeded and checked on the development target. Rendered browser behavior is not verified.
- Revision 5 implementation (2026-09-17): reference masters `business_classifications` (450 rows), `vendor_document_requirements` (14 rows), `bim_questions` (11 rows) and `approval_divisions` (8 rows) extracted from the legacy dump into `apps/api/scripts/master-data/*.json` and seeded by `scripts/seed-vendor-masters.ts`. New tables `vendor_business_classifications`, `bim_answers`, `vendor_reviews`; `vendor_documents` now stores one file per fixed `requirement_id`; `vendors` gained `qualification`, `coverage`, `approval_division_code` and `confirmed_at`. Migration `20260917094613_absurd_serpent_society` applied to the development and test targets. Owner routes: `mine` (profile and grouping), `mine/classifications`, `mine/documents/:requirementId`, `mine/bim`, `mine/submit` with the division and the confirmation. Reference reads: `classifications/list`, `classifications/detail/:id`, `divisions/list`. Staff: `review/:id` decides one aspect and derives the aggregate status. The web vendor area is `(authenticated)/vendors/mine/vendor.layout.vue` with a menu rail and eight routed pages; the staff detail page gained per-aspect review controls and Contacts, Documents, BIM and Reviews tabs. This is the recorded exception to the DESIGN.md `Tabs` convention for several child sections, which the user approved as navigation option A.
- Dump study (2026-09-17): Studied `db_circle_dev.sql` structure and COPY row counts. Key facts are in Legacy mapping above. No data was imported. No production data was touched.
- Implementation owners and pattern (as built):
  - API entity, contract and domain: `apps/api/src/routes/vendors/vendors.entity.ts` (tables `vendors`, `vendor_contacts`, `vendor_documents`), `vendors.contract.ts` (request and public schemas, identity rules), `vendors.documents.ts` (asset projection for stored documents), `vendors.ts` (`defineDomainPart`), registered in `apps/api/src/domains.ts`.
  - API catalog: `apps/api/src/authorization/catalog.ts` new `vendors` module with `view-vendors`, `list-vendors`, `detail-vendors`, `approve-vendors`; guard list updated in `catalog.spec.ts`. Seed picks the catalog up automatically.
  - API public routes: `vendors/register/+server.ts`, `vendors/verify/+server.ts`, `vendors/resend-verification/+server.ts`. Register uses Better Auth `signUpEmail` and then sets the account to `non_active` until email verification.
  - API owner routes: `(authenticated)/vendors/mine/+server.ts` (GET and PATCH), `mine/submit/+server.ts`, `mine/contacts/+server.ts`, `mine/contacts/[contactId]/+server.ts`, `mine/documents/+server.ts`, `mine/documents/[documentId]/+server.ts`, shared logic in `vendors.access.ts`. Submit and review use `lockRow` in one transaction.
  - API staff routes: `(authenticated)/vendors/list/+server.ts` (`list-vendors`), `detail/[id]/+server.ts` (`detail-vendors`), `review/[id]/+server.ts` (`approve-vendors`), `contacts/list/+server.ts` and `documents/list/+server.ts` (either `detail-vendors` or vendor ownership through `authorizeVendorRead`).
  - Technical decisions within the approved behavior: owner operations live at `/vendors/mine` and resolve the record from the session, so a foreign record identifier cannot be supplied. Stored documents use the asset contract: the request and read field is `file` (a `StoredAsset`), and the database keeps the object key in `file_key`. The shared `vendorDetailPublicSchema` keeps one public payload for list, owner and staff reads.
  - Migration: `apps/api/drizzle/20260917072343_curious_retro_girl/migration.sql` from `drizzle-kit generate`. Generated, not applied.
  - API tests: `apps/api/src/routes/vendors/vendors.routes.spec.ts` (registration, verification, owner completion, ownership isolation, staff list, detail, approve, reject, permission denial). `apps/api/src/__tests__/route-contract.spec.ts` route list updated with the 11 new paths.
  - Web public: `(public)/vendors/register/index.route.vue` plus `vendors.register.ts`, `(public)/vendors/verify/index.route.vue`.
  - Web app: `(authenticated)/vendors/vendors.schema.ts`, `.actions.ts`, `.resource.ts`, `.types.ts`, `.options.ts`, `.profile.ts`, `.review.ts`, `index.route.vue` (staff list), `[vendorId]/detail.route.vue` with `DetailView`, `Tabs` and `AppRouterView`, `[vendorId]/detail/contacts/index.route.vue`, `[vendorId]/detail/documents/index.route.vue`, `mine/index.route.vue` (owner onboarding), `vendor-profile-form.vue`, `vendor-contacts-section.vue`, `vendor-documents-section.vue`, `vendor-review-controls.vue`. Navigation: `apps/web/src/manifest/navigation.ts` new `vendors` module with `My registration` (open) and `Vendor review` (`view-vendors`).
- Work order result: Steps 1 to 4 are implemented in source.
- Next action: None required. Optional follow-up: supply the mandatory document list, the staff role names and an email provider.
- Development setup: Preview ready. Local `DATABASE_URL` credentials were corrected in `apps/api/.env` and `apps/api/.env.test` (both are git-ignored). Development target `carta` at `localhost:5432`: `db:migrate` applied `20260917072343_curious_retro_girl` and `20260917085735_naive_thunderbolt_ross`, and `db:seed` granted the new vendor permissions to the administrator role. Test target `carta_api_test`: migrated by the test run. `pnpm module:preflight -- --needs api,test`: api PASS, test target PASS, connected database PASS. Preview: API `http://localhost:5180`, web `http://localhost:5181`. One demo vendor `PT Demo Onboarding` (`vendor-demo-1789636285@example.invalid`, username `vendor-demo-1789636285`, password `demo-password-123`) is in `submitted` state so the review controls can be tried; the administrator account is the configured `CARTA_ADMIN_EMAIL`.
- Check results (all exit 0 unless stated):
  - `pnpm module:preflight -- --needs api,test`: api PASS, test PASS.
  - `pnpm --filter @southneuhof/api test:focused -- src/routes/vendors/vendors.routes.spec.ts`: 15 passed, 0 failed.
  - `pnpm --filter @southneuhof/api test`: 96 passed, 1 failed. The failure is `src/__tests__/production-bundle.spec.ts` with `EPERM: operation not permitted, symlink` in the spec's own temporary fixture. This is a Windows symlink permission limit, and the same limit fails one web spec. It is unrelated to this module.
  - `pnpm --filter @southneuhof/api build` (routes build, production bundle, routes check, tsc): exit 0.
  - `pnpm --filter @southneuhof/api lint`: exit 0.
  - `pnpm --filter @southneuhof/framework-web type-check`, `build-only`, `oxlint`, `eslint --quiet`, `oxfmt --check` on changed files: exit 0.
  - Web unit tests (router and routes): 105 passed, 2 failed. Both failures are `router/__tests__/route-type-generation.spec.ts` `EPERM: symlink`, the same Windows environment limit.
  - Revision 5 checks: `apps/api/src/routes/vendors/vendors.routes.spec.ts` 26 passed; `vendors.masters.spec.ts` covers the extracted master files (450 classifications in the 135/216/99 split, 14 requirements in 6/6/2 with `13` and `23` domestic-only, 11 questions, 8 divisions); the route-contract spec passes with 21 vendor paths; the full API suite is 111 passed with the single pre-existing Windows symlink failure; API `type-check` and `lint` exit 0; web `type-check`, `build-only`, `oxlint`, `eslint --quiet`, `oxfmt --check` and the direct-form field spec exit 0; web unit tests are 111 passed with the two pre-existing symlink failures.
  - Revision 5 live checks on the development target: register, verify, sign in, then `GET /vendors/mine` reports eight progress areas, 14 document slots, 11 BIM questions and the seven missing values; `GET /vendors/classifications/list` returns 216 supplier rows and `GET /vendors/divisions/list` returns 8; `PATCH /vendors/mine` stores qualification and coverage; `PUT /vendors/mine/classifications` rejects unknown ids with 422 and saves three real ids with `bidang_usaha` true; `PUT /vendors/mine/documents/1` stores the NIB file; `PUT /vendors/mine/bim` stores eleven answers with `input_bim` true; `POST /vendors/mine/submit` with division `00` stores the division and sets `submitted` with `konfirmasi_selesai` true; four aspect decisions move the aggregate to `approved`; a repeated decision answers 409; the staff list shows `approved`. The live-check vendor was removed afterwards.
  - Revision 4 checks: `apps/api/src/routes/vendors/vendors.routes.spec.ts` 17 passed; full API suite 98 passed with the single pre-existing Windows symlink failure; API `type-check` and `lint` exit 0; web `type-check`, `build-only`, `oxlint`, `eslint --quiet` and `oxfmt --check` exit 0; the direct-form field spec still passes and now also covers the new `username` field.
  - Post-repair web checks: `vue-tsc` type-check exit 0; `oxlint`, `eslint --quiet` and `oxfmt --check` on the changed files exit 0; `build-only` production build exit 0; the new direct-form field spec passes; the Vite dev server compiles `vendors.register.ts`, `vendors.profile.ts`, `vendors.review.ts` and `vendor-review-controls.vue` with HTTP 200 and no error.
  - Live HTTP checks on the development target: `GET /health` 200; OpenAPI lists all 16 vendor paths; `GET /vendors/verify` with a bad token 404; `GET /vendors/mine` without a session 401; `POST /vendors/register` 201; the returned verification link 200; email sign-in 200; `GET /vendors/mine` 200 with `email_verified`; `PATCH /vendors/mine` 200; contact create 200; `POST /vendors/mine/submit` 200 and status `submitted`; administrator `GET /vendors/list` 200; `GET /vendors/detail/:id` 200 with one contact; `POST /vendors/review/:id` on a non-submitted vendor 409 `invalid_transition`.
- Review: Self-review, verdict PASS with one stated limit. Requested outcomes are implemented and covered by the passing API spec, the production builds and the live HTTP checks. Rendered UI behavior was not verified in a browser, and E2E is excluded by the module boundary. The single API suite failure and the two web failures come from the Windows symlink limit in test fixtures, not from this module.
- Reported defect and repair (2026-09-17): The public registration form rejected `companyType` and `businessField` with `Invalid option: expected one of ...`. Cause: the direct `Form` and `DialogForm` surfaces received `defineFields(...)` output. That helper returns field references for `defineResource`, which resolves them internally; an unresolved reference silently loses `renderer`, `source`, `props` and `label`, so the select controls held no value and the required enum stayed undefined. Repair: `vendors.register.ts`, `vendors.profile.ts` and `vendors.review.ts` now declare plain field definitions for the direct forms, and the review `DialogForm` receives the field catalog instead of an array of bare definitions. `defineFields` remains correct for the `vendorContacts` and `vendorDocuments` resources. Regression check added: `apps/web/src/routes/(authenticated)/vendors/vendors.direct-form-fields.spec.ts` asserts that every direct-form catalog resolves each declared field with its declared renderer and source. The same check failed before the repair, where `resolveFields` returned `{"key":"companyType","label":"companyType","props":{}}` (no renderer, no source).
- Remaining gaps: `data_perusahaan` keeps its free-text province and city; the legacy postal-code master, coordinates, bank fields and the company logo are follow-up work. Aspect-specific approver permissions stay follow-up work, so one `approve-vendors` code decides every aspect. Document sub-questions from `peng_pq_detail_master`/`peng_pq_detail_jawab` and the work-experience and equipment lists are excluded. Mandatory document lists are fixed by the master and a missing file does not block submission. Captcha and rate limit are not implemented, the username is immutable after registration, staff role names are still open, the register response returns a temporary verification link until an email provider exists, and the Windows symlink test-fixture failures remain an environment limit.

## Revision 5 — vendor area with its own menu (APPROVED)

- Requirement source: user request 2026-09-17 for the legacy vendor menu plus the user's answers to the seven scope questions. The eight items match `application/views/cp_input_data/sidebar.php` exactly, so this revision restores legacy vendor parity.
- User decisions: (1) navigation option A, a vendor menu rail inside the vendor area; (2) `bidang_usaha` masters are in scope; (3) documents use the fixed master list; (4) work-experience and equipment lists are out of scope; (5) the BIM questionnaire is in scope now; (6) `konfirmasi_selesai` needs the approval-division choice and confirmations; (7) staff review is per aspect.
- Included: vendor menu rail with eight routed areas; qualification, coverage and classification selection; fixed document slots per category; BIM questionnaire; division choice and confirmations on submit; per-aspect staff review with an aggregate vendor status.
- Excluded: work-experience and equipment lists (user decision), document sub-questions from `peng_pq_detail_master`/`peng_pq_detail_jawab`, all scoring and `nilai` values, historical vendor or answer migration, and SAP, contract, invoice and performance features.

### Master data (reference data, seeded from the legacy dump)

Measured from `db_circle_dev.sql` on 2026-09-17:

| Master | Legacy source | Rows | Filter |
|---|---|---|---|
| Business classifications | `peng_klasifikasi` | 450 | `id_bidang_usaha` in subkon (135), supplier (216), jasa (99) |
| Document requirements | `penilaiain_approval` | 14 | `uploadable = t`, `req_vendor = t`, `urutan` set, `kategoridata` in 1/2/3; technical 2, finance 6, legal 6; 12 apply to foreign vendors |
| BIM questions | `peng_master_bim` | 11 | all rows |
| Approval divisions | `tbl_dm_divisi` | 8 | `divisi_approver = t` |
| Qualification | `peng_master_kualifikasi` | 4 | fixed enum, no table |
| Coverage | `peng_cakupan_wilayah` | 4 | fixed enum, no table |

These are reference lists required by the feature. They are not historical vendor records, so they do not conflict with the earlier rejection of historical vendor migration. The seed loads them from a generated data file and stays idempotent by business key.

### Data and access

- New enum columns on `vendors`: `qualification` (`mikro`, `kecil`, `menengah`, `besar`) and `coverage` (`lokal`, `regional`, `nasional`, `internasional`), both with database checks. Nullable until the owner fills `bidang_usaha`.
- New submit columns on `vendors`: `approvalDivisionCode` (text, references `approval_divisions.code`) and `confirmedAt` (timestamp). Both are set by submit.
- New tables:
  - `business_classifications` (id, business_field, name, active) — master.
  - `vendor_business_classifications` (vendor_id, classification_id) — primary key over both columns.
  - `vendor_document_requirements` (id, category, name, required, applies_to_foreign, sort_order) — master.
  - `bim_questions` (id, question, sort_order) — master.
  - `approval_divisions` (code, name) — master.
  - `bim_answers` (id, vendor_id, question_id, answer boolean, note, file_key, file_name, mime_type, file_size, audit) with a unique key over (vendor_id, question_id).
  - `vendor_reviews` (id, vendor_id, aspect, decision, note, reviewer_user_id, reviewed_at) with a unique key over (vendor_id, aspect).
- Changed table: `vendor_documents` drops the free `doc_type` and gains `requirement_id` (not null, references `vendor_document_requirements.id`) with a unique key over (vendor_id, requirement_id). One file per fixed slot.
- Relations: one vendor has many classifications, document slots, BIM answers and aspect reviews. The public detail payload carries the classification names, the document requirement rows with their file, the BIM questions with their answers, and the aspect decisions, so no extra lookup is needed to display the record.
- Access:
  - Owner: read and write the own vendor area, replace the classification set, attach or remove a document per slot, save BIM answers, and submit.
  - Staff: read all vendors and decide one aspect through `approve-vendors`. Aspect-specific permission codes are a follow-up; the current code keeps one approval permission.
  - Reference reads needed by both audiences: `GET /vendors/classifications/list` and `detail/:id` (searchable, paginated) and `GET /vendors/divisions/list` (8 rows). These require a session only.

### Custom behavior

### Vendor area menu (option A)

- Trigger: the vendor opens `/vendors/mine` after sign-in.
- Layout: `(authenticated)/vendors/mine/vendor.layout.vue` renders two columns on wide screens and stacks on narrow screens. The left column is the vendor menu with eight items and a completeness mark per item; the right column is `AppRouterView`.
- Routes and names: `vendors-mine` (Data Perusahaan, the index), `vendors-mine-contact-person`, `vendors-mine-bidang-usaha`, `vendors-mine-data-pendukung-legal`, `vendors-mine-data-pendukung-teknis`, `vendors-mine-data-pendukung-keuangan`, `vendors-mine-input-bim`, `vendors-mine-konfirmasi-selesai`. Paths stay under `/vendors/mine/...` in kebab case.
- Consequence: this is an explicit user exception to the DESIGN.md `Tabs` convention for several child sections. The record keeps the global app shell, so the app sidebar stays and the vendor menu is the area's own rail.
- Control states: an item shows complete when its required values are present and incomplete otherwise. Locked states after submit follow the existing vendor status rule.

### Bidang usaha

- Trigger and inputs: `qualification` (select of 4), `coverage` (select of 4) and a searchable multi-select of `business_classifications` filtered by the vendor's `business_field`.
- Conditions: owner only; editable while the vendor status allows edits.
- Successful result: the vendor row stores qualification and coverage, and the link table stores the chosen classifications. The set replaces the previous set on save.
- Failure behavior: an unknown classification, a classification from another business field, or a duplicate returns 422 with a field issue. A missing qualification or coverage blocks submit.
- Control states: saving, saved, validation errors.

### Data pendukung legal, teknis and keuangan

- Trigger and inputs: three routed pages that share one component with a category argument. Each page lists the fixed `vendor_document_requirements` rows for its category and shows the file state per slot.
- Conditions: owner only; PDF only, maximum 16 MB, matching the legacy rule (`Cp_input_data_v2.php: simpan_data_pendukung`).
- Successful result: attaching a file creates or replaces the document row for that slot. Removing a file deletes the row and keeps the stored object.
- Failure behavior: a wrong content type or an oversized file returns 422 with a field issue. A slot from another category or a slot that does not exist returns 404.
- Control states: per-slot upload, replace, remove, loading and error. A missing required slot does not block submit; it is reported to the reviewer as a gap.

### Input BIM

- Trigger and inputs: eleven questions from `bim_questions`. Each answer has a Yes/No choice, an optional note and an optional PDF attachment.
- Conditions: owner only; editable while the vendor status allows edits.
- Successful result: `bim_answers` holds one row per question for the vendor. Saving replaces the answers in one transaction.
- Failure behavior: a question that does not exist returns 422. A failed save changes nothing.
- Control states: saving, saved, unanswered marks.

### Konfirmasi selesai

- Trigger and inputs: the owner selects one `approval_divisions` row and accepts the confirmations, then submits.
- Conditions: owner only, email verified, and the vendor status allows submission. Required before submit: address, city, phone, at least one contact, qualification, coverage and at least one classification.
- Successful result: the vendor status becomes `submitted`, `submitted_at` and `confirmed_at` are set, and the division is stored. All four aspects start undecided. A resubmission after a rejection clears the previous aspect decisions.
- Failure behavior: a missing required value returns 422 with field issues. A submit on a locked state returns 409. Missing document slots or unanswered BIM questions do not block submit.
- Control states: incomplete list, submitting, submitted lock notice.

### Per-aspect staff review

- Trigger and inputs: staff opens a submitted vendor and decides one aspect at a time. Aspects: legal, finance, technical and BIM. Input: decision (approved or rejected) and a note; a rejection needs a reason.
- Conditions: `approve-vendors`; the vendor must be `submitted`. One decision per aspect; a later decision replaces the earlier one while the vendor stays submitted.
- Successful result: `vendor_reviews` stores the decision. The aggregate vendor status becomes `approved` when all four aspects are approved, `rejected` when at least one is rejected, and stays `submitted` while some aspect is undecided.
- Failure behavior: an unknown aspect or a decision on a vendor that is not submitted returns 409. A rejection without a note returns 400.
- Control states: per-aspect pending, approved and rejected states with the note and reviewer shown; the aggregate status in the list and header.

### Acceptance and checks (revision 5 additions)

| Required outcome | Check | Expected result |
|---|---|---|
| Vendor menu shows eight areas on routed pages | Web route check against the generated route names and the layout source | Every menu item resolves to a generated child route; the layout renders the rail and `AppRouterView` |
| Owner saves qualification, coverage and classifications | API test PUT and GET `/vendors/mine/classifications` | Stored set replaces the previous set; a foreign classification returns 422 |
| Fixed document slots per category | API test attach, replace and remove per requirement | One row per slot; a wrong category returns 404; a non-PDF returns 422 |
| BIM answers persist per question | API test PUT then GET `/vendors/mine/bim` | Eleven rows for the vendor; a failed save changes nothing |
| Submit stores the division and confirmations | API test POST `/vendors/mine/submit` | `submitted` with `confirmed_at` and the division; a missing division returns 400 |
| Per-aspect decisions drive the aggregate status | API test one aspect at a time | `submitted` while undecided, `approved` when all four are approved, `rejected` when one is rejected |

- Open items with a recommendation: (a) `data_perusahaan` keeps its current free-text province and city this revision; the legacy postal-code master is too large to port without a separate decision, and coordinates, bank fields and logo stay follow-up work; (b) aspect-specific approver permissions stay follow-up work, so one `approve-vendors` code decides every aspect; (c) BIM counts as a fourth required aspect for every vendor.

### Work order (revision 5)

- Phase 1: master tables, seed data, enum columns, `vendor_documents` change, migration, vendor layout with the eight routes, and the existing company, contact and submit content wired to the new routes.
- Phase 2: `bidang_usaha` with the classification lookup.
- Phase 3: the three document-slot pages.
- Phase 4: BIM questionnaire.
- Phase 5: per-aspect review on the staff side and the aggregate status.
- First usable result is Phase 1: the vendor signs in, sees the eight-item menu, and can complete the company data, contacts and submission.
- Status: implemented. See the Progress and evidence section for the revision 5 checks.
