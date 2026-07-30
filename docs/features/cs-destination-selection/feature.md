# Feature Spec: Contentstack Destination Selection (Content Map & Audit — Destination panel)

- **Slug:** `cs-destination-selection`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-07-22
- **Last updated:** 2026-07-30

## 1. Summary

On the Contentstack-to-Contentstack migration wizard, the **Destination panel** lets a migration operator configure where content is migrated *to* — a target region and organization, a **Stack** they either pick from existing stacks in that organization or create fresh via a modal, how the import authenticates against that stack (a system-generated read/write **Management token**, named by the user, or a deferred **authToken** sign-in), and how the source's *locked* master locale and branch map onto destination locales and a destination branch — gated on the source being ready, warning the user when source and destination regions differ, and previewing what already exists in the chosen destination stack.

## 2. Problem statement

Contentstack-to-Contentstack migration currently has no explicit way for a user to specify and confirm where content is going before it's mapped and migrated. Without this, users would have to guess or be told out-of-band which stack/org/region an import will land in, which credentials it will use, and how locales line up between source and destination — increasing the risk of imports landing in the wrong org/region, failing at import time due to bad credentials, or mis-mapped locales silently corrupting content. The Destination panel closes this gap by making the target, its authentication, and its locale mapping explicit and reviewable before the user commits to the next step (content mapping).

## 3. Target users / personas

- **Migration operator (primary)** — a Contentstack developer or solutions engineer running a stack-to-stack migration. Cares about pointing the import at the correct region/org, naming the new (or picking the existing) stack sensibly, choosing how the import authenticates, and getting locale/branch mapping right.
- **Partner / implementation consultant (secondary)** — configures a destination on behalf of a customer, often preferring a system-generated Management token (scoped read/write, no login required) over signing in with their own authToken session. Cares primarily about the "Management token" authentication path.

Primary persona: **Migration operator**.

## 4. Goals & success metrics

- **G-1:** A user can fully specify a destination (region, org, stack — existing or newly created, import authentication, branch mapping, language mapping) from a single panel. — measured by: destination-step completion rate among users who reach it. Target `TBD — Open Question` (Q-8).
- **G-2:** The destination selection persists across reloads so a mid-flow refresh never loses the user's configuration. — measured by: 0 reported cases of lost destination selection after refresh.
- **G-3:** Cross-region migrations are always visibly flagged before the user proceeds. — measured by: 0 cases of a cross-region migration proceeding without the warning having been shown.
- **G-4:** The Proceed action never lets a user advance before the source is actually ready. — measured by: 0 cases of proceeding while the persisted source is not ready.

## 5. Non-goals / out of scope

- **Source panel** (Region/Org/Stack/Branch/scope, file upload, content graph) — already specified separately in `../cs-source-selection/feature.md`; this feature only *reads* the source's readiness/region/locales.
- **The Audit step** — in the real product flow (Source → Audit → Destination → Content Mapping → Migrate), Audit runs *before* Destination and is its own feature; this spec does not define Audit's behavior. (Note: see Q-1/Q-2 — the design reference's own "After you proceed" copy appears to assume a different ordering; this is called out, not resolved, here.)
- **Content Mapping** — the next wizard step after Destination; this feature ends once the destination is configured and persisted.
- **Full stack configuration at creation time** — the "Create a new stack" modal only captures name and description; anything else about a newly created stack (locales, environments, ACLs, etc.) uses Contentstack's own defaults and is not configured here.
- **Running the actual migration/import** — out of scope; a later step (Migrate) owns this.
- **The step tracker / cross-step navigation** — shared wizard chrome, not owned by this feature.
- **Non-Contentstack destinations** — this feature is Contentstack-destination only (`feature/cs-to-cs`).

## 6. Use cases

### UC-1: Configure the destination for a migration

- **Actor:** Migration operator
- **Trigger:** User reaches the Destination panel for a project that has a source selection (from the Source feature).
- **Preconditions:** User is authenticated; a project exists; a source selection exists for the project (it may or may not yet be "ready").
- **Main flow:**
  1. User selects a Destination **Region**.
  2. User selects a Destination **Organization** (options scoped to the chosen region).
  3. User selects a **Stack** — either an existing stack in that Organization from the dropdown (see UC-6), or "Create a new stack" (see UC-7).
  4. User chooses an **Import authentication** method: **Management token** (names a token the system will create) or **authToken** (deferred sign-in) (see UC-3).
  5. User confirms the **branch mapping** (source branch locked, destination branch chosen — see UC-8) and the **language mapping** (source master locale locked, destination locale chosen, plus optional additional locale rows — see UC-4).
  6. If the chosen Destination Region differs from the persisted source's region, the system shows the cross-region banner: "Cross-region migration. Content moves from **{srcRegion}** to **{destRegion}**. Confirm data-residency requirements first."
  7. Once the persisted source is ready and all required destination fields are set, the user clicks **"Proceed to content mapping."**
  8. The destination selection is persisted to the project and the user advances to the next step.
- **Postconditions / success state:** Destination selection is persisted; user proceeds to Content Mapping.
- **Alternate flows:**
  - **UC-1a (Source not ready):** If the persisted source is not yet ready, "Proceed to content mapping" stays disabled with the caption "Prepare the source first to continue," regardless of how complete the destination fields are.
  - **UC-1b (Same-region):** If Destination Region equals the source's region, no cross-region banner is shown.
- **Priority:** P0

### UC-2: Switch destination region requiring re-authentication

- **Actor:** Migration operator
- **Trigger:** User selects a different Region in the Destination panel than the one currently authenticated.
- **Preconditions:** User is mid-configuration on the Destination panel.
- **Main flow:**
  1. User opens the Region dropdown and picks a different region.
  2. System opens a login modal: "Switching to **{region}** requires you to authenticate against that region," with Email and Password fields.
  3. The Log in button stays disabled until both fields are non-empty.
  4. User submits valid credentials.
  5. System establishes the session for that region, closes the modal, and the Region field reflects the new region.
- **Postconditions / success state:** Session established for the new region; downstream Organization options refresh for that region.
- **Alternate flows:**
  - **UC-2a (Cancel):** User closes the modal (X control or clicking outside it) → Region reverts to its prior value; no session change.
  - **UC-2b (Invalid credentials):** Invalid credentials submitted → an error is shown, the modal remains open, and the region is not switched (see EC-4).
- **Priority:** P0

### UC-3: Choose and configure import authentication

- **Actor:** Migration operator
- **Trigger:** User has not yet chosen an import-authentication method on the Destination panel.
- **Preconditions:** Destination panel is open.
- **Main flow:**
  1. User sees two always-visible, directly selectable method cards: **"Management token"** ("Stack-scoped token with an API key. Recommended for automated imports.") and **"authToken"** ("User session token from a Contentstack login. Good for quick, one-off imports.").
  2. User selects the **"Management token"** card.
  3. A required **"Management token name"** text field appears (e.g. placeholder "eu-marketing-import"), plus a dismissible warning: "Important: a management token cannot install apps. Any app in this migration will be installed with your authToken — you'll be asked to sign in before those steps run."
  4. User enters a name for the token.
- **Postconditions / success state:** The Management token name is set. When the user clicks "Proceed to content mapping," the system creates a new management token on the destination stack via the Contentstack Management API, scoped **read and write**, using that name — before the destination selection is persisted and the user advances (resolves former Q-15). If the entered name collides with an existing token name already on the destination stack, an error is shown stating the name already exists, no token is created, and the user does not advance (see EC-13).
- **Alternate flows:**
  - **UC-3a (authToken instead):** User selects the **"authToken"** card instead — no field appears at all. This method uses the Contentstack session credential already on file for this user for the destination's region (the same one established whenever a region-switch login succeeds, on this panel or Source's — see FR-3.7). If no credential is on file yet for that region, the user is prompted to sign in for it when authentication is actually needed (out of scope for this feature — happens at a later step).
  - **UC-3b (Switch method):** User selects the other card at any time — no separate "Change" step is needed; switching directly discards any entered Management token name for the method being left.
- **Priority:** P0

### UC-4: Configure language mapping

- **Actor:** Migration operator
- **Trigger:** Destination panel is open.
- **Preconditions:** The persisted source exposes its master locale (see DEP-1).
- **Main flow:**
  1. User sees a **master-locale row**: the source stack's master locale shown read-only/locked (labeled "Master"), paired with a **destination locale** dropdown the user must choose. Explanatory text: "The source master locale is fixed. Choose which locale it becomes in the destination stack, then map any additional locales below."
  2. Below that, user sees zero or more **additional** language-mapping rows, each pairing a **source locale** dropdown (left) with a **destination locale** dropdown (right).
  3. User clicks **"Add language"** to add an additional row.
  4. User selects locales in each dropdown of an additional row.
  5. User may remove any additional row via its remove control.
- **Postconditions / success state:** The destination locale for the master-locale row is set, and any additional rows are configured; the "Locales mapped" count in the Destination summary reflects the total (see Q-16 for the exact counting formula).
- **Alternate flows:**
  - **UC-4a (Remove all additional rows):** User removes every additional row, leaving zero — this is allowed; the master-locale row is unaffected and always remains, so the destination never has zero locale mapping overall. (Resolves former Q-6.)
- **Priority:** P0 for the master-locale row (now always shown and expected to be set); P1 for the additional-rows enhancement (unchanged from before). Whether an unset master-locale destination choice actually blocks "Proceed to content mapping" is undecided — see Q-17.

### UC-5: Resume a previously configured destination

- **Actor:** Migration operator
- **Trigger:** User returns to the Destination panel (reload, or navigating back from a later step).
- **Preconditions:** A destination selection was previously persisted for this project.
- **Main flow:**
  1. System loads the persisted destination selection for the project.
  2. Region, Organization, Stack, the chosen import-authentication method (the Management token name, if that method was chosen), the branch mapping's destination-branch choice, the master-locale row's destination-locale choice, and all additional language-mapping rows are restored.
- **Postconditions / success state:** The user sees their prior destination configuration exactly as left.
- **Priority:** P1

### UC-6: Select an existing stack as the destination

- **Actor:** Migration operator
- **Trigger:** User opens the Stack dropdown after selecting a Destination Organization.
- **Preconditions:** Destination Organization is selected.
- **Main flow:**
  1. User opens the **Stack** dropdown.
  2. It lists the existing stacks in the selected Organization, plus a **"Create a new stack"** option (see UC-7).
  3. User selects an existing stack.
- **Postconditions / success state:** The chosen stack is set as the destination Stack; no stack-creation modal appears.
- **Priority:** P0

### UC-7: Create a new destination stack

- **Actor:** Migration operator
- **Trigger:** User selects **"Create a new stack"** from the Stack dropdown.
- **Preconditions:** Destination Organization is selected.
- **Main flow:**
  1. User selects "Create a new stack" from the Stack dropdown.
  2. A modal opens: "Create a new stack" — "The stack is created in **{destOrg}** and selected as your destination."
  3. User enters a **Stack name** (required) and, optionally, a **Stack description**.
  4. User clicks **"Create stack"** (disabled until Stack name is non-empty).
  5. The stack is created, becomes the selected destination Stack, and the modal closes.
- **Postconditions / success state:** The newly created stack is set as the destination Stack.
- **Alternate flows:**
  - **UC-7a (Cancel):** User clicks "Cancel" or the close control → the modal closes, no stack is created, and the Stack dropdown is left as it was before opening the modal (no stack selected, unless one was already selected prior to choosing "Create a new stack").
- **Priority:** P0

### UC-8: Map the source branch to a destination branch

- **Actor:** Migration operator
- **Trigger:** Destination panel is open.
- **Preconditions:** The persisted source exposes which branch was selected in the Source step (see DEP-1).
- **Main flow:**
  1. User sees exactly one branch-mapping row, positioned directly above the Language mapping section: the source branch shown read-only/locked (labeled "Locked", tooltip "Set in the source step"), paired with a **destination branch** dropdown the user must choose.
  2. User selects a destination branch.
- **Postconditions / success state:** The destination branch is set. There is no "add" or "remove" control — exactly one branch mapping always exists, since there is only ever one selected source branch.
- **Priority:** P0 (always shown and expected to be set; whether it blocks "Proceed to content mapping" if unset is undecided — see Q-17, same as UC-4)

### UC-9: Preview what already exists in the destination stack

- **Actor:** Migration operator
- **Trigger:** A destination Stack is selected (existing or newly created).
- **Preconditions:** A Stack is selected (UC-6 or UC-7).
- **Main flow:**
  1. A **"Stack contents"** card appears in the sidebar, above the Destination summary card, showing the selected Stack's name.
  2. If the stack has no existing content, the card shows: "This stack is empty — everything you migrate will be created fresh."
  3. Otherwise, the card shows a grid of stat tiles reflecting content already in that stack.
- **Postconditions / success state:** The user can see, before proceeding, whether they're migrating into an empty stack or one that already has content.
- **Alternate flows:**
  - **UC-9a (Newly created stack):** A stack just created via UC-7 is always empty, so the empty-state message is shown.
- **Priority:** P1 — informational, does not gate Proceed. Exact stat tiles shown (which metrics, how many) are undecided — see Q-18.

## 7. User flows (optional detail)

The Destination panel is a single form, laid out as: Region → Organization → Stack (existing-stack dropdown, with "Create a new stack" opening a modal) → Import authentication (persistent method cards; Management token reveals a token-name field + apps warning, authToken reveals nothing) → Branch mapping (single locked-source row) → Language mapping (locked master-locale row + optional additional rows) → cross-region banner (conditional) → Proceed action. The sidebar shows, top to bottom: a **Stack contents** card (empty-state message or stat tiles for the selected stack), a **Destination summary** card mirroring the live state, and an **"After you proceed"** informational card listing the upcoming steps. See UC-1 through UC-9.

## 8. Functional requirements

### FR — Region, Organization, and Stack selection
- **FR-1.1:** The system MUST provide a Region dropdown for the destination, using the same set of available Contentstack regions as the Source feature.
- **FR-1.2:** The system MUST provide an Organization dropdown whose options are scoped to the selected Destination Region.
- **FR-1.3:** The system MUST provide a Stack dropdown whose options are the existing stacks in the selected Organization, plus a **"Create a new stack"** option.
- **FR-1.4:** Selecting "Create a new stack" MUST open a modal with a required "Stack name" input and an optional "Stack description" field, plus "Cancel" and "Create stack" actions; "Create stack" MUST stay disabled until Stack name is non-empty.
- **FR-1.5:** Confirming "Create stack" MUST create the stack, set it as the selected destination Stack, and close the modal. If the entered Stack name collides with an existing stack name in the organization (or is otherwise invalid per Contentstack naming rules), the system MUST show an error stating the name already exists (or is invalid), MUST NOT create a stack, and MUST leave the modal open with the entered values intact for correction (see EC-3).
- **FR-1.6:** Canceling the create-stack modal (via "Cancel" or its close control) MUST NOT create a stack, and MUST leave the Stack dropdown's selection unchanged from before the modal opened.
- **FR-1.7:** Region, Organization, and a Stack (either selected from existing stacks or successfully created) MUST all be required before "Proceed to content mapping" can be enabled.

### FR — Region re-authentication
- **FR-2.1:** Changing the Destination Region to one the user is not currently authenticated against MUST open a login modal requesting Email and Password.
- **FR-2.2:** The modal's Log in button MUST stay disabled until both Email and Password are non-empty.
- **FR-2.3:** Submitting valid credentials MUST establish the session for that region and close the modal.
- **FR-2.4:** Closing the modal without submitting (via its close control or clicking outside it) MUST revert the Region field to its previous value and MUST NOT change the session.

### FR — Import authentication
- **FR-3.1:** The system MUST require exactly one import-authentication method to be chosen before "Proceed to content mapping" can be enabled: **Management token** or **authToken**, each selectable via an always-visible method card.
- **FR-3.2:** Choosing "Management token" MUST reveal a required **"Management token name"** text field (plain text, not a secret/masked field).
- **FR-3.3:** Upon the user clicking "Proceed to content mapping" (with "Management token" as the chosen method), the system MUST create a new management token on the destination stack via the Contentstack Management API, scoped **read and write**, using the entered name, before persisting the destination selection and advancing (resolves former Q-15). If the entered name collides with an existing management token name already on the destination stack, the system MUST show an error stating the name already exists, MUST NOT create a token, and MUST NOT advance past the panel (see EC-13).
- **FR-3.4:** Choosing "authToken" MUST reveal no additional field. Authentication for this path is a deferred, on-demand sign-in at a later step, out of scope for this feature.
- **FR-3.5:** When "Management token" is selected, the system MUST display a dismissible warning: "Important: a management token cannot install apps. Any app in this migration will be installed with your authToken — you'll be asked to sign in before those steps run."
- **FR-3.6:** Selecting the other method at any time MUST discard the previously entered Management token name (if any) for the method being left; no separate "Change" confirmation step exists.
- **FR-3.7:** For the authToken method, whenever a Contentstack region-switch login succeeds (this panel's Region field, or Source's), the system MUST make that user's resulting Contentstack session credential (authtoken or SSO access token) look-up-able by (user, region), so that a later step needing to authenticate as authToken against a given region can reuse it without asking the user to sign in again for a region they've already authenticated. If no credential is on file for the needed region, that later step MUST prompt sign-in at that point instead.

### FR — Branch mapping
- **FR-9.1:** The system MUST show exactly one branch-mapping row, positioned directly above the Language mapping section: the source branch (read-only, locked, inherited from the Source step's branch selection — see DEP-1) paired with a selectable destination-branch dropdown.
- **FR-9.2:** The system MUST NOT show "add" or "remove" controls for branch mapping — there is always exactly one mapping, since there is only one selected source branch.
- **FR-9.3:** The source-branch side MUST be visually marked as locked/read-only (e.g. a "Locked" label) with a tooltip explaining it was set in the Source step.

### FR — Language mapping
- **FR-4.1:** The system MUST show a mandatory master-locale row: the source stack's master locale (read-only, locked, labeled "Master") paired with a selectable destination-locale dropdown, plus explanatory text: "The source master locale is fixed. Choose which locale it becomes in the destination stack, then map any additional locales below."
- **FR-4.2:** The system MUST additionally show zero or more repeatable rows, each pairing a source-locale dropdown (left) with a destination-locale dropdown (right), addable via an "Add language" control.
- **FR-4.3:** The system MUST let the user remove any additional row via a per-row remove control, including down to zero additional rows — this MUST NOT be blocked, and does not affect the master-locale row.
- **FR-4.4:** The Destination summary's "Locales mapped" value MUST reflect a count derived from the master-locale row plus the additional rows. Exact counting formula (e.g. whether the master row counts as 1) is undecided — see Q-16.

### FR — Region-mismatch guidance
- **FR-5.1:** When the selected Destination Region differs from the persisted source's region, the system MUST display an informational banner reading: "Cross-region migration. Content moves from **{srcRegion}** to **{destRegion}**. Confirm data-residency requirements first." This banner is advisory only and MUST NOT by itself block "Proceed to content mapping."

### FR — Gating & primary action
- **FR-6.1:** "Proceed to content mapping" MUST remain disabled until Region, Organization, a Stack (existing or created), and a complete import-authentication method are all set, AND the persisted source is ready.
- **FR-6.2:** While disabled specifically because the source is not ready, the system MUST show the caption "Prepare the source first to continue."
- **FR-6.3:** Clicking "Proceed to content mapping" while enabled MUST, when "Management token" is the chosen import-authentication method, first create the management token (FR-3.3); only on success MUST it then persist the destination selection to the project and advance the user to the next step. If token creation fails (including a name collision, see EC-13), the system MUST show an error, MUST NOT persist the selection or advance, and MUST retain the user's in-progress fields.

### FR — Destination summary
- **FR-7.1:** The system MUST show a live-updating summary of Region, Organization, Stack, Import auth (method), and Locales mapped (count).

### FR — Persistence & API (`/v3`)
- **FR-8.1:** All new endpoints MUST be mounted under the standalone `/v3` router, following the same fully-standalone architecture established by `cs-source-selection` (no reuse of `api/src`/v2 services, controllers, models, or middleware).
- **FR-8.2:** The system MUST persist the destination selection (region, orgId, the selected/created Stack's identity and whether it was newly created — and if so its name/description, the import-authentication method and, for Management token, the entered token name, the destination-branch choice, the master-locale row's destination-locale choice, and any additional language-mapping rows) to the project record so it survives reload (UC-5).
- **FR-8.3:** The system MUST be able to read the persisted source's readiness state, region, selected branch, and master locale for this project (see DEP-1) to drive FR-6.1, FR-5.1, FR-9.1, and FR-4.1.

### FR — Stack contents preview
- **FR-10.1:** The system MUST show a "Stack contents" card in the sidebar, above the Destination summary card, displaying the selected destination Stack's name.
- **FR-10.2:** If the destination Stack has no existing content, the card MUST show: "This stack is empty — everything you migrate will be created fresh."
- **FR-10.3:** Otherwise, the card MUST show a grid of stat tiles reflecting content already in the destination Stack. Exact metrics shown are undecided — see Q-18.
- **FR-10.4:** The system MUST be able to fetch the destination Stack's existing content statistics — this is new capability, not something reused from the Source feature (whose content graph reflects the *source* stack, not the destination).

## 9. Non-functional requirements

- **NFR-1 (Security):** All new `/v3` endpoints MUST require a valid authenticated session, matching the standalone v3 auth middleware. No secret value entered or generated on this panel — including the secret of a system-created management token — MUST appear in logs. (Note: the Management token *name* is not itself a secret and is not subject to this; the token's secret value, returned once by Contentstack at creation, is.)
- **NFR-2 (Security):** Whether the system-generated management token's secret value is persisted (encrypted) after creation, or kept request-scoped only, is undecided — see Q-5 (redefined; this concern no longer applies to a user-supplied credential, since the Management token path no longer asks the user for one). Until resolved, assume the most conservative handling (not persisted in plaintext).
- **NFR-3 (Accessibility):** New controls MUST meet WCAG 2.1 AA; the login modal, method cards, locked/read-only branch and master-locale displays, and locale/branch dropdowns MUST be keyboard-operable and screen-reader-announced as read-only where locked.
- **NFR-4 (Reliability):** A browser refresh mid-configuration MUST NOT lose the destination selection (backed by FR-8.2).
- **NFR-5 (Compatibility):** MUST work on the browsers already supported by the migration UI. Exact matrix `TBD — Open Question` (Q-10).
- **NFR-6 (Observability):** Destination-configuration events (region set, org set, auth method chosen, proceed clicked, proceed blocked-reason) SHOULD be logged with project identifiers, excluding any secret values.

## 10. Data & entities

- **Entity: `Project` (extended)** — MUST gain a persisted `destination` selection: region, orgId, stack (`{ apiKey, name, wasCreated: boolean, description? }` — `wasCreated` distinguishes an existing stack the user picked from one created via UC-7), importAuth (`{ method: 'management' | 'authToken', managementTokenName?, managementTokenUid?, managementTokenSecretRef? }` — for `authToken` no fields are stored here at all, since it's a deferred sign-in; exact shape for the generated token's secret reference is a TRD/security concern, see Q-5), branchMapping (`{ srcBranch (read-only, from source), destBranch }` — singular, not a list), masterLocaleMapping (`{ srcLocale (read-only, from source), destLocale }`), additionalLanguageMappings (`[{ srcLocale, destLocale }]`). Exact field names/shape are a TRD concern.
- **Entity: `Source` (read-only dependency)** — this feature reads, but does not own, the persisted `source` selection from `cs-source-selection` (specifically: readiness/`lastExport.status`, region, selected branch, master locale, and locale list). See DEP-1.
- **Entity: `DestinationStackStats` (read model, new)** — content already present in the selected destination stack, shown in the "Stack contents" card (UC-9). Not persisted; fetched per view. Exact metrics TBD (Q-18).

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** the Destination panel with no fields set
  - **When** the panel loads
  - **Then** Region, Organization, and Stack are empty and required, no import-authentication method is chosen, and "Proceed to content mapping" is disabled.
- **AC-1.2:**
  - **Given** Region, Organization, a Stack (existing or created), and a complete import-authentication method are all set, and the persisted source is ready
  - **When** the user clicks "Proceed to content mapping"
  - **Then** the destination selection is persisted to the project and the user advances to the next step.
- **AC-1.3:**
  - **Given** all destination fields are set but the persisted source is NOT ready
  - **When** the panel is viewed
  - **Then** "Proceed to content mapping" remains disabled and shows "Prepare the source first to continue."
- **AC-1.4:**
  - **Given** the Destination Region differs from the persisted source's region
  - **When** the panel renders
  - **Then** the banner "Cross-region migration. Content moves from **{srcRegion}** to **{destRegion}**. Confirm data-residency requirements first." is shown.
- **AC-1.5:**
  - **Given** the Destination Region equals the source's region
  - **When** the panel renders
  - **Then** the cross-region banner is not shown.

### AC for UC-2

- **AC-2.1:**
  - **Given** the user is authenticated for region A
  - **When** they select region B in the Destination Region dropdown
  - **Then** a login modal opens with Email and Password fields, and Log in is disabled.
- **AC-2.2:**
  - **Given** both Email and Password are non-empty and valid
  - **When** the user clicks Log in
  - **Then** the session is established for region B, the modal closes, and the Region field shows B.
- **AC-2.3:**
  - **Given** the modal is open
  - **When** the user clicks the close control or clicks outside the modal
  - **Then** the Region field reverts to region A and no session change occurs.

### AC for UC-3

- **AC-3.1:**
  - **Given** no import-authentication method is chosen
  - **When** the panel renders
  - **Then** the two method cards ("Management token", "authToken") are shown with their descriptions, both directly selectable, and "Proceed to content mapping" is disabled.
- **AC-3.2:**
  - **Given** the user selects "Management token"
  - **When** the method is chosen
  - **Then** a required "Management token name" text field appears, plus a dismissible warning that management tokens cannot install apps and that app installation will require an authToken sign-in later.
- **AC-3.3:**
  - **Given** the user selects "authToken"
  - **When** the method is chosen
  - **Then** no additional field appears.
- **AC-3.4:**
  - **Given** "Management token" is selected with a name entered
  - **When** the user selects "authToken" instead (or vice versa)
  - **Then** the panel switches immediately (no separate confirm step) and the previously entered Management token name is cleared.
- **AC-3.5:**
  - **Given** a Management token name has been entered
  - **When** the user clicks "Proceed to content mapping"
  - **Then** a new management token is created on the destination stack via the Contentstack Management API, scoped read and write, using the entered name, before the destination selection is persisted and the user advances.
- **AC-3.6:**
  - **Given** a Management token name has been entered that collides with an existing token name already on the destination stack
  - **When** the user clicks "Proceed to content mapping"
  - **Then** an error is shown stating the name already exists, no token is created, and the user does not advance past the Destination panel.

### AC for UC-4

- **AC-4.1:**
  - **Given** the persisted source exposes a master locale
  - **When** the Destination panel renders
  - **Then** a master-locale row is shown with the source's master locale read-only/locked and a destination-locale dropdown to choose, plus the explanatory text about the source master locale being fixed.
- **AC-4.2:**
  - **Given** the master-locale row is rendered with no additional rows configured
  - **When** the panel loads
  - **Then** zero additional language-mapping rows are shown (only the master-locale row).
- **AC-4.3:**
  - **Given** any number of additional rows exist (including zero)
  - **When** the user clicks "Add language"
  - **Then** a new empty additional row is added, with source-locale on the left and destination-locale on the right.
- **AC-4.4:**
  - **Given** one or more additional rows exist
  - **When** the user clicks a row's remove control
  - **Then** that row is removed, even if it is the last additional row, and the master-locale row remains unaffected.

### AC for UC-5

- **AC-5.1:**
  - **Given** a destination selection was previously persisted for the project
  - **When** the user reloads the Destination panel
  - **Then** Region, Organization, Stack, the chosen import-authentication method (with its non-secret fields), all branch-mapping rows, and all language-mapping rows are restored to their persisted values.

### AC for UC-6

- **AC-6.1:**
  - **Given** a Destination Organization is selected with at least one existing stack
  - **When** the user opens the Stack dropdown
  - **Then** it lists the existing stacks in that Organization plus a "Create a new stack" option.
- **AC-6.2:**
  - **Given** the Stack dropdown is open
  - **When** the user selects an existing stack
  - **Then** that stack is set as the destination Stack and no modal appears.

### AC for UC-7

- **AC-7.1:**
  - **Given** the Stack dropdown is open
  - **When** the user selects "Create a new stack"
  - **Then** a modal opens titled "Create a new stack" with a required "Stack name" input, an optional "Stack description" field, and "Create stack" disabled.
- **AC-7.2:**
  - **Given** the create-stack modal is open with a non-empty Stack name
  - **When** the user clicks "Create stack"
  - **Then** the stack is created, set as the selected destination Stack, and the modal closes.
- **AC-7.3:**
  - **Given** the create-stack modal is open
  - **When** the user clicks "Cancel" or the close control
  - **Then** no stack is created, the modal closes, and the Stack dropdown's selection is unchanged from before the modal opened.
- **AC-7.4:**
  - **Given** the create-stack modal is open with a Stack name that collides with an existing stack name in the organization (or is otherwise invalid per Contentstack naming rules)
  - **When** the user clicks "Create stack"
  - **Then** an error is shown stating the name already exists (or is invalid), the modal remains open with the entered values intact, and no stack is created.

### AC for UC-8

- **AC-8.1:**
  - **Given** the persisted source exposes which branch was selected in the Source step
  - **When** the Destination panel renders
  - **Then** exactly one branch-mapping row is shown, positioned directly above the Language mapping section, with the source branch read-only/locked (labeled "Locked") and a destination-branch dropdown to choose.
- **AC-8.2:**
  - **Given** the branch-mapping row is rendered
  - **When** the user inspects it
  - **Then** no "add" or "remove" control is present.

### AC for UC-9

- **AC-9.1:**
  - **Given** a destination Stack is selected
  - **When** the "Stack contents" card renders
  - **Then** it shows the selected Stack's name.
- **AC-9.2:**
  - **Given** the selected Stack has no existing content
  - **When** the "Stack contents" card renders
  - **Then** it shows "This stack is empty — everything you migrate will be created fresh."
- **AC-9.3:**
  - **Given** the selected Stack has existing content
  - **When** the "Stack contents" card renders
  - **Then** it shows a grid of stat tiles reflecting that content instead of the empty-state message.

## 12. Edge cases & error scenarios

- **EC-1:** User has zero accessible organizations in the chosen Destination Region → the Organization dropdown shows an empty state and "Proceed to content mapping" stays disabled.
- **EC-2:** Required field missing (Region/Org/Stack/import-authentication fields not all set) → "Proceed to content mapping" stays disabled; no request is sent.
- **EC-3 (RESOLVED):** A new stack's name is invalid per Contentstack naming rules, or collides with an existing stack name in the org → the system shows an error stating the name already exists (or is invalid), the create-stack modal stays open with the entered values intact, and no stack is created. (Former Q-12; no auto-suffixing or silent renaming.)
- **EC-4:** Invalid credentials submitted in the region-switch login modal → a user-visible error is shown, the modal stays open, and the region is not switched.
- **EC-5:** Network failure or timeout while listing organizations, stacks, or branches, creating a new stack, creating a management token, or persisting the destination selection → the loading state ends, an error is shown, and the user's in-progress selection is retained for retry.
- **EC-6:** The persisted source becomes ready *while* the user is already on the Destination panel → "Proceed to content mapping" MUST enable live, without requiring a page reload.
- **EC-7 (RESOLVED):** User removes every additional language-mapping row, leaving zero — this is allowed and does not need special handling; the master-locale row is separate and always guarantees at least one locale mapping overall. (Former Q-6.)
- **EC-8:** Destination Region equals the source's region → no cross-region banner (explicit negative case of FR-5.1 / AC-1.5).
- **EC-9:** User switches import-authentication method after entering a Management token name for the previously chosen method → that value is discarded, not silently retained/submitted.
- **EC-10:** The selected Destination Organization has zero existing stacks → the Stack dropdown shows only the "Create a new stack" option (no existing-stack entries).
- **EC-11 (RETIRED — no longer applicable):** Branch mapping no longer has an "add"/"remove" affordance at all — there is always exactly one branch mapping, so "removing the last row" cannot occur. (Former Q-13, now moot.)
- **EC-12:** The selected destination Stack was just created via UC-7 → it starts with only its default `main` branch, so the branch-mapping's destination-branch dropdown options are limited to `main` until Contentstack branches are created on that stack out-of-band (see A-5).
- **EC-13 (RESOLVED):** The entered Management token name collides with an existing management token name already on the destination stack → at token-creation time (on clicking "Proceed to content mapping"), the system shows an error stating the name already exists, does not create a token, and does not advance past the Destination panel. (Former Q-19; no auto-suffixing or reuse of the existing token.)
- **EC-14:** Fetching the destination Stack's existing content statistics (for the "Stack contents" card, UC-9) fails or times out → exact fallback behavior (retry control, generic error message, silently showing the empty-state copy) is `TBD — Open Question` (Q-18).

## 13. Dependencies & integrations

- **DEP-1:** The persisted `source` selection from `cs-source-selection` (`../cs-source-selection/feature.md`) — specifically its readiness state, region, **selected branch**, **master locale**, and locale list. Read-only dependency; contract not yet frozen there (that spec's own `TQ-1`) — a blocking risk for this feature (see R-1). The branch and master-locale fields are new reliance introduced by this update (UC-4, UC-8) — confirm `cs-source-selection`'s persisted schema actually exposes both (it already lists `branch` in its proposed shape; master locale is not yet confirmed there).
- **DEP-2:** The standalone `/v3` architecture, auth middleware, and conventions established by `cs-source-selection` (contract owner: v3 API, same as that feature's DEP-1).
- **DEP-3:** Contentstack Management API — for region/organization/stack listing, for **creating a new management token** (read/write) on the destination stack, and for fetching the destination stack's existing content statistics (UC-9).
- **DEP-4:** The shared design-system components (`Select`, `Input`, `Button`, `Badge`, `Toast`) consumed by the v3 UI — not owned here.
- **DEP-5 (forward dependency):** The (not-yet-specified) Content Mapping feature will consume this feature's persisted `destination` selection — contract to be agreed before Content Mapping's spec, mirroring the DEP-7 relationship in `cs-source-selection`.
- **DEP-6:** The real Audit step (Source → **Audit** → Destination → Content Mapping → Migrate) precedes this feature in the actual product flow but is not itself specified here — see Q-1 for how its output relates to this feature's gating.
- **DEP-7 (new):** Whatever later step actually runs the migration/import (out of scope here, see §5) will consume: for Management token, this feature's created token identity/secret; for authToken, the per-user/per-region Contentstack session credential looked up via FR-3.7/DEP-8. Both are contracts that need agreeing once that later step is specified, similar in spirit to DEP-5.
- **DEP-8 (new):** A per-user/per-region Contentstack session-credential store (capturing the authtoken/access_token obtained whenever a region-switch login succeeds) — needed by FR-3.7. This is very likely a **shared need with `cs-source-selection`**, since Source's own region-scoped Contentstack calls (listing orgs/stacks/branches per region) presumably need the same per-region credential lookup, and Source also has its own region-switch login. Whether this already exists there, needs to be built new by Destination, or should be centralized as shared v3 infrastructure is unresolved — see Q-20.

## 14. Assumptions & constraints

- **A-1:** This feature is Contentstack-destination only (branch `feature/cs-to-cs`), following the same standalone-`v3` architecture as `cs-source-selection`.
- **A-2:** No default Region is pre-selected for the destination (no default was observed in the design reference, unlike Source's stated `main` branch default).
- **A-3:** The region-switch login modal is assumed to apply to the Destination Region field the same way it appears to for Source's Region field in the shared design — though `cs-source-selection/feature.md` does not itself document this behavior. Ownership of this modal (shared component vs. duplicated per panel) is unresolved — see Q-7.
- **A-4:** All new endpoints (beyond reusing Source's already-spec'd listing endpoints where applicable) live under the `/v3` prefix, fully standalone.
- **A-5:** A newly created stack (UC-7) starts with only Contentstack's default `main` branch; it has no other branches until created out-of-band directly in Contentstack. See EC-12.
- **A-6 (resolves former Q-3):** The design confirms a new destination stack is created immediately when the user confirms the "Create a new stack" modal (UC-7) — not deferred to "Proceed" or to migrate-time. Former Q-3 is resolved by this; the only remaining related question is whether the create-stack call itself is synchronous/blocking in the API (a TRD concern).
- **C-1:** Must consume only the existing v3 design-system components; no new component library is introduced by this feature.

## 15. Risks

- **R-1:** The persisted `source` schema this feature depends on (DEP-1) is not yet frozen — likelihood medium / impact high — coordinate the schema freeze with the Source feature's owners before implementation.
- **R-2:** If this feature's "source ready" gate reads only the raw export/extract status rather than the Audit step's output, a user could proceed to content mapping on content that Audit would have excluded — likelihood medium / impact high — resolve via Q-1 before TRD.
- **R-3:** The Management token path now has the system **create a new read/write credential on the user's destination stack automatically**, rather than just storing one the user typed in — this is a materially bigger risk surface than before: a bug that creates tokens repeatedly, fails to clean up unused tokens, or mishandles the returned secret has real security consequences on a customer's live stack — likelihood medium / impact high — never log the generated secret, resolve persistence-vs-request-scoped handling early (Q-5). Token creation timing is resolved (Q-15): it happens as part of clicking "Proceed" itself, with no separate confirmation step — a failed creation (including a name collision, EC-13) MUST cleanly block Proceed rather than leaving the destination selection partially persisted.
- **R-4:** The design reference's "After you proceed" copy (listing "Audit" as the immediate next step) conflicts with the real product's tab order, where Audit already precedes Destination — likelihood medium / impact medium — confirm correct next-step copy before implementation (Q-2) rather than shipping the design's copy verbatim.
- **R-5:** The per-user/per-region Contentstack credential lookup the authToken path needs (FR-3.7) is very likely also needed by `cs-source-selection` for its own region-scoped Contentstack calls — if each feature builds its own version independently, that's duplicated, possibly inconsistent infrastructure for the same underlying need — likelihood medium / impact medium — coordinate with Source's owners before building (Q-20).

## 16. Open questions

- **Q-1:** Does "Proceed to content mapping" gate on the source's raw export/extract completion alone, or on the separate Audit step's completion/output? — owner: Eng — needed by: TRD.
- **Q-2:** The design's "After you proceed" preview lists "Audit" as the next step, conflicting with the real product order (Audit precedes Destination). Confirm the correct next-step copy/sequence. — owner: Design/Product — needed by: TRD.
- **Q-3 (RESOLVED — see A-6):** Whether the new destination stack is created at "Proceed" or deferred is resolved: the design shows it's created immediately when the user confirms the "Create a new stack" modal (UC-7).
- **Q-4 (LARGELY RESOLVED):** The Management token field's copy is now known — label "Management token name", placeholder "e.g. eu-marketing-import", hint "Name of the management token configured on the destination stack" — and authToken shows no field at all. Remaining open item: the hint text reads as if referencing an *existing* token, but the confirmed behavior is that the system *creates* a new one with that name — the hint copy likely needs updating for clarity. — owner: Design — needed by: copy finalization.
- **Q-5 (REDEFINED):** Is the *system-generated* management token's secret value (returned once by Contentstack at creation) persisted (encrypted) after creation, or kept request-scoped only? (No longer about a user-supplied credential — the Management token path no longer asks the user for one.) — owner: Eng/Security — needed by: TRD.
- **Q-6 (RESOLVED):** Minimum number of language-mapping rows is resolved: the master-locale row is mandatory and separate; the additional rows can be removed down to zero without leaving the destination with no locale mapping overall. See EC-7.
- **Q-7:** Is the region-switch login modal a shared component (reused by both Source and Destination), or does each panel implement its own? `cs-source-selection`'s frozen spec does not document this behavior despite it appearing in the shared design. — owner: Eng — needed by: TRD.
- **Q-8:** Success-metric threshold for G-1 (completion-rate target). — owner: Product — needed by: PRD.
- **Q-9:** Named stakeholders (PM, Design lead, QA lead) for this feature. — owner: Chirag Chavan — needed by: engineering start.
- **Q-10:** Exact supported browser matrix (NFR-5). — owner: Product/QA — needed by: test-case stage.
- **Q-11:** Final persisted `destination` schema shared with the (future) Content Mapping step. — owner: Eng — needed by: that feature's spec (DEP-5).
- **Q-12 (RESOLVED):** Invalid or colliding new-stack name handling is resolved: the system shows an error that the name already exists (or is invalid); no auto-suffixing. Exact Contentstack naming-rule constraints (character/length limits) remain a minor implementation detail, not blocking — owner: Eng — needed by: TRD (EC-3).
- **Q-13 (RETIRED — moot):** Branch mapping no longer has a removable-row concept at all (EC-11); this question no longer applies.
- **Q-14 (NARROWED):** The Destination summary sidebar's stack-related label still literally reads "New stack" in the design even though the Stack field now also supports selecting an *existing* stack (UC-6) — confirm whether that label should be updated (e.g. to "Stack"). (The "Branches mapped count" half of this question is now moot — there is always exactly one branch mapping, so no count is meaningful.) — owner: Design — needed by: TRD.
- **Q-15 (RESOLVED):** Management-token creation is triggered on clicking "Proceed to content mapping" — not on name entry, not deferred to migrate-time — owner: Eng — needed by: TRD (UC-3, FR-3.3).
- **Q-16 (new):** Exact formula for the Destination summary's "Locales mapped" count now that there's a mandatory master-locale row plus optional additional rows — does the master row count as 1? — owner: Eng/Design — needed by: TRD (FR-4.4).
- **Q-17 (new):** Does an unset destination choice on the master-locale row (UC-4) or the branch-mapping row (UC-8) actually block "Proceed to content mapping"? Neither is currently listed in the FR-6.1 gating condition. — owner: Eng/Product — needed by: TRD.
- **Q-18 (new):** Exact stat tiles shown in the "Stack contents" card (UC-9) — which metrics (content types? entries? assets?), and the fallback behavior if fetching them fails (EC-14). — owner: Design/Eng — needed by: TRD.
- **Q-19 (RESOLVED):** Management-token-name collision is handled by showing an error that the name already exists — no auto-suffix, no reuse of the existing token — owner: Eng — needed by: TRD.
- **Q-20 (new):** Is the per-user/per-region Contentstack credential store (FR-3.7, DEP-8) already planned/built as part of `cs-source-selection` (which needs the same per-region lookup for its own Contentstack calls), or does it need to be built fresh here, or centralized as new shared v3 infrastructure? Building it twice, inconsistently, in both features would be a real risk. — owner: Eng — needed by: TRD, coordinated with `cs-source-selection` owners.

## 17. Out-of-band references

- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**, **Destination panel** only (region/org/stack selection with the "Create a new stack" modal, persistent import-authentication cards with the Management-token-name field and apps warning, the locked-source-branch mapping row, the locked-master-locale mapping row plus additional rows, the new "Stack contents" card, region-mismatch banner, Destination summary sidebar, "After you proceed" preview, and the region-switch login modal). Source panel, the bottom activity console, and the Source panel's own branch-picker modal ("Which branch do you want to export?") on the same page are out of scope (covered by `../cs-source-selection/feature.md`) — note that this feature now *depends on* that Source branch-picker's output (DEP-1) even though it doesn't own it.
- `../cs-source-selection/feature.md` — sibling spec this feature depends on (DEP-1).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
