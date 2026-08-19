<!--
  Org context template — copy this to org-context.md (or similar) and fill
  it in with real detail. Files based on this template are gitignored;
  see org-context/README.md. Do not commit a filled-in copy of this file.
-->

# Org context

## Product

- What the product/service does, in a few sentences
- Primary user types and rough scale (e.g. daily active users, transactions/day, peak load)
- What "down" or "degraded" actually means for users in concrete terms

## Complexity

- High-level architecture: how many major services/systems, how they depend on each other
- What makes this hard to operate: shared infrastructure, tight coupling, legacy components, manual steps, single points of failure
- Anything that makes incidents in this system unusually slow or fast to detect/diagnose

## Technology

- Languages, frameworks, key platforms (cloud provider, container orchestration, databases, queues, etc.)
- Observability stack: what monitoring/alerting/logging tools are actually used
- Deployment process: how code ships to production, how rollback works (or doesn't)

## Organisation structure

- Team names and what each owns (services, product areas)
- Reporting lines relevant to incident escalation (who's above whom, up to exec level)
- On-call structure: who's on-call for what, and how handoffs between teams work
- Where incident response process is documented (runbooks, wikis, etc.) — link or describe

## Key external stakeholders

- Regulators or oversight bodies relevant to incidents in this domain
- Customer-facing stakeholders who need to be informed (major clients, partner orgs)
- Press/media relationships or exposure, if relevant to the scale of incidents you run

## Key third-party suppliers

- Critical vendors/suppliers whose failure would cause or worsen an incident
- Which of these have support SLAs, and how contact/escalation with them actually works
- Any known fragility in these relationships (single-vendor dependency, slow support response, etc.)

## Known issues, worry points and bottlenecks

- Things the team already knows are fragile or under-tested
- Past incidents (real ones) worth drawing on for realism — what happened, what was learned
- Processes/runbooks suspected to be out of date, unclear, or never actually exercised
- Organisational/social friction points: unclear ownership, escalation reluctance, blame culture history, comms bottlenecks
