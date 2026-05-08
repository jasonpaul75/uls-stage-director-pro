# ULS Stage Director PRO — Product specification (locked MVP / v1 foundations)

Living document derived from stakeholder decisions through April 2026. Update intentionally when policies change.

---

## Purpose

Private, cloud-hosted web (and eventual mobile-first) platform for **Universal Light & Sound (ULS)**. Internal operating system plus a **white-labeled director portal**. Marketing position: proprietary production intelligence—not a generic marketplace.

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

- **OBS (target v4)** — programmatic show **cues / transport** (not autopilot)—future wiring via **OBS WebSocket** and a **local companion** running on or beside the OBS machine; no commitment to replacing OBS from the SPA alone  
- Departmental cue-linked **chat**  
- **Offline sync** (**offline client blocks live telemetry** conceptual rule reserved for future)  
- **Multi-venue** orchestration depth  
- **Payroll-grade** workforce accounting  
- **GPS check-in**  
- Dedicated **handler / crew personas** (**phone-only persona policy** reserved—they **do not** ship for v1)

#### Out of roadmap (explicit exclusions)

- **DMX**, **USB/lighting transmitter control**, or any **hardware lighting console** surfaced from ULS SPA — **not pursued**  
- **VirtualDJ** or other DJ‑app coupling — **not pursued**  

### Post‑v1 / future version wiring

Product expansion **after MVP (v1) foundations**. Capability groups map to target **semver-style major releases** below (engineering may split minors/patches—this is stakeholder targeting only).

#### Release targets

| Target | Capability | Rationale |
|--------|-------------|-----------|
| **v2** | **Music** + **video** playlists (uploads, reorder, playback); audio via OS default output; video via **separate browser window** for multi-monitor; **producer media library** + **import/copy** across intakes; **director rundown reorder** where booking is secured | Shares storage, RBAC, and rundown UX patterns—ship together so solo operators get full **show media** without a half-released pillar. **`web/` engineering complete — ULS validates limits, playback rigs, SES/S3 posture in the ops runbook.** |
| **v3** | **Scaled stage design** diagrams (2D proportional CAD‑lite first) | Largest **new surface area**—worth its own cycle after core media primitives exist. |
| **v4** | **OBS** integration — **OBS WebSocket** commands **via authenticated local companion** on the OBS machine | Installer, trust boundaries, and on-site debugging deserve a dedicated integration release after v2/v3 stabilize cloud behavior. |

**Blackmagic‑centric spikes** remain **non-versioned experiments** until a time-boxed build produces a adoption decision — no numbered release obligation.

#### Show media — **v2 (web complete)** *(ops: validate uploads, playback rigs, and runbook posture)*

**Music (in-app only — no external DJ software)**  
- **Custom playlists** from per-show uploads plus **producer media library** entries; **import** copies approved cues from the shared library **or from another submitted intake** (**S3 CopyObject** in the attachments bucket — no duplicate upload).  
- **Reorder**: producers always; **directors** may move cues up/down in rundown order when **`bookingSecuredAt`** is set, the playlist is **published** to directors, and portal **access hasn’t expired** (same gate as playback).  
- **Playback** uses normal **browser / OS audio routing** (default output device operator selects in OS). **Approximate waveform strip** from decoded audio aids cue recognition in previews (large files may skip decode client-side per performance cap). Constraints of in‑browser playback and licensing remain governed by Ops + counsel.

**Video (playlists + externally placeable playback)**  
- **Uploads** and **video playlists** with **parity to music playlists** for ordering and curation flexibility.  
- **Playback** intentionally opens in a **separate browser window** (or equivalently detachable playback surface the team standardizes around) so the operator can drag it onto any monitor in extended desktop—for example **LED wall front PC** layouts.  
- **Selecting “display 1–4” from inside the SPA** is **not a committed requirement**: monitor choice stays **Windows/macOS workspace + drag window + fullscreen/OS maximize** driven by ops unless a future **installed companion** earns that scope separately.

**Director → production reference files (not show playlists)**  
- **Separate** from curated **show media** rundown cues **and** from **confidential** intake attachments / insurance: directors may upload **reference audio/video** production can retrieve from portal intake + show workspaces and producer intake/event detail. Upload policy aligns with broad **music+video MIME** allowances with a sensible per-file cap (engineering runbook mirrors show-media posture). Successful uploads optionally **email production** via the same **`SES_FROM_EMAIL` + `INTAKE_NOTIFY_EMAIL`** path as intake notifications. **Producer inbox CSV export** includes a per-row **director production file count** for queue triage.

**Engineering status:** The `web/` application ships the behaviors above with server-side RBAC tests on critical flows (Vitest); Playwright smoke covers auth shells, public surfaces, webhook ingress stubs, presign/forbidden gates, export CSRF/forbidden posture, etc. Remaining closure is **ULS ops validation** (real files, WAN/S3 latency, detachable video window positioning, SES deliverability, and documenting limits in the **external operational runbook** — see **Support & operations**).

#### Scaled stage design (diagram workspace) — **→ v3**

- **Proportional, to‑scale** diagrams shared between production and directors: stage footprint, truss, fixtures, electrical distribution metaphors, **LED wall placement**, décor blocks, etc.
- Likely starts as **2D CAD‑lite** (defined real‑world units, snap/grid, symbol libraries); depth of **3D**, revision history, and real‑time co‑editing are **TBD** per release.

#### OBS (later integration; companion pattern) — **→ v4**

- **OBS** stays on the **integrations roadmap**: cue or scene commands, status, optional transport—typically **OBS WebSocket** with **authenticated local relay** so a cloud SPA never pretends direct `localhost` access is universal.

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

---

## Integrations roadmap posture

Versions **v2–v4** align with **Release targets** under **Post‑v1 / future version wiring**.

| Version / phase | Focus |
|-------------------|--------|
| **v1 (MVP)** | DocuSign webhooks + Stripe webhooks + SmugMug/Castr **URL / embed / metadata** patterns |
| **v2** | **Music + video playlists** (uploads, reorder, playback); producer **media library + cross-intake import**; **director reorder** under booking + visibility; audio via OS default output; optional **waveform previews** for music; video playback via **separate draggable browser window**; **director → production reference uploads** (download for staff; distinct from rundown playlists and confidential attachments) with optional **email notify** and **inbox CSV count** • **Engineering: shipped in `web/`; ops/runbook closure external** |
| **v3** | **Scaled stage diagram workspace** (2D proportional CAD‑lite first) |
| **v4** | **OBS** — WebSocket‑based **cue / scene / transport hooks** behind a **local companion** (**no VirtualDJ coupling**) |
| **Spikes (unversioned)** | **Blackmagic**-centric live production **experiments** — time-boxed validation only; **no customer-facing promise** until signed off |
| **Cloud export** | Target ecosystem **TBD** (Drive / Dropbox / OneDrive—decide post-MVP) |

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

Narrative **Director** & **Producer** journey prose • ordered engineering **backlog** tickets • detailed **runbook SOP appendices**.

---

_End of consolidated specification._
