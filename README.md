# Incident Exercising

Tooling for planning and running tabletop incident response exercises —
practising processes, runbooks and decision-making for software and
security incidents, without needing to touch real systems.

A scenario is a single YAML file describing a branching tabletop exercise.
This repo provides a schema for that format, validation, a Mermaid
flowchart generator for reviewing branch coverage before a session, and a
terminal-based facilitator "run" mode for actually running one.

You can create generic scenarios, or optionally provide organisational /
product context and use the included Kiro or Claude skills to generate 
more realistic and specific ones.

## Requirements

- Node.js 24.18.1 (see `.nvmrc` / `fnm use`)

## Getting started

```bash
npm install
npm run build
node dist/cli.js validate scenarios/exec-ransomware-crisis.yaml
node dist/cli.js flowchart scenarios/exec-ransomware-crisis.yaml
node dist/cli.js run scenarios/management-bad-deploy-outage.yaml
```

Or without building, during development:

```bash
npm run cli -- validate scenarios/exec-ransomware-crisis.yaml
npm run cli -- flowchart scenarios/exec-ransomware-crisis.yaml --out crisis.mmd
```

## Scenario format

See [`docs/scenario-format.md`](docs/scenario-format.md) for the full
schema. In short: a scenario has metadata (title, audience, objectives,
roles) and a graph of nodes. Each node reveals an inject to participants
and optionally offers branches — decisions that lead to different
subsequent nodes — so a single scenario file can capture several distinct
paths through an incident, including different quality of response.

An audience level (`technical`, `management`, `exec`) tags who the scenario
is aimed at. The `scenarios/` directory has one worked example per tier
(`technical`, `management`, `exec`).

## Writing scenarios for your own organisation

`org-context/` is a gitignored folder for private detail about your
product, teams and organisation — see
[`org-context/README.md`](org-context/README.md) and copy
[`org-context/org-context.template.md`](org-context/org-context.template.md)
to get started. Nothing in that folder (besides the README, `.gitignore`,
and the blank template) is ever committed, so it's safe to put real system
names, team structure, supplier details and known weak points there.

[`docs/authoring-scenarios.md`](docs/authoring-scenarios.md) describes the
process for turning that context into a new scenario file — checking
`org-context/` first, keeping anything under `scenarios/` genericised
since this repo is open source, and validating the result. This is
available to an AI assistant as either:

- a Kiro steering file: `.kiro/steering/scenario-authoring.md` (manual
  inclusion — reference it with `#scenario-authoring`)
- a Claude Code skill: `.claude/skills/author-scenario/SKILL.md` (invoke
  directly with `/author-scenario`, or let Claude pick it up automatically
  when you ask it to draft a scenario)

Both just point to the same `docs/authoring-scenarios.md`, so the actual
guidance only needs to be maintained in one place.

If a scenario is built from real org detail and you want to keep that
detail rather than genericise it, write it to `scenarios-private/`
instead of `scenarios/` — see
[`scenarios-private/README.md`](scenarios-private/README.md). It's
gitignored the same way as `org-context/`, and the format and CLI usage
are identical to public scenarios.

## Building blocks

[`building-blocks/`](building-blocks/) has reusable node-graph fragments —
short opening arcs (a few nodes covering how an incident starts and the
first decision point or two) that you can splice into a new scenario
instead of writing the opening from scratch every time. Currently
available: `bad-deploy.yaml`, `credential-leak.yaml`, and
`third-party-outage.yaml`. See
[`building-blocks/README.md`](building-blocks/README.md) for what each
one covers and how to splice one in.

These aren't runnable scenarios on their own — they're missing metadata
and end at deliberate "grafting points" (nodes with no branches yet) for
you to extend with your own audience-appropriate continuation.

## Worked examples

`scenarios/technical-memory-leak-oncall.yaml` is an 11-node technical-tier
scenario for a single on-call engineer (or a pair): a p99 latency alert
caused by a slow memory leak in a dependency bump. It tests debugging
process — using the dashboard/runbook that actually exists, correlating
against recent deploys, and not mistaking a symptom fix (manual restart)
for a root-cause fix — rather than crisis coordination or comms.

`scenarios/management-bad-deploy-outage.yaml` is an 8-node management-tier
scenario covering a bad deploy causing a rising checkout error rate: the
rollback-vs-investigate decision, cross-team ownership when the cause spans
two services, and when/how to bring in Support and senior management. It
has two endings that converge on the same resolution but differ in whether
comms happened proactively or not.

`scenarios/exec-ransomware-crisis.yaml` is a 9-node exec crisis scenario
covering a ransomware/data-leak claim: verification under uncertainty,
major incident declaration, attacker contact/payment decisions, and the
comms/regulatory disclosure fork. It has three distinct endings reflecting
different response quality, intended as discussion material in the
debrief.

Generate a flowchart for any of them:

```bash
npm run cli -- flowchart scenarios/technical-memory-leak-oncall.yaml
npm run cli -- flowchart scenarios/management-bad-deploy-outage.yaml
npm run cli -- flowchart scenarios/exec-ransomware-crisis.yaml
```

Paste the output into a markdown file or viewer that renders Mermaid
(GitHub, GitLab, most markdown previewers) to see the branch structure.

## Running a session

`run` facilitates a scenario interactively in the terminal — useful for
rehearsing solo, or for a facilitator following along on their own screen
while running the session over a call or in a room:

```bash
npm run cli -- run scenarios/management-bad-deploy-outage.yaml
```

For each node it prints the inject (read this out / share with
participants) and, separately, facilitator notes marked
`[facilitator notes — do not read aloud]` — useful context on what to watch
for and what a strong response looks like, not meant to be shown to
participants if you're screen-sharing. If the node has branches, it lists
them as numbered options and waits for you to type the number matching
what the group actually decided. This continues until an ending is
reached, at which point it prints a summary of the path taken.

If the group does something not covered by any listed branch, choose `0`
("Something else") instead. You'll be asked to describe what actually
happened in a sentence or two, then either give the id of an existing node
to jump to and keep the walkthrough going, or leave it blank to end the
walkthrough there. Either way, the deviation and its description are
recorded in the transcript — this is useful in its own right: if the same
node keeps producing deviations across runs, that's a sign the scenario is
missing a branch it should have.

A JSON transcript of the session (scenario id, start/finish times, and
each node visited with the branch chosen or the deviation description) is
written to `./transcripts/` by default. Use `--transcript-dir <dir>` to
change where it's saved:

```bash
npm run cli -- run scenarios/exec-ransomware-crisis.yaml --transcript-dir ./transcripts/2026-08-19-exec-drill
```

The transcript is plain data, not prose — it's meant as raw material for
writing up post-exercise notes afterwards, not a replacement for them.

`run` validates the scenario's branching graph first and refuses to start
if there are structural errors (the same checks as `validate`), so a broken
scenario file won't leave you stuck mid-session.

## CLI commands

| Command                                        | Description                                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate <scenario.yaml>`                     | Checks the file against the schema and checks the branching graph for dangling references, duplicate ids, unreachable nodes, and paths with no ending                            |
| `flowchart <scenario.yaml> [--out <file>]`     | Generates a Mermaid flowchart from the branching graph. Prints to stdout, or writes to `--out`                                                                                   |
| `run <scenario.yaml> [--transcript-dir <dir>]` | Interactively facilitates the scenario in the terminal, prompting for which branch was chosen at each node, and writes a JSON transcript when finished (default `./transcripts`) |

## Development

```bash
npm run check-types   # tsc --noEmit
npm run eslint         # lint
npm run format         # prettier --check
npm test               # vitest run
```
