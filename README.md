# Incident Exercising

Tooling for planning and running tabletop incident response exercises —
practising processes, runbooks and decision-making for software and
security incidents, without needing to touch real systems.

This is a blameless exercise tool: scenarios are designed to test whether
processes and runbooks hold up under pressure, not to catch out individuals.

A scenario is a single YAML file describing a branching tabletop exercise.
This repo provides a schema for that format, validation, a Mermaid
flowchart generator for reviewing branch coverage before a session, and a
terminal-based facilitator "run" mode for actually running one.

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
is aimed at. The `scenarios/` directory has one worked example per tier so
far (`exec` and `management`).

## Worked examples

`scenarios/exec-ransomware-crisis.yaml` is a 9-node exec crisis scenario
covering a ransomware/data-leak claim: verification under uncertainty,
major incident declaration, attacker contact/payment decisions, and the
comms/regulatory disclosure fork. It has three distinct endings reflecting
different response quality, intended as discussion material in the
debrief.

`scenarios/management-bad-deploy-outage.yaml` is an 8-node management-tier
scenario covering a bad deploy causing a rising checkout error rate: the
rollback-vs-investigate decision, cross-team ownership when the cause spans
two services, and when/how to bring in Support and senior management. It
has two endings that converge on the same resolution but differ in whether
comms happened proactively or not.

Generate a flowchart for either:

```bash
npm run cli -- flowchart scenarios/exec-ransomware-crisis.yaml
npm run cli -- flowchart scenarios/management-bad-deploy-outage.yaml
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

A JSON transcript of the session (scenario id, start/finish times, and
each node visited with the branch chosen) is written to `./transcripts/`
by default. Use `--transcript-dir <dir>` to change where it's saved:

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

## Roadmap

- Additional worked examples at the `technical` audience level
- A library of reusable scenario building blocks (generic bad-deploy,
  credential-leak, third-party-outage templates) to mix and adapt
- Org-specific context (teams, systems, past incidents) to speed up
  authoring new scenarios tailored to your own organisation
