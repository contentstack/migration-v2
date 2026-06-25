# <Feature> — Jira tickets

Slug: `<feature-slug>` · Source: `prd.md` + `trd.md` · Stage 3 (feature-jira)

## Epic

- **Summary:** <epic summary — one line>
- **Description:** <what the feature delivers and why; link the PRD/TRD>
- **Goal:** <the done-state outcome the epic closes on>

## Stories

| Key | Summary | Layer | Estimate | Depends on |
|---|---|---|---|---|
| — | <parser package changes> | A | TBD | — |
| — | <upload-api wiring> | B | TBD | A |
| — | <api transform> | C | TBD | A |
| — | <ui registration> | D | TBD | — |
| — | <verification / smoke> | Verification | TBD | A, B, C, D |

> `Key` stays `—` until the push fills it (Step 4). Drop any row for a layer the TRD does not touch.

### Per-story detail

#### <Story summary — Layer A parser>
- **Description:** <what changes in `upload-api/migration-<cms>/`>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Layer:** A — parser package
- **Dependencies:** <e.g. none>

#### <Story summary — Layer B upload-api wiring>
- **Description:** <createMapper/validators switches + controller/validator dirs + `file:` dep>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Layer:** B — upload-api wiring
- **Dependencies:** <e.g. A>

#### <Story summary — Layer C api transform>
- **Description:** <`<cms>.service.ts` + CMS enum + BOTH migration.service switches>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Layer:** C — api transform
- **Dependencies:** <e.g. A>

#### <Story summary — Layer D ui registration>
- **Description:** <`legacyCms.json` `all_cms` entry + optional doc url>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Layer:** D — ui registration
- **Dependencies:** <e.g. none>

#### <Story summary — Verification>
- **Description:** <parser build, both migration.service switches present, end-to-end migration of the sample>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Layer:** Verification
- **Dependencies:** A, B, C, D

## Created issues

Filled after a successful Jira push (Step 4).

| Key | URL |
|---|---|
| — | — |
