# PRA Drafter - product spec (v1)

See `BUILD-DECISIONS.md` for owner-approved decisions that override or clarify this spec.

## Purpose and scope
The PRA creator drafts the control enhancement sections of a FinCrime Product Risk Assessment (PRA) in the house style of an approved PRA, from the requirements register and controls library. It adds this as one feature inside the existing fincrime.mema app.

In scope for v1:
- Upload an approved PRA and extract its section skeleton and house style.
- Import a requirements register (xlsx) and hold the rows as a controls library with tags.
- Show, for a new product, which controls exist, which need adapting, and where there are gaps.
- Draft each section's control enhancements, with Evidence fields and placeholders for missing facts.
- Review every draft with code checks and a judge model, shown on screen.
- Edit in an on-page viewer and export to .docx.

Out of scope for v1: inherent and residual risk scoring, ratings and sign-off; gap analysis from policies alone; Q&A over the policy library; per-client workspaces. The tool is single-purpose, not multi-client.

Design rule: code does everything that can be done deterministically. A cheap model writes prose, suggests merges and tags, and judges style. The model never decides whether a control is needed and never supplies a fact that is not in the inputs.

## User workflow
Five steps take a user from an approved PRA to a Word draft. Steps 1 and 2 are one-off setup; steps 3 to 5 repeat per product.
1. Set the standard. Upload an approved PRA (docx, md or html) and the style brief. The app extracts the section skeleton, field labels and standard wording, and stores the control enhancements as exemplars.
2. Load the register. Upload the requirements register (xlsx). The app maps columns, validates the data, shows issues to resolve, then tags each row.
3. Start a PRA. Enter the product name, a short product description, the legal entity and the customer types in scope (natural person, legal person or both). The app lists candidate controls grouped as reuse, adapt or gap. The user ticks what applies and confirms any proposed merges.
4. Draft. The app builds the skeleton, assigns controls to sections, writes each enhancement and rationale, fills Evidence fields and inserts placeholders.
5. Review and export. The draft opens in the page viewer with reviewer flags per control. The user edits in place, accepts or rejects suggested fixes, and exports to .docx.

A user can mark a finished, approved enhancement as an exemplar. It then joins the style set for future drafts.

## Supported uploads
The app accepts .md, .html, .docx and .xlsx. Every upload is converted to one internal structure: an ordered list of headings, paragraphs, lists and tables, each keeping its source position.

| Format | Used for | Parsing approach |
|---|---|---|
| .docx | Approved PRAs, policies, procedures | Read with a docx library (e.g. mammoth). Keep heading levels, lists and tables. Ignore tracked changes unless accepted. |
| .md | PRAs, style brief, policy extracts | Parse with a markdown parser. Markdown tables become tables. |
| .html | Exported pages (e.g. Confluence) | Strip scripts and styles, then map h1 to h6, p, ul/ol and table to the internal structure. |
| .xlsx | Requirements register, controls library | Read with an xlsx library (SheetJS or exceljs). User picks the sheet; the header row is detected, not assumed to be row 1. |

Rules that apply to every format:
- Store the original file unchanged, plus the parsed version and a content hash.
- Detect the document type on upload (PRA, register, policy, style brief) and ask the user to confirm it.
- A register must always be the raw spreadsheet. A markdown summary of a register is rejected as a register, because summaries drop columns such as Control Review Notes and can add artifacts such as "[cite: 6]".
- Formula errors (#REF!, #N/A, #VALUE!) are kept as errors, never read as text values.

## Data model
Seven entities cover v1. Everything a draft depends on is versioned, so any past draft can be reproduced.

| Entity | Holds | Key fields |
|---|---|---|
| Document | Every upload | id, type, filename, format, hash, uploaded_at, parsed_content |
| Template | Skeleton from an approved PRA | id, source_document_id, version, sections (number, title, customer_type, standard_wording, empty_section_wording), field_labels |
| StylePack | House style | id, version, rules, banned_phrases (with replacements), tense_rule, length_limits, exemplar_ids |
| Exemplar | One approved control enhancement | id, section_type, control_text, rationale, source (template or user-approved) |
| RegisterRow | One imported register row | id, register_version, req_id, all mapped columns, validation_issues |
| Control | A library entry built from one or more rows | id, title, req_ids, backoffice_control, tags, coverage, agreed_wording, used_in (list of PRA ids) |
| PRA | One product's draft | id, product, description, entity, customer_types, template_version, stylepack_version, sections, status, created_at |

A PRA section holds its control enhancements. Each enhancement stores: the control ids it covers, control_text, rationale, backoffice_control_label, evidence_refs, placeholders, review_result and edit history.

Store the model name and prompt version with every generated field.

## Register import
Columns are mapped by header name, never by position, through a saved mapping the user can edit. Each column gets one role; columns with no role are stored but unused.

| Role | Columns |
|---|---|
| Filter | Applicability, Obligation vs Guidance, Group 2LOD Status, Complete for PRA + Procedures? |
| Section and tags | FinCrime Area, Applicable control from Back Office (BO), Jurisdiction, Source regulation, Fincrime Product |
| Reuse, adapt or new | Control coverage assessment |
| Draft input | Obligation description, Control Review Notes, Control Uplift / Amendment, Remediation on identified gaps |
| Evidence | Regulatory requirement ID, Requirement reference, BackOffice Linkage - ID, Scoping FinCrime Ticket |
| Reference only | Requirement (original language), Requirement (translation), Rationale, Rationale for decision, BackOffice Reconciliation Comment |
| Unused | Status and owner workflow columns (Phase, Current Owner, named status columns, prioritisation) |

Default inclusion filter (editable per PRA):
- Applicability is "Applicable to Revolut".
- Obligation vs Guidance starts with "Obligation", unless the user includes guidance.
- Group 2LOD Status is "Revision Complete".
- Complete for PRA + Procedures? is used only when it holds a valid value.

The "Rationale" column explains why coverage was partial. It is never used to write a PRA rationale, because that produces gap-log wording instead of a risk explanation. It is shown to the user as context only.

### Import validation
Every import ends on a validation screen listing issues by severity. Blocking issues must be resolved or overridden before rows enter the library; warnings are shown and logged.

| Check | Example from the sample register | Severity |
|---|---|---|
| Expected column missing | Scoping FinCrime Ticket, RBUK 2LOD Status and Notes, Group 1LOD Status and Notes absent (33 of 38 headers found) | Warning, blocking if the column has a role |
| Formula error in a used column | #REF! in Complete for PRA + Procedures? and Current Owner on every row | Blocking for filter columns, warning otherwise |
| Placeholder value in a tag column | Fincrime Product is "N/A" | Warning |
| Contradiction between columns | REQ-0002 is "Applicable to Revolut" but BackOffice Reconciliation says "Marked Out of Scope" | Blocking until the user picks |
| Duplicate REQ ID | Same ID on two rows | Blocking |
| Empty draft input | No Control Review Notes, Uplift or Remediation text | Warning; the control drafts as a placeholder |
| Translation equals original | Requirement (translation) identical to original | Info only |

Contradiction rules are configurable pairs of columns and values. The app never resolves a contradiction itself.

## Controls library and tagging
Each control carries two kinds of tag: code tags read directly from register columns, and suggested tags from the model that the user confirms. Only confirmed tags are used for matching.

| Tag | Source | Values |
|---|---|---|
| Back office control | Code: Applicable control from Back Office (BO) | e.g. Customer Due Diligence, Enhanced Due Diligence |
| FinCrime area | Code: FinCrime Area | e.g. CDD |
| Jurisdiction | Code: Jurisdiction | e.g. Lithuania |
| Regulation and reference | Code: Source regulation, Requirement reference | e.g. Art. 14 (2.) (2) |
| Coverage | Code: Control coverage assessment | Yes, Partial, No |
| Products used in | Code: Fincrime Product, plus the app's own record of PRAs | Product names |
| Risk addressed | Model suggestion | Controlled list, e.g. shell banks, nesting, source of wealth, sanctions, payment transparency |
| Customer type | Model suggestion | Natural person, legal person, both |
| Lifecycle stage | Model suggestion | Onboarding, ongoing monitoring, periodic review, exit |

Suggested tags come from a controlled list held in settings; the model may not invent new values. A suggestion shows the phrase it was based on, for example "before onboarding" for lifecycle stage.

The library also proposes merges: rows that share a back office control and risk tag are shown as a candidate group. The user confirms, splits or rejects each group. (Build note: risk tags must be confirmed before merges are proposed on them.)

## Reuse, adapt or new
The coverage column drives the grouping in code; no model is involved in v1. The user makes every final call.

| Coverage value | Group | What the draft does |
|---|---|---|
| Yes | Reuse | Uses the existing control and its agreed wording. |
| Partial | Adapt | Drafts from Control Review Notes, then Uplift, then Remediation, in that order. |
| No | New | Drafts a new control from the same sources; flagged for closer review. |
| Blank or error | Unassessed | Excluded until the user sets a value. |

For each candidate the screen also shows where the control has been used before (product and PRA) and its last approved wording.

A user can add a gap manually: a risk in the product with no control. A gap produces a placeholder enhancement, not model-written control text.

Later phase: the model suggests candidate controls and gaps from the product description. It stays out of v1.

## Template and house style
The approved PRA supplies form only: structure, field labels and tone. Its content is never copied into another product's draft.

Skeleton extraction (code):
- Section headings and numbers, e.g. "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person".
- Each section's standard opening wording, and the wording used when no controls apply.
- The per-enhancement field labels: Control enhancement, Control enhancement rationale, Backoffice control impacted, Evidence of delivery.
- A section-to-back-office-control map, confirmed by the user.

Style rules (StylePack, editable and versioned):
1. One enhancement describes one mechanism: trigger, actor, action, outcome.
2. No enhancement only restates that a policy exists.
3. Scope is stated, as a short list when there are several cases.
4. Rationale explains the risk and the design choice in 2 to 4 sentences; it does not describe a register gap or open with a standard's name.
5. Present tense for how the control works; present perfect only for a delivered build change; "will" only for something not yet live.
6. REQ IDs and article references appear only in the Evidence field.
7. Measured tone: banned-phrase list with plain replacements (e.g. "non-negotiable", "severe", "contagion", "immediate", "rails").
8. No em dashes or en dashes.
9. Control text 60 to 150 words.

Exemplars: 4 to 6 approved enhancements, tagged by section type. A draft sees only the 2 or 3 exemplars matching its section.

## Drafting
Code builds the document; the model writes only two fields per enhancement: control text and rationale.

Code steps:
1. Create the skeleton from the template.
2. Assign each confirmed control group to a section from its back office control and the PRA's customer types. Example: in a legal-person-only product, EDD controls go under the legal person section.
3. Insert the standard empty-section wording where no controls apply.
4. Build Backoffice control impacted and Evidence of delivery from register fields.
5. Number enhancements in section order.

Model step, one call per enhancement, with:
- the style rules and 2 or 3 section-matched exemplars;
- the product description;
- the group's obligation descriptions and draft inputs, in priority order: Control Review Notes, Control Uplift / Amendment, Remediation on identified gaps;
- an instruction to return JSON with control_text, rationale and placeholders.

Fact boundary, enforced in code after generation (see BUILD-DECISIONS for limits):
- Any number, frequency, threshold, role or system name in the output must appear in the inputs. If not, it is replaced with a bracketed placeholder (or flagged) and logged.
- Placeholders are collected into an open-items list per PRA.
- The Rationale register column is never passed to the model.

## Reviewer
Every enhancement passes two checks before the user sees it: code lint first, then a judge model. The reviewer also runs on text pasted in by the user.

Code lint (deterministic):
- banned phrases, with the suggested replacement;
- REQ IDs or article references outside the Evidence field;
- em dashes and en dashes;
- "was" or "will" outside the allowed tense cases;
- word count outside limits;
- unfilled placeholders and formula errors.

Judge rubric (model, one call per enhancement):

| Criterion | Critical |
|---|---|
| Describes a mechanism, not a policy restatement | Yes |
| Trigger, actor, action and outcome present | Yes |
| Rationale explains risk, not a register gap | Yes |
| Scope stated | No |
| Tone measured | No |
| Sits under the right section | Yes |

The judge returns JSON per criterion: pass or fail, the quoted sentence it is based on, the reason, and a suggested rewrite. The quote comes before the verdict in the output. Overall verdict is pass only if every critical criterion passes.

The judge checks style and structure only. It does not assess whether facts are correct.

## Page viewer and editing
The draft renders as a document page laid out like the approved PRA, with a review panel beside it. Keep v1 simple: one page, one panel, no collaboration.
- Each enhancement shows a status marker: pass, minor issues, or critical issues. (An enhancement not yet judged is shown as "not reviewed", never as pass.)
- Selecting an enhancement opens its review in the panel: each criterion, the quoted sentence, the reason and the suggested rewrite.
- "Apply fix" replaces the quoted sentence with the suggestion; the user can edit before saving.
- Control text and rationale are editable in place. Evidence and Backoffice fields are read-only and change only through the register.
- Placeholders are highlighted and listed in an open-items tab.
- Saving an edit re-runs lint immediately and the judge on request.
- A source view shows, for each enhancement, the register rows and fields it was drafted from.

## Word export
Export produces a .docx that matches the approved PRA's headings, field labels and order.
- Generate with the `docx` library, using the approved PRA's styles where it was uploaded as .docx.
- Headings use real Word heading styles, so the document outline and table of contents work.
- Placeholders export in square brackets and highlighted.
- Review flags do not export. The open-items list exports as an optional appendix.
- Export is blocked while any enhancement has a critical review failure (or has not been reviewed), unless the user overrides it; the override is logged.
- File name: product, "PRA draft", date, version.

## Models, hosting and data handling
The writer and the judge use cheap models from different model families, behind one provider interface so either can be swapped by config.

| Role | Candidates (to trial) | Settings |
|---|---|---|
| Writer | Qwen3.8 Max, MiniMax M3 | Low temperature, JSON output |
| Judge | A different family from the writer | Temperature 0, JSON output |
| Tag suggestions | Same as writer | Controlled list only |

- Uploaded material is internal. Route model calls only through a host whose data terms have been checked and approved, not a vendor API by default.
- Log every call: model, prompt version, input hash and output, for reproducibility.
- Set a cost cap per PRA and show token spend per draft.
- Any model change re-runs the calibration set before going live.

## Acceptance criteria and calibration
v1 is done when it produces a correspondent banking draft that passes these checks on the real register.
- Imports the sample register and reports all issues listed under Import validation.
- Extracts the skeleton from the approved PRA with every heading, field label and standard wording intact.
- Places every included control under the correct section, confirmed by a user, with zero manual moves.
- No generated number or frequency appears that is not in the inputs; unsupported roles/system names are flagged.
- Zero lint failures after applying suggested fixes.
- Exported .docx opens in Word with working heading styles.

Judge calibration, before the reviewer is trusted:
1. Label 20 to 30 enhancements by hand, pass or fail per criterion, including borderline cases.
2. Run the judge on them and measure agreement per criterion.
3. Tune the prompt until agreement on critical criteria reaches an agreed threshold (setting).
4. Keep the set and re-run it on any prompt or model change.

## Later phases (not v1)
1. Model-suggested candidate controls and gaps from the product description.
2. Policy library with clause retrieval by Doc ID and section, feeding drafting.
3. Q&A over the library, answering only from sources with citations.
4. Other document types (incident reviews, policy cards), each with its own template and rubric.
