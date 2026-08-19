# Scenario format

A scenario is a single YAML file describing a tabletop exercise. It is
designed to be authored and reviewed as plain text (readable in a diff,
editable without special tooling) and to drive two things:

- a Mermaid flowchart of the branching structure (`incident-exercising flowchart`)
- (later) a terminal-based facilitator run-through (`incident-exercising run`)

Nothing in the format is tied to a specific delivery medium — the same file
works whether you're running the session over video call, in a room, or
reading from a printout.

## Top-level shape

```yaml
id: exec-ransomware-crisis
title: "Ransomware crisis: customer data exposed"
audience: exec
duration_minutes: 90
summary: >
  A ransomware group claims to have exfiltrated customer data and is
  threatening to publish it. Participants must decide how to respond
  across containment, comms, legal and regulatory dimensions.
objectives:
  - Exercise the crisis communications decision tree (internal, customer, press, regulator)
  - Test escalation and delegation under uncertainty
  - Surface gaps in the incident severity / major incident declaration criteria
category: security
roles:
  - name: Incident Commander
    description: Chairs the exercise, owns the overall response decision
  - name: Comms Lead
    description: Owns internal and external messaging
  - name: Legal/DPO
    description: Advises on regulatory and disclosure obligations
start: node-1
nodes:
  - id: node-1
    ...
```

### Metadata fields

| Field              | Required | Notes                                                                 |
| ------------------ | -------- | --------------------------------------------------------------------- |
| `id`               | yes      | Stable slug, used as filename convention and cross-references         |
| `title`            | yes      | Human title shown to facilitator and in the flowchart                 |
| `audience`         | yes      | One of `technical`, `management`, `exec` (see below)                  |
| `duration_minutes` | yes      | Planned run time, for scheduling                                      |
| `summary`          | yes      | 2-4 sentence premise, shown to facilitator before the session         |
| `objectives`       | yes      | List of what the exercise is meant to test/reveal                     |
| `category`         | yes      | Free-text tag, e.g. `security`, `availability`, `data`, `third-party` |
| `roles`            | yes      | Named participant roles this scenario expects to be filled            |
| `start`            | yes      | Id of the first node in the graph                                     |
| `nodes`            | yes      | The branching graph (see below)                                       |

`audience` levels, from the original brief:

- `technical` — an engineering/on-call team debugging a live technical problem
- `management` — team leads / mid-management coordinating a response
- `exec` — senior leadership / crisis management, comms and regulatory focus

## Nodes

Each node is one beat of the exercise: an inject is read out or shown, then
(usually) a decision is asked for. Nodes form a directed graph, not a flat
timeline, so the same scenario file can support divergent paths.

```yaml
- id: node-1
  title: Initial report
  inject: >
    09:14. A ransomware group's leak site lists your company by name,
    claiming to have 2.3M customer records and a countdown to publish
    in 72 hours if payment is not made. A junior analyst has spotted this
    and escalated to you directly.
  facilitator_notes: >
    Expect the group to ask: is this credible? Who verifies it? Do we
    declare a major incident now or wait for confirmation? Good responses
    name an owner and a verification step rather than debating in the abstract.
  branches:
    - label: Declare a major incident immediately and stand up the crisis team
      next: node-2a
    - label: Ask security team to verify the claim before declaring
      next: node-2b
```

| Field               | Required | Notes                                                                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | yes      | Unique within the scenario                                                                                                     |
| `title`             | yes      | Short label, used in the flowchart node box                                                                                    |
| `inject`            | yes      | The information revealed to participants at this point                                                                         |
| `facilitator_notes` | no       | Guidance for the person running the session: what to watch for, prompts to nudge discussion, what a strong response looks like |
| `branches`          | no       | List of possible participant decisions leading elsewhere. Omit for a terminal node (the exercise/path ends here)               |

Each entry in `branches` has:

| Field   | Required | Notes                                                     |
| ------- | -------- | --------------------------------------------------------- |
| `label` | yes      | The decision/action described from the participants' side |
| `next`  | yes      | Id of the node this leads to                              |

A node with no `branches` is an end state — either the exercise concludes
there, or that particular path has played out. A scenario can (and for exec
crisis scenarios, usually should) have several distinct endings reflecting
different quality of response, so the debrief can compare what happened
against the other paths.

## Validation rules

`incident-exercising validate <file>` checks, beyond the schema shape:

- `start` refers to an existing node
- every `branches[].next` refers to an existing node
- every node is reachable from `start`
- no duplicate node ids
- no node ids are unused (all nodes reachable) — a warning, not an error, since
  a work-in-progress scenario may have draft branches not yet wired up
- cycles are allowed (a scenario can loop back, e.g. "wait and monitor")
  but a warning is raised if `start` cannot reach an end state at all

## Generating a flowchart

```
incident-exercising flowchart scenarios/exec-ransomware-crisis.yaml
```

Emits a Mermaid flowchart (`flowchart TD`) to stdout, or to a file with
`--out`. Node boxes show the `title`; edges are labelled with the branch
`label`. This is meant to be pasted into a markdown doc or viewed directly
(GitHub, GitLab, and most markdown viewers render Mermaid inline) so you can
sanity-check branch coverage before running the session, without needing to
mentally trace the YAML.
