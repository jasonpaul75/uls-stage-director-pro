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
| **Stripe** | **Standard ULS merchant account** (`Stripe Payments` — **Stripe Connect omitted** unless a future payout-splitting scenario requires it). Settlement to ULS |

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

### Explicitly deferred (not v1)

- Full OBS/vMix/live-switch **automation**  
- Departmental cue-linked **chat**  
- **Offline sync** (**offline client blocks live telemetry** conceptual rule reserved for future)  
- **Multi-venue** orchestration depth  
- **Payroll-grade** workforce accounting  
- **GPS check-in**  
- Dedicated **handler / crew personas** (**phone-only persona policy** reserved—they **do not** ship for v1)  

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
| **Video uploads** | **≤ 1 GB / file** (hard reject or require external link—pick one during implementation) |
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

| Phase | Focus |
|-------|--------|
| **Phase 0 / v1** | DocuSign webhooks + Stripe webhooks + SmugMug/Castr **URL / embed / metadata** patterns |
| **Phase 1+** | **Blackmagic centric live production experiments**—require **time-boxed engineering spikes** before customer-facing promises |
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

### Minimum security bar (non-exhaustive)

HTTPS everywhere • encryption at rest (managed cloud defaults acceptable) • **server-side RBAC unit tests critical paths** • secrets via environment / secret manager (never repo) • principle of least privilege for object storage prefixes • immutable audit trails for privileged actions • automated backups tested quarterly • dependency vulnerability monitoring.

---

## Open items intentionally outside this artifact

Narrative **Director** & **Producer** journey prose • ordered engineering **backlog** tickets • detailed **runbook SOP appendices**.

---

_End of consolidated specification._
