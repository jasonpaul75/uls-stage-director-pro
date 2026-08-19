# ULS Stage Director PRO — Product specification (locked MVP / v1 foundations)

Living document derived from stakeholder decisions through April 2026. Update intentionally when policies change. **Build / release progress:** use **§ Master roadmap checklist (living)** at the top — keep detailed rationale in the sections below.

---

## Purpose

Private, cloud-hosted web (and eventual mobile-first) platform for **Universal Light & Sound (ULS)**. Internal operating system plus a **white-labeled director portal**. Marketing position: proprietary production intelligence—not a generic marketplace.

---

## Master roadmap checklist (living)

**How to use this section:** Tick items when **ULS / App Admin accepts** delivery for production (engineering, ops, or both as noted). **Do not delete** narrative, tables, or policy detail elsewhere—those sections remain the source of truth for *why* and *how shipped*. When scope changes, update **both** this checklist **and** the matching subsection below.

### By major release target

- [ ] **v1 — MVP foundations** accepted for contracted seasons — see **§ MVP scope vs explicit deferrals** (north star list + portal surfaces).
- [x] **v2 — Show media (`web/` engineering)** complete — playlists, uploads, reorder gates, producer media library + cross‑intake import, reference uploads path, waveform / detachable video window posture, RBAC tests and smoke automation — see **§ Show media — v2 (web complete)**.
- [ ] **v2 — Show media (operations / runbook)** — real uploads, SES/S3/WAN, detachable video rigs, counsel-approved limits in the **external operational runbook** — see **Engineering status** under Show media — v2.
- [x] **v3.0 — Diagram workspace baseline** — all items ticked under **§ v3.0 exit checklist**.
- [x] **v3.1+ — Diagram depth & adjacent** — see **§ v3.1+ backlog** (all committed pillar checkboxes **`[x]`**; optional **v3.2+** deferrals noted there).

### v1 MVP — north star capabilities (acceptance)

Tick each line when the capability is **live and accepted** for production (**§ MVP north star capabilities** under **§ MVP scope vs explicit deferrals**).

1. [x] Director intake **wizard → internal queue**
2. [x] **Proposal scaffolding** tied to templates (pricing / tech rider / crew can start basic)
3. [ ] **Payments** phased per **§ Stripe mechanics (build target)**
4. [ ] **Contract upload • DocuSign** status tracking
5. [ ] **Collaborative run-of-show** with producer authority • freeze windows (director read-only, comments off)
6. [ ] **Live event dashboard-lite** • **Flag-it** (informational only)
7. [ ] **Post-event vault pointers** (SmugMug/Pageant Expressions + Castr metadata — phase 1)
8. [ ] **In-app ticketing** routed to production admin escalation

#### v1 acceptance walkthrough *(in order — engineering verify, then ULS tick `[x]`)*

##### 1. Director intake → internal queue

| | |
|---|---|
| **Routes (director)** | `/portal` → **New intake** → `/portal/intake/new` → submit → `/portal?submitted=1` → `/portal/projects/{id}` |
| **Routes (producer)** | `/producer/inbox` (queue list) → `/producer/inbox/{projectId}` (triage) |
| **Queue model** | `Project` rows with `status: INTAKE_SUBMITTED`, newest `submittedAt` first — no separate queue table |
| **Code** | `web/app/portal/intake/new/page.tsx`, `web/app/portal/intake/actions.ts`, `web/app/producer/inbox/page.tsx` |
| **Automated tests** | `cd web && npm test -- --run portal/intake` (8 tests — auth, RBAC, create, notify, revalidate) |

**Engineering note:** The live UI is a **single-page intake form** (not a multi-step wizard). `INTAKE_DRAFT` exists in schema but is unused — submit goes straight to `INTAKE_SUBMITTED`.

**Manual UAT (local or staging):**

1. **Director account** — sign in at `/login` (director must exist; typically created via producer invite).
2. Open **`/portal/intake/new`**, fill **Production name** (required) + optional fields, click **Submit to ULS**.
3. Confirm redirect to **`/portal?submitted=1`** and the new show appears on the dashboard as queued.
4. Sign in as **producer** (`PRODUCER` or `ULS_ADMIN`), open **`/producer/inbox`** — the submission appears at the top.
5. Open **`/producer/inbox/{projectId}`** — intake summary matches what the director entered.
6. *(Optional)* With `SES_FROM_EMAIL` + `INTAKE_NOTIFY_EMAIL` in `.env`, confirm production receives the intake email linking to the inbox row.

**Ops / env prerequisites:** `DATABASE_URL`, `AUTH_SECRET`; SES vars optional (email skipped gracefully if unset).

**ULS sign-off:** Tick **`[x]`** item 1 above when this UAT passes in your production-like environment.

##### 2. Proposal scaffolding (pricing / tech rider / crew)

| | |
|---|---|
| **Routes (producer)** | `/producer/inbox/{projectId}` → **Proposal draft** (`#proposal`) → **Save proposal draft** |
| **Routes (director)** | `/portal/projects/{projectId}` → **Proposal** (`#portal-intake-proposal`) — only when ULS publishes |
| **Data model** | `Project.proposalPricingNotes`, `proposalTechRiderNotes`, `proposalCrewNotes`; `proposalDirectorVisible` gates director view |
| **Code** | `web/components/producer/intake-detail/producer-intake-detail-proposal.tsx`, `web/app/producer/inbox/proposal-actions.ts`, `web/app/portal/projects/[projectId]/page.tsx`, `web/lib/portal-intake-section-nav.ts` |
| **Automated tests** | `cd web && npm test -- --run proposal-actions intake-queue-actions portal-intake-section-nav` (20 tests — RBAC, persist, trim/null, nav anchors) |

**Engineering note:** “Templates” here are **inline worksheet prompts** (textarea placeholders for deposits/milestones, rider cues, crew rhythm) — not separate template files. Producers iterate internally; directors see nothing until **Show proposal notes** is checked under **Director portal visibility** (same form also holds contract/Stripe publish toggles for later items).

**Manual UAT (local or staging):**

1. Open a queued intake as **producer** — **`/producer/inbox/{projectId}`** → jump to **Proposal draft**.
2. Enter sample text in **Pricing**, **Technical / rider**, and **Crew** fields; leave **Director portal visibility** unchecked; **Save proposal draft** → green **Proposal draft saved** banner.
3. Sign in as the **director** on **`/portal/projects/{projectId}`** — confirm the muted “ULS hasn’t opened proposal…” message (no proposal panels yet).
4. As producer, re-open the intake, fill at least one proposal field, check **Show proposal notes (pricing / rider / crew) to directors**, save again.
5. As director, refresh **`/portal/projects/{projectId}`** — **Proposal** appears in section nav; panels show saved copy under **Pricing & milestones**, **Technical & rider cues**, **Crew & rehearsal rhythm**.
6. *(Optional)* As **ULS_ADMIN**, view the same project before publishing — amber preview banner explains unpublished director content.

**Ops / env prerequisites:** Same as item 1 (`DATABASE_URL`, `AUTH_SECRET`); no Stripe/DocuSign required for this slice.

**ULS sign-off:** Tick **`[x]`** item 2 above when this UAT passes in your production-like environment.

---

## Legal & commercial

| Item | Decision |
|------|----------|
| **Legal owner / product signer** | Universal Light & Sound |
| **Commercial model** | Internal ULS platform. **No separate app fee** for directors engaged for production. Revenue flows from contracted **full-service** agreements only |
| **Phased payments (business default)** | Typically **¼–½ due at signing**; **remainder due at mobilization** unless superseded per-project by ULS |
| **Stripe** | **Standard ULS merchant account** (`Stripe Payments` — **Stripe Connect omitted** unless a future payout-splitting scenario requires it). Settlement to ULS **Operational posture:** keep **Dashboard test mode** (`sk_test_…` and matching test webhooks) through **v1 and v2** builds; adopt **`sk_live_…` and live webhooks only after v3 is complete** and ULS accepts production card/payout risk. |

### Stripe mechanics (build target)

- **Phased settlements** implemented with **Stripe Invoices** and/or **Payment Intents**, aligned to contract milestones  
- **Processing fees recovered** via **explicit fee line items** on the invoice and/or **gross-up** on billed amounts  
- Buyer is the paying customer of ULS; **ULS Stripe account receives funds**

---

## Contracts & signatures

| Item | Decision |
|------|----------|
| **Flow** | ULS uploads contract documents • **DocuSign** envelopes • documents stored as **ULS-controlled** artifacts |
| **Attribution** | Platform stores links / metadata • DocuSign is system of record for signature audit trail |

---

## Intellectual property & media stack

| Item | Decision |
|------|----------|
| **Media ownership** | **ULS owns rights** to production media consistent with contracting |
| **Photo galleries** | **Pageant Expressions** + **SmugMug** integration (distribution, watermark/licensing behavior governed **there**) |
| **Livestream** | **Castr** |
| **Client redistribution language** | Standard ULS redistribution copy in contracting (legal owns exact text) |

---

## Insurance & compliance documents

| Item | Decision |
|------|----------|
| **Storage** | **Confidential**. Restricted classification within the platform |
| **Unified retention — platform-held copies** | **36 months after event conclusion** then purge/anonymize per runbook (**legal hold overrides**) |
| **Vendor retention** | DocuSign / SmugMug / Castr / Stripe each retain evidence per **their** terms—align operational practice and client comms accordingly |

---

## Director access cutoff (narrower than data retention)

| Item | Decision |
|------|----------|
| **Director portal access** | **Revoked 90 calendar days after event conclusion** (“conclusion” = contract-defined end milestone—finalize once in Legal SOP). After cutoff, directors **cannot authenticate** nor access project workspaces |
| **ULS/production** | May retain operational visibility **through the 36-month retention window** unless policy tightens sooner |

Ensure **delivery packs** sent to directors (or SmugMug/Castr handoff) wrap **before** day 90 if client self-serve retrieval is promised post-job.

---

## MVP scope vs explicit deferrals

### MVP (north star capabilities)

**Acceptance tracking:** mirrored as numbered **`[ ]`/`[x]`** items in **§ Master roadmap checklist (living)** at the top of this doc — toggle there when ULS accepts each slice for contracted seasons.

Rough vertical slice aligning to early builds:

1. Director intake **wizard → internal queue**  
2. **Proposal scaffolding** tied to templates (pricing / tech rider / crew hints can start basic)  
3. **Payments** phased per Stripe section  
4. **Contract upload • DocuSign** status tracking  
5. **Collaborative run-of-show** with **producer authority** • **freeze windows**: **director read-only, comments OFF**  
6. **Live event dashboard-lite** • **Flag-it** (**informational only**, no SLA)  
7. **Post-event vault pointers** integrating SmugMug/Pageant Expressions + Castr metadata as phase 1  
8. **In-app ticketing** routed to production admin escalation chain  

#### Director portal — intake vs show workspace (v1)

| Surface | Route | Purpose |
|---------|--------|---------|
| **Intake & commercial** | `/portal/projects/[id]` | Submitted intake summary; published proposal; mirrored DocuSign and Stripe as toggled. Directors stay here until ULS confirms **booking secured** (contract + initial payment). |
| **Show workspace** | `/portal/shows/[id]` | Run of show, show-day flags, post-event links; contracts and billing mirrors also surface here when published. Directors with `bookingSecuredAt` set are routed here from Intake. |
| **Support** | `/portal/projects/[id]/support` | Same path before and after booking — in-app tickets to production. |

### Explicitly deferred (not v1)

- Departmental cue-linked **chat**  
- **Offline sync** (**offline client blocks live telemetry** conceptual rule reserved for future)  
- **Multi-venue** orchestration depth  
- **Payroll-grade** workforce accounting  
- **GPS check-in**  
- Dedicated **handler / crew personas** (**phone-only persona policy** reserved—they **do not** ship for v1)

#### Out of roadmap (explicit exclusions)

- **DMX**, **USB/lighting transmitter control**, or any **hardware lighting console** surfaced from ULS SPA — **not pursued**  
- **VirtualDJ** or other DJ‑app coupling — **not pursued**  
- **OBS** integration (WebSocket, local companion, cue/scene/transport control from ULS) — **not in current product build**  
- **Blackmagic**-centric live production integration (switcher/deck/ATEM-style control from ULS) — **not in current product build**  

### Post‑v1 / future version wiring

Product expansion **after MVP (v1) foundations**. Capability groups map to target **semver-style major releases** below (engineering may split minors/patches—this is stakeholder targeting only).

#### Release targets

| Target | Capability | Rationale |
|--------|-------------|-----------|
| **v2** | **Music** + **video** playlists (uploads, reorder, playback); audio via OS default output; video via **separate browser window** for multi-monitor; **producer media library** + **import/copy** across intakes; **director rundown reorder** where booking is secured | Shares storage, RBAC, and rundown UX patterns—ship together so solo operators get full **show media** without a half-released pillar. **`web/` engineering complete — ULS validates limits, playback rigs, SES/S3 posture in the ops runbook.** |
| **v3** | **Scaled stage design** — **2D proportional CAD‑class workspace** (ship iteratively toward full drafting fidelity) | **Core product pillar** for production—not a novelty surface. Capability and accuracy **outrank** minimalist UI; the diagram editor may be **dense, tool‑rich, and detailed** where that serves operators. Largest new surface area after core media primitives. |

Product expansion after **v3** (diagram depth, ops runbook closure, cloud export targets) stays **web-first** unless ULS explicitly reopens hardware or broadcast-app integration scope.

#### Show media — **v2 (web complete)** *(ops: validate uploads, playback rigs, and runbook posture)*

**Music (in-app only — no external DJ software)**  
- **Custom playlists** from per-show uploads plus **producer media library** entries; **import** copies approved cues from the shared library **or from another submitted intake** (**S3 CopyObject** in the attachments bucket — no duplicate upload).  
- **Reorder**: producers always; **directors** may move cues up/down in rundown order when **`bookingSecuredAt`** is set, the playlist is **published** to directors, and portal **access hasn’t expired** (same gate as playback).  
- **Playback** uses normal **browser / OS audio routing** (default output device operator selects in OS). **Approximate waveform strip** from decoded audio aids cue recognition in previews (large files may skip decode client-side per performance cap). Constraints of in‑browser playback and licensing remain governed by Ops + counsel.

**Video (playlists + externally placeable playback)**  
- **Uploads** and **video playlists** with **parity to music playlists** for ordering and curation flexibility.  
- **Playback** intentionally opens in a **separate browser window** (or equivalently detachable playback surface the team standardizes around) so the operator can drag it onto any monitor in extended desktop—for example **LED wall front PC** layouts.  
- **Selecting “display 1–4” from inside the SPA** is **not a committed requirement**: monitor choice stays **Windows/macOS workspace + drag window + fullscreen/OS maximize** driven by ops.

**Director → production reference files (not show playlists)**  
- **Separate** from curated **show media** rundown cues **and** from **confidential** intake attachments / insurance: directors may upload **reference audio/video** production can retrieve from portal intake + show workspaces and producer intake/event detail. Upload policy aligns with broad **music+video MIME** allowances with a sensible per-file cap (engineering runbook mirrors show-media posture). Successful uploads optionally **email production** via the same **`SES_FROM_EMAIL` + `INTAKE_NOTIFY_EMAIL`** path as intake notifications. **Producer inbox CSV export** includes a per-row **director production file count** for queue triage.

**Engineering status:** The `web/` application ships the behaviors above with server-side RBAC tests on critical flows (Vitest); Playwright smoke covers auth shells, public surfaces, webhook ingress stubs, presign/forbidden gates, export CSRF/forbidden posture, etc. Remaining closure is **ULS ops validation** (real files, WAN/S3 latency, detachable video window positioning, SES deliverability, and documenting limits in the **external operational runbook** — see **Support & operations**).

##### v2 show media — operations checklist *(external / ULS)*

Tick when validated outside `web/` engineering; mirror detail in the **operational runbook**.

- [ ] Real **music & video** files through production-like **upload → playlist → playback** flows (sizes, timeouts, codecs within policy).
- [ ] **Detachable video window** exercised on representative **extended-desktop** rigs per operator standard.
- [ ] **SES** deliverability and notify recipients verified for surfaces that mirror intake-style email (including reference uploads where enabled).
- [ ] **S3/WAN** latency expectations and retries documented for staff.
- [ ] Counsel/Ops-aligned **limits and failure playbook** duplicated or linked from **Support & operations**.

#### Scaled stage design (diagram workspace) — **→ v3+**

- **Proportional, to‑scale** diagrams shared between production and directors: stage footprint, truss, fixtures, electrical distribution metaphors, **LED wall placement**, décor blocks, etc.
- **Product stance:** Stage design targets a **full 2D CAD‑class experience** over time—not “lite tooling” by charter. Visual minimalism is **not** a goal when it trades away precision, density of information, or operator speed. Complexity (layers, constraints, snapping, inspectors, legends, typed equipment data) is **welcome** where it matches real floor‑plot workflows.
- **Reference workflow:** ULS’s current Excel plots (modular deck fills, wings and FOH, rigging and fixture layers, rotated elements, and annotation) define the **functional bar** for what “good” looks like—not a pixel match to Excel, but **the same jobs** (readable structure, zones, equipment, and labels on a grid).
- **Committed engineering direction (iterate in releases):**

  - [x] **Multi‑polygon deck / structure** — Modular platforms, wings, thrust; margins, snapping, selection (**axis‑aligned deck modules shipped** — eventual **non‑rectilinear / complex outlines** remain trajectory, not parity requirement for current charter).
  - [x] **2D paint order + drafting layers baseline** — Default SVG order remains **`deckPolygons` → `shapes` → `placements`**. Producers reorder with **`[` / `]`**, **`Shift+[` · `Shift+]`** (**`Home`**/**`End`**), Draw order strip, and optional **`diagramPaintOrder`** in **`canvasJson`**. **`diagramLayers`** / optional per-entity **`layerId`** add a stacking dimension; **Show**, **SVG / PNG / PDF** snapshot exports, and **Select bracket keys** resolve paint via **`diagramPaintRefsForPresentation`** so the saved stack matches pixels. Digit **`1 … 4`** jump **Symbols · Select · Deck · Shapes**; **`5 … 9`** selects placement kinds / shape tools left-to-right.  
  - [x] **Layered drawing — MVP** — Naming, visibility, layer stack ordering, assigning selection, sticky target layer for new strokes; reconcile on parse/save; optional **`diagramLayers[].group`** field: adjacent custom tiers sharing a nonempty **`/`‑delimited path prefix** collapse into nested producer folders (**Hide all** / **Show all** per subtree); **drag** tiers via the **`≡`** grip (**Back** / **Front** unchanged) reorder the authoring stack (**Main** at index **0**); **Duplicate tier** (**⌘/Ctrl+Shift+L** outside typed inputs); picker falls back when sticky disappears; migrate-then-remove for nonempty tiers is wired; preset chips (**+ LX / + Rig / + Notes**); dropping a tier on a nested folder heading assigns **`group`** without reordering flat stack (**slash** folder field stays available); **`bracketReorderLocked`** freezes in-tier **`[` `]`**, **`Home`/`End`**, and Draw-order HUD nudges; producer **Legend** tier strip echoes the sticky **Diagram layers** pick. Fuller constraint systems, reusable template **libraries**, and library-first authoring (retiring slash-typed **`group`**) remain **prioritized backlog**.  
  - [x] **Polylines / paths (foundational)** — **POLYLINE** primitive with multi‑vertex authoring, snapping, persistence in **`canvasJson`** (extended path semantics, cabling metadata: sequenced later).
  - [ ] **Constraint groups**, typed equipment beyond **v3.1 equipment MVP**, richer legend & interchange — **CAD import**, diagram **vector‑first PDF** (`svg2pdf`, raster fallback), fuller **DXF** (MTEXT/metadata/fills vs minimal LINE export) sequenced pragmatically per **§ v3.1+ backlog** and stakeholder priority.  
  - [ ] **3D / revision history / realtime co‑editing** — **explicitly optional / later** (2D depth first preserves ship velocity).
  - [x] **Forward‑compatible `canvasJson`** — **`footprint`**, optional **`deckPolygons`**, versioned snapshots and migrations forward (see engineering note in codebase / migrations).
- **Diagram export (producer floor plot)** — Producer workspace offers **Export SVG**, **Export PNG**, **Export PDF**, **Plot BOM CSV**, minimal **ASCII DXF**, and focused **CSV** slices (**Truss CSV** / **Fixtures CSV** / optional **Fixtures CSV + join** when those placement kinds exist):

  **Export checklist**

  - [x] **Delivery** — Immediate **browser download** (serialization + raster for PNG and raster-embedded PDF; UTF‑8 CSV / DXF ASCII); no queued cloud export job.
  - [x] **Presentation snapshot semantics** — Authoring overlays removed; plot grid stripped; backdrop matches director **Show**; deck parity; selection chrome normalized — **extended prose:** client-side serialization + rasterization match the same presentation rules as **`StageFootprintPreview`** in presentation mode so exports never look stuck in authoring **Select**.
  - [x] **SVG** — Vector output for slides, markup, and print pipelines.
  - [x] **PNG** — ~**1080 px** width proportional height; raster snapshot controls (**PNG**, **PDF**) disabled together while exporting; inline auto-clear notice on failure (**SVG**/**DXF** documented fallbacks — non-blocking).  
  - [x] **PDF snapshot (Letter landscape)** — **`Export PDF`** · **`{slug}.pdf`** — **`svg2pdf.js` + `jspdf`** embed **vector** presentation **SVG** geometry on **US Letter landscape** when conversion succeeds; **`pdf-lib`** raster embed (same framing as **PNG**) as **fallback** — pure vector interchange also **SVG** / **DXF**.
  - [x] **Plot BOM CSV** — Stacked tables separated by blank lines: **symbols** (world XY, rotation°, **`layerId`**, optional **`peer_snap_group`** magnet affinity, **`equipment`** cue/DMX); **drawn shapes** (anchors, tier, **`peer_snap_group`** when present, RECT/LINE extents, condensed **POLYLINE** bend preview); **deck modules** (vertex count, axis-aligned bbox, tier, condensed vertex ring — preview-only nominal deck hull excluded); optional **truss‑only** (**`…-truss-bom.csv`**) and **fixtures‑only** (**`…-fixtures-bom.csv`**) spreadsheets drop shapes/deck and keep only those placement kinds; optional **`…-fixtures-bom-joined.csv`** adds **`bom_join_match`** + **`catalog_*`** columns keyed from the browser fixture library **plus hosted shared presets** (**`/api/producer/fixture-library/shared`** — browser rows win on duplicate labels; **`fixture_preset_label`** match first, else unique **`fixture_id`**); **`{slug}-bom.csv`**; RFC‑4180-ish field escapes  
  - [x] **Minimal ASCII DXF** — **`Export DXF`** · **`…-plot.dxf`**: **`$ACADVER` `AC1015`** subset — **`LINE`** / **`CIRCLE`** / **`ARC`** / **`ELLIPSE`** / **`TEXT`** plus **`MTEXT`** for diagram text labels with newline/TAB payloads and **`LWPOLYLINE`** for closed bounds/deck/rects/shape paths; plot **symbols** emit **`BLOCK`** + **`INSERT`** (per-kind definitions, scale for custom glyph extents, rotation on **50**); diagram ellipses emit **`ELLIPSE`** entities; equal **`rx`/`ry`** emit **`CIRCLE`**; tessellated full-circle closed rings emit **`CIRCLE`**; tessellated arc **POLYLINE** shapes re-export as **`ARC`** when geometry fits, else compact **`LWPOLYLINE`** with bulge **42** on arc chords — open and closed); dense smooth **POLYLINE** paths (≥5 vertices, not bulge-compact) re-export as **`SPLINE`** fit points; filled **RECT** / closed **POLYLINE** / **ELLIPSE** shapes with a **`fill`** emit solid **`HATCH`** (polyline boundary, **`SOLID`** pattern) plus outline entities; diagram world XY (**`$INSUNITS`** feet vs meters); layers split **working plot outline**, **deck**, **annotations**, **symbols**; **`Import DXF…`** merges **`LWPOLYLINE`**, classic **`POLYLINE`**/`VERTEX`/`SEQEND`, **`TEXT`**, **`MTEXT`** (stacked fractions, **`\\U+`** Unicode, column **`\\N`** breaks, sheet-set field unwrap), **`LINE`**, **`CIRCLE`**, **`ARC`** (tessellated to **`POLYLINE`** paths), **`ELLIPSE`** (full spline → diagram **ELLIPSE**; partial spline arcs → **`POLYLINE`**), **`SPLINE`**, **`INSERT`** (explodes **`BLOCKS`**, column/row arrays, skips **`ATTDEF`**/**`SEQEND`**; visible **`ATTRIB`** followers → **`TEXT`**), **`HATCH`** (polyline + line/arc/elliptic/spline edge boundaries → closed **`POLYLINE`**; solid **`70=1`** fill tint; patterned hatches → light fill + clipped pattern **LINE** segments from **ANSI**/embedded **`.pat`** defs), **`SOLID`**/**`3DFACE`**/**`TRACE`** face outlines, **`DIMENSION`** override text → **`TEXT`**; **ASCII or AutoCAD binary DXF** ingest) → diagram shapes (**42** bulge arcs tessellated to vertices within caps)
  - [x] **Filenames** — **`{slug}.svg`** / **`{slug}.png`** / **`{slug}.pdf`** / **`{slug}-bom.csv`** / **`{slug}-plot.dxf`** / **`…-truss-bom.csv`** / **`…-fixtures-bom.csv`** / **`…-fixtures-bom-joined.csv`** sanitized; abbreviated on-plot captions; full labels in producer lists / SVG hover titles where implemented

##### v3.0 exit checklist — diagram pillar baseline (ULS stakeholder sign‑off)

Use this list to declare **“v3.0 diagram slice” closed** for a production season versus pushing items to **v3.1+**. Checkboxes are intentional living state—update when product or engineering commits change.

**Producer authoring (event workspace → Stage design)**

- [x] Real‑world units; **nominal footprint** and **plot margins**; nominal span syncs when **deck modules** exist  
- [x] **Multi‑polygon deck** using **axis‑aligned rectangles** (cap in product/engineering); select / drag / resize where supported  
- [x] **Symbols** (fixture / power / décor / truss / LED) — place, rotate, reorder **within placement stack**, snap + peer tooling  
- [x] **Shapes** — rect / line / ellipse / text; color; resize / rotate where supported; reorder **within shape stack**  
- [x] **Snapping** — grid step, structural magnets, peer alignment (incl. rotation‑aware truss heuristics); **Alt** bypass  
- [x] **Select** workspace — **Multi-select** (**Shift** / **⌘/Ctrl** + click on glyphs or deck list rows toggles membership; **`⌘/Ctrl+A`** selects all symbols/shapes/deck modules — outside typed inputs); duplication, deletion, keyboard nudge, **`[` `]`** / **`Shift+[` `Shift+]`** (**`Home`/`End`** extremes) / Draw order strip (**unified diagram stack** spanning deck · shapes · symbols when custom order persists — see **§ Committed engineering direction** above), **`Ctrl+Shift+V`** paste spreadsheet X/Y → move selection centroid (exact, no snap)  
- [x] **Plot hover coordinates** — live **world X/Y** + **Copy XY** (**`Alt+Shift+C`** tab-separated when hovering the plot — any workspace, outside typed fields)  
- [x] **Workspace shortcuts** — Digit keys **`1 … 4`** jump **Symbols · Select · Deck · Shapes** (toolbar order) when focus is outside typed inputs **·** in **Symbols**, **`5 … 9`** selects placement kinds left-to-right (fixture … décor) **·** in **Shapes**, **`5 … 9`** selects shape tools left-to-right (rectangle … text) (**outside typed inputs**)  
- [x] **Undo / redo** *or* written **carve‑out** that production accepts forward‑only edits for this season  
- [x] **Viewport zoom/pan** *or* written **carve‑out** for dense plots (hardware / workaround documented in runbook)  

**Director parity & routing**

- [x] **Publish diagram to Show workspace** persists server‑side with RBAC isolation  
- [x] Read‑only **presentation** snapshot on Show (no authoring grid); **legend** + deck/margins readouts aligned with producer semantics  
- [x] **Support ticket** path from portal for diagram change requests  

**Export & operations**

- [x] **SVG** + **PNG** + **PDF** presentation exports + **Plot BOM CSV** (`{slug}-bom.csv`) + truss/fixtures slices **`…-truss-bom.csv`** / **`…-fixtures-bom.csv`** (+ **`…-fixtures-bom-joined.csv`** when using catalog joins) + minimal **ASCII DXF** (**`…-plot.dxf`**); snapshot failure UX shared for PNG/PDF; slugged filenames (**Support & operations** runbook cites snapshot rules)  
- [x] **Vitest** for stage save (`canvasJson`: placements/plotMargins/shapes/**deck polygons**) + **`portalStageDiagramSectionVisible`** (same predicate as portal Show workspace + section nav: director visibility vs admin unpublished preview); covered by **`npm test`**. Dedicated **Playwright** for portal Show routing remains optional if App Admin wants browser-level assurance beyond smoke suites  
- [x] **Real‑season / release rehearsal — scaled diagram (2026‑05):** Producer manual QA (**Select**/plot ergonomics post-fix), **director Show read** after publish/handoff, and **SVG + PNG export** verified in production‑like use; **mirror** recap (who/when/export filename expectations) into the external **runbook** when Ops wants a dated audit stub  

**Deferred by charter when v3.0 was defined (historical)**

Non‑rectilinear deck • **Polylines/paths + unified cross-category stacking** — *shipped in current v3.1+ engineering slices (see **§ v3.1+ backlog**)* • **`equipment`** (`role`/DMX) MVP • **Plot BOM CSV** (**symbols · shapes · deck · truss/fixtures CSV slices**) • minimal **ASCII DXF** plot export (**`plot.dxf`** family) • **PDF** snapshot (**raster‑embedded**) • full CAD parity / import • **vector PDF** • 3D / revision DNA / realtime co‑editing

##### v3.1+ backlog (same pillar — prioritize in engineering)

**Shipped (engineering — toggle if re-opened)**

- [x] **POLYLINE** — Multi‑tap authoring, **Enter** to commit, **Backspace** / **Delete** peel last drafted vertex (outside text fields), **Esc** cancels draft; per‑vertex grips + snap peer/structural tooling; rotate/drag path; **double‑click segment** inserts vertex; **Alt+vertex** deletes while **≥2** points remain; persists in **`canvasJson`**  
- [x] **Unified paint stack** — **`[` `]`** / Draw order strip move one step **within the selection’s diagram layer** (deck · shapes · placements can interleave inside that tier); **`Shift+[`** **`Shift+]`** / **`Home`** / **`End`** snap to tier-local bottom/top — reorder **layers** in **`diagramLayers`**. **Show**/exports use **`diagramPaintRefsForPresentation`**; **`diagramPaintOrder`** persists refinement.  
- [x] **Drafting layers — MVP** — **`diagramLayers`** + optional **`layerId`** / optional producer-only **`group`** folder label in **`canvasJson`**; producer layer panel (ordering, visibility, naming, contiguous matching folders, **Duplicate tier** + **⌘/Ctrl+Shift+L** picker shortcut, assigning selection); reconcile on parse/save; parity in **Show** + snapshot exports (**SVG** / **PNG** / **PDF**)  
- [x] **Workspace digit shortcuts — 1 … 4** — jump **Symbols · Select · Deck · Shapes** (toolbar order) when focus is outside typed inputs; aligns with spreadsheet-style accelerator density under **Excel-class ergonomics**  
- [x] **Copy XY keyboard chord** — **`Alt+Shift+C`** when live hover coordinates are shown duplicates **Copy XY** (tab-separated **`wx`** / **`wy`**) in any workspace  
- [x] **Paste XY → position (Select)** — **`Ctrl+Shift+V`** reads clipboard tab/comma/semicolon X/Y (optional **`′`/`m`** suffix strip) and translates the selection centroid to those world coords (exact, no snap)
- [x] **Select multi-select & Select all** — **Shift** / **⌘/Ctrl** + click additive toggle on plotted glyphs and **Deck modules** list (modifiers do not start a drag gesture); **`⌘/Ctrl+A`** in **Select** (outside typed fields) selects every symbol, shape, and user deck polygon; **`Esc`** clears; grouped move excludes intra-selection from peer snap; **`⌘/Ctrl+D`**, **Delete**/ **Backspace**, and arrow nudge apply to the set; **Selection layer** shows disabled **Mixed layers…** when tiers disagree (**`[`** **`]`** / **`Shift+[`** **`Shift+]`** / **`Home`** / **`End`** draw-order keys still require exactly one primitive)  
- [x] **Symbol · shape toolbar digits — 5 … 9** — in **Symbols** / **Shapes** workspaces selects the nth **placement kind** or **shape tool** in left-to-right toolbar order (same **outside typed inputs** guard as **`1 … 4`**)  
- [x] **Placement equipment (`canvasJson`) — MVP** — optional per-symbol **`equipment`** `{ role?, patch?, gel?, fixtureId?, fixtureProfile?, fixturePresetLabel?, dmxUniverse?, dmxChannel? }` (cue/circuit **`role`** on all symbol kinds; **`patch`**/**`gel`** notes on every kind for BOM/SVG titles; optional **`fixtureId`**/**`fixtureProfile`** inventory + beam/data strings; optional **`fixturePresetLabel`** matches browser fixture-library row titles for **`Fixtures CSV + join`** / **`…-fixtures-bom-joined.csv`**; DMX ints on fixtures & LED surfaces — pair shows as **`Uu.ch`** in SVG titles/exports); producer inspector fields; sanitized parse/clamp; Plot BOM CSV **`patch_note`** / **`gel_note`** / **`fixture_id`** / **`fixture_profile`** / **`fixture_preset_label`** columns · **Select** batch apply/clear strips for **`role`**/**`patch`**/**`gel`**/**`fixtureProfile`** alongside **`fixtureId`** + paired DMX (**same universe/channel on each**) plus **sequential channel fill** (**start channel +1 per selected DMX-capable symbol** in placements-list order while span stays ≤512) · **Fixture library (browser)** — per-intake **`localStorage`** (**`uls_fixture_library_presets_v1:{projectKey}`**) named rows (**cue/patch/gel/fixture id/profile** only); **Select** collapsible: save draft / capture-from-selection / apply merge onto selected symbols (**also stamps **`fixturePresetLabel`** from the chosen row**) / remove (**cap 48** rows · label **≤48** chars, same device scope as tier browser presets · **`schemaVersion` 1** **`{slug}-fixture-library.json`** · BOM-aligned **`{slug}-fixture-library.csv`** (**library_label**, **`cue_role`**, **`patch_note`**, **`gel_note`**, **`fixture_id`**, **`fixture_profile`**) interchange (**Export / Import JSON · CSV**) — merges rows with **fresh ids**, skips duplicate labels vs current library · accepts **`version`** **`localStorage`** backups · **hosted tenant-wide presets** (`FixtureLibrarySharedPreset` + `FixtureLibrarySharedAuditLog`; **`GET` / producer **`POST`** merge-append / **`ULS_ADMIN` `PUT`** replace) via **`/api/producer/fixture-library/shared`** · **Import JSON/CSV** opens a confirmation preview before writing browser storage · semicolon-separated CSV headers when comma parse fails · **bulk find/replace** on selected symbols’ equipment strings (**includes **`fixturePresetLabel`**) · **Clear catalog links** strips **`fixturePresetLabel`** on selection · **`Producer pack (.zip)`** bundles presentation **SVG** · **BOM CSV** · **`{slug}-equipment-qa.json`** (structured DMX + catalog join QA) · **`fixture-library.json`** · **`fixture-library.csv`** · **DXF** · **`fixtures-bom-joined.csv`** when fixture symbols exist
- [x] **Plot BOM CSV (producer)** — **`BOM CSV`** → **`…-bom.csv`**: stacked **symbols** + **shapes** + **deck** (blank-line headers; same slug basename as SVG/PNG); optional **`peer_snap_group`** alongside diagram tier on symbols and shapes; rectangles/lines/polylines + deck bbox/vertex weld as documented **`·`** **`Truss CSV`** → **`…-truss-bom.csv`** and **`Fixtures CSV`** → **`…-fixtures-bom.csv`** — truss or lighting fixture placements only (no shapes/deck) respectively; **`Fixtures CSV + join`** → **`…-fixtures-bom-joined.csv`** — fixture-pack symbols plus **`bom_join_match`** / **`catalog_*`** columns from the browser fixture library  
- [x] **Legend depth (diagram readouts)** — drafting **tier** strip bottom→top (calls out tiers hidden in producer); symbol/shape **counts** beside categories on plot; when **equipment** is annotated, footer tallies **cue**, **patch/gel notes**, **fixture ids/profiles**, **paired DMX** with universe-span readout + **duplicate paired-address** collision tally, and **partial DMX**; producer **Equipment QA** compact rail + **`{slug}-equipment-qa.json`** structured export (DMX collision rows · catalog join matched/unmatched preset labels vs merged browser + hosted catalog); **Truss CSV** / **Fixtures CSV** hints when those truss/fixture symbols exist (or alone when plot has truss/fixtures but no equipment captions) — parity in **producer** + portal **Show**  
- [x] **ASCII DXF interchange (MVP)** — producer **`Export DXF`** (**`…-plot.dxf`**) — **`$ACADVER` `AC1015`**; **LINE**, **CIRCLE**, **ARC**, **ELLIPSE**, **SPLINE** (export fit points + import tessellation), **INSERT**/**BLOCKS** (export + import; array copies + visible **ATTRIB**→**TEXT**), **HATCH** (export solid fills on filled shapes + import boundary loops → closed **POLYLINE**; solid-fill tint or patterned **ANSI**/embedded **`.pat`** families → clipped **LINE** segments), **TEXT**, **MTEXT** (import: stacked fractions, **`\U+`** Unicode, column **`\\N`** vs paragraph **`\\P`**; export round-trip with **`\\column{N}`** + **`\\N`**/**`\\P`**), **LWPOLYLINE**, classic **POLYLINE** polyface/polygon mesh → face loops, **SOLID**/**3DFACE**/**TRACE**, **DIMENSION** text, **LEADER**/**MLEADER** (nested **LEADER_LINE** paths + annotation **TEXT**), **WIPEOUT** clip boundaries, **RAY**/**XLINE**→clipped **LINE**; **Import DXF…** accepts **ASCII or AutoCAD binary DXF** (pre-R14 **1-byte** + R14+ **2-byte** group codes) with **`$DWGCODEPAGE`** re-decode (**ANSI_1252** / **1250** / **1251**) on split layers (**`$INSUNITS`** feet vs meters); paired entity-mix toast  
- [x] **PDF snapshot export (producer)** — **`Export PDF`** (**`{slug}.pdf`**) **vector‑first**: **`svg2pdf.js`** / **`jspdf`** Letter landscape **SVG→PDF** with pre-export **rgba→hex + opacity** normalization, **linearGradient**/**radialGradient** flattening, **HarfBuzz subset** of **Roboto** embedded as **ULSDiagramSans** (Helvetica fallback), and diagram label prep; **`pdf-lib`** raster embed fallback (same framing as **PNG**); producer notice when raster fallback applies  
- [x] **XL diagram inspector — Select tier batch** — wide-layout sticky rail adds **Selection tiers** readout (**Mixed tiers** vs unanimous tier label), **Assign tier** control (parity with **Select** strip), **Move to sticky tier** (Symbols / Shapes / Deck sticky **`diagramLayers`** pick), compact **Equipment QA** readout (paired DMX universe span · collision tally · catalog join matched/unmatched), and full **Legend** beside dimensions  
- [x] **Layer panel polish — nested paths + tier drag** — **`diagramLayers[].group`** parses **`/`** segments into collapsible subtrees (**Hide all** / **Show all** per subtree); contiguous tiers sharing a nonempty path‑prefix chunk cluster visually; **`≡`** drag reorder flat stack (**Main** at index **0**); backward-compatible flat (**no slash**) labels as single‑segment folders; **additional:** drop **`≡`** onto folder header assigns **`group`** (stack unchanged); **`+ LX / +Rig / Notes`** palette chips beside **Add layer**; **`bracketReorderLocked`** on tiers (**`diagramLayers[].bracketReorderLocked`** in **`canvasJson`**) freezes **`[` `]` · Home/End · Draw order HUD** primitives inside that tier; producer **Legend** tier strip emphasizes sticky **Diagram layers** pick; **Export tiers JSON** / **Import tiers** (`schemaVersion: 1`) for portable custom-tier stacks (fresh ids on merge); **browser presets** (named stacks in **localStorage** per producer project on this device, cap 24); **hosted org tier presets** (`DiagramLayerSharedPreset` + `DiagramLayerSharedAuditLog`; **`GET` / producer **`POST`** merge-append / **`ULS_ADMIN` `PUT`** replace) via **`/api/producer/diagram-layer-library/shared`** · **Copy tier id** on each custom row; per-tier expandable **Inspector** (**symbols · shapes · deck** counts + **Copy**/ **TSV** primitive **id** excerpts aligned with BOM **`layerId`**); portal + producer **Legend** shows **folder path** + **`lock`** cue on visible tiers (informative on **Show** — no in-browser reorder there)

**Remaining**

- [x] **Layer / stacking — CAD backlog** — **complete for v3.1+ scope:** **hosted org tier preset library** (`DiagramLayerSharedPreset` + audit log; **`GET` / producer **`POST`** merge-append / **`ULS_ADMIN` `PUT`** replace) via **`/api/producer/diagram-layer-library/shared`** · browser **`localStorage`** + JSON import/export · **`xl`** sticky rail — dimensions + **Equipment QA** + legend + pinned **Select** tier summary / **Assign tier** / **Move to sticky tier** beside plot/lists — *deferred to **v3.2+**:* fuller batch-property editor · optional **Show** authoring-adjacent tooling · library-first retirement of slash-typed **`group`**  
- [x] **Typed equipment & legend depth** — **complete for v3.1+ scope:** flat **`equipment`** MVP fields + **`fixtures-bom-joined.csv`** · Plot BOM **`fixture_id`**/**`fixture_profile`**/**`fixture_preset_label`** · legend universe span + collision QA + **fixture catalog join tallies** · producer **Equipment QA** rail · **`{slug}-equipment-qa.json`** ops export · paired-DMX + batch strips + sequential channels + browser + **hosted** fixture presets + **bulk substring replace** + JSON/CSV **import preview** — *deferred to **v3.2+**:* structured equipment payloads beyond flat cue strings (constraint groups, richer typed fields)  
- [x] **Interchange parity** — **progress (complete for v3.1+ scope):** **Producer pack (.zip)** · **SPLINE**/**INSERT**/**BLOCKS**/**HATCH** import+export · **MTEXT** multi-column **`\\N`**/**`\\P`** export round-trip · **binary DXF** (pre-R14 + R14+) + **SOLID**/**3DFACE**/**TRACE**/**DIMENSION** · **LEADER**/**MLEADER** nested **LEADER_LINE**/**WIPEOUT**/**RAY**/**XLINE** · **`$DWGCODEPAGE`** · **vector PDF** rgba→hex + gradient flatten + **Roboto subset embed** + mode reporting  
- [x] **Excel-class ergonomics** — **complete for v3.1+ scope:** **digit accelerators** **`1 … 9`** · global hover **world X/Y** + **Copy XY** / **`Alt+Shift+C`** (tab-separated) · **Select** **`Ctrl+Shift+V`** paste spreadsheet X/Y → move selection centroid (exact, no snap) · **polyline draft peel** (**Backspace** / **Delete**) · **fixture library import preview** · locale **`;`** CSV fallback · selection-scoped equipment substring replace  

Cross-cutting: Engineering maintains forward‑compatible **`canvasJson`** as geometry deepens.

*When everything under **Remaining** is **`[x]`**, mark **§ Master roadmap checklist • v3.1+** as **`[x]`** too—or add **`v3.2+`** (etc.) here for newly committed pillar work instead of overloading **v3.1+** forever.*

---

## Personas — v1

| Role | Scope |
|------|-------|
| **Director** | One org per contracted event • **Isolation**: sees **only assigned project(s)**—never unrelated shows |
| **Producer (ULS)** | Production manager / internal persona • sees **aggregate platform data relevant to operations** — full internal access posture |

Secondary roles (**handlers**, specialists, subcontractors) modeled later.

---

## Access & identity

| Item | Decision |
|------|----------|
| **Directors onboard** | **Invite-only**, **email + password**, self-serve password reset flows |
| **Internal users** | **Invite-only**, **revocable** immediately by **ULS Administrator** |
| **Canonical identifiers** | **Email**, **Legal / preferred name pair** • default notification paths target **Director** + **Production** until delegates added |
| **Delegation** | Both Director & Production realms may grant **narrow subordinate access** respecting least privilege patterns |
| **Admins elevate** | **ULS designates administrative operators** (**Product decision-maker** currently = App Administrator / stakeholder sponsor) |

### Session posture (planned evolution)

Future **handlers** → **mobile-primary / non-admin tooling**. Until those roles exist, prioritize responsive web parity.

---

## Data classification & geography

| Class | Handling |
|-------|----------|
| **Sensitivity** | **No intentionally public datasets** • classify operational + contractual material **restricted / confidential** tiers |
| **Director isolation enforce server-side** | Authorization tests must fail closed  
| **Marketing “E2E encryption” wording** | **Avoid** unless delivering true client-side key custody—ship **TLS + at-rest encryption + strict RBAC** language instead (verify with counsel) |
| **Data residency** | **United States only** (primary region below) |

---

## Branding

| Item | Decision |
|------|----------|
| **Visual language** | Source **universallightandsound.net** • **Arial** • palette **black / gold / white** tuned for contrast |
| **Logo asset** | Repository root **`ULS logo.jpg`** (for deployment rename to slug-friendly `uls-logo.jpg` without spaces) |
| **White-label** | Directors experience **pure ULS chrome** outside **legally required / acceptable vendor disclosure** footers (“Payments processed securely via Stripe”, etc.) |

---

## Upload policy (v1 starting posture)

| Type | Rule |
|------|------|
| **Music & general media** | **No hard cap** day one—monitor storage cost & abuse |
| **Video uploads** | **≤ 1 GB / file** (hard reject or require external link—pick one during implementation). **Production video playlists & detachable playback** targeted for **v2** (see **Post‑v1 / future version wiring** • **Release targets**) |
| **Gallery publication** | **Production approval gate** before client visibility even when SmugMug hosts pixels |

---

## Support & operations

| Item | Decision |
|------|----------|
| **Primary channel** | **In-app support ticket** queue |
| **Escalation owner** | **ULS Production Administrator** / on-call producer roster (define rotation externally) |
| **Detailed SOP** | Maintain operational runbook outside this file (access revoke, failed payment, legal hold, incident response) |
| **Producer stage diagram exports (runbook)** | Document for staff: **Export SVG / PNG** are **immediate browser downloads** (no platform-hosted export artifact). Snapshot rules, deck/plot parity with Show workspace, and **PNG raster fallback** (**use SVG** if canvas/raster blocked) live under **Scaled stage design (diagram workspace)** • **Diagram export (producer floor plot)** above. On PNG failure, producers see a **short inline notice** (auto-clears)—duplicate the playbook in the external runbook |

---

## Integrations roadmap posture

Versions **v2–v3** align with **Release targets** under **Post‑v1 / future version wiring**.

| Version / phase | Focus |
|-------------------|--------|
| **v1 (MVP)** | DocuSign webhooks + Stripe webhooks + SmugMug/Castr **URL / embed / metadata** patterns |
| **v2** | **Music + video playlists** (uploads, reorder, playback); producer **media library + cross-intake import**; **director reorder** under booking + visibility; audio via OS default output; optional **waveform previews** for music; video playback via **separate draggable browser window**; **director → production reference uploads** (download for staff; distinct from rundown playlists and confidential attachments) with optional **email notify** and **inbox CSV count** • **Engineering: shipped in `web/`; ops/runbook closure external** |
| **v3** | **Scaled stage diagram workspace** — iterative **2D CAD‑class** depth (structure, zones, symbols, typed equipment → drafting parity) • density over sparse UI • **Phase closure:** **v3.0 exit checklist** under **Scaled stage design** |
| **Cloud export** | Target ecosystem **TBD** (Drive / Dropbox / OneDrive—decide post-MVP) |

**Integrations posture checklist** *(mirror progress with **§ Master roadmap checklist**; rationale stays in the rows above.)*

- [ ] **v1 (MVP)** — DocuSign + Stripe webhooks and SmugMug/Castr **URL/embed/metadata** patterns accepted in production posture.
- [x] **v2** — **`web/` engineering** for playlists, library, reorder, reference uploads, detachable video window — *ops closure: **§ v2 show media — operations checklist***.
- [ ] **v3 (ongoing)** — Diagram CAD-class depth beyond **v3.0** — track under **§ Committed engineering direction** + **§ v3.1+ backlog** (*v3.0 baseline signed off*).
- [ ] **Cloud export** target ecosystem (Drive/Dropbox/OneDrive) chosen post-MVP.

---

## AI assistant posture (when introduced)

- Roll out **low-risk → high-risk** assistive features  
- **No autonomous execution** against physical production rigs / switchers without **explicit human confirmation**  
- **No proprietary historical training corpus** at initial development—architect pluggable future enrichment  

---

## Engineering foundations

| Item | Decision |
|------|----------|
| **Source control** | **GitHub** organization • **stakeholder retains org admin** |
| **Cloud** | **AWS** primary region **`us-east-2` (Ohio)** |
| **Environments** | Minimum **Staging** + **Production** resource isolation (separate DB, object storage, secrets, keys) |
| **Public URL (target)** | `https://uls-stage-director-pro.app` (always reference lowercase; `.app` mandates HTTPS) |
| **Product decisions** | **App Admin / stakeholder** has final scope authority |
| **Next.js cache invalidation** | Use **`revalidateProducerOverview()`**, **`revalidateSupportQueues(projectId)`**, **`revalidateProjectMirrorCache(projectId)`**, and (producer ticket thread only) **`revalidateProducerSupportTicketDetail(ticketId)`** from `web/lib/revalidate-project-mirror-cache.ts` after server mutations and from Stripe / DocuSign webhooks where applicable |
| **Database migrations** | Apply **`prisma migrate deploy`** (or **`migrate dev`**) whenever the repo adds migrations — new surfaces (e.g. **Show media library**, **project director shares**) fail at runtime until the migration has run on that environment |

### Minimum security bar (non-exhaustive)

HTTPS everywhere • encryption at rest (managed cloud defaults acceptable) • **server-side RBAC unit tests critical paths** • secrets via environment / secret manager (never repo) • principle of least privilege for object storage prefixes • immutable audit trails for privileged actions • automated backups tested quarterly • dependency vulnerability monitoring.

---

## Open items intentionally outside this artifact

Narrative **Director** & **Producer** journey prose • ordered engineering **backlog tickets / epics** (use **`§ Master roadmap checklist`** here for stakeholder-facing “what’s shipped” bands—not a substitute for sprint tracking) • detailed **runbook SOP appendices**.

---

_End of consolidated specification._
