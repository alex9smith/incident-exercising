# Incident Exercising

Tooling for planning and running tabletop incident response exercises —
practising processes, runbooks and decision-making for software and
security incidents, without needing to touch real systems.

This is a blameless exercise tool: scenarios are designed to test whether
processes and runbooks hold up under pressure, not to catch out individuals.

v1 focuses on **authoring and reviewing scenarios**, not running them live.
A scenario is a single YAML file describing a branching tabletop exercise;
this repo provides a schema for that format, validation, and a Mermaid
flowchart generator so you can review branch coverage before a session.
A terminal-based facilitator "run" mode is planned as a fast follow.

## Requirements

- Node.js 24.18.1 (see `.nvmrc` / `fnm use`)

## Getting started

```bash
npm install
npm run build
node dist/cli.js validate scenarios/exec-ransomware-crisis.yaml
node dist/cli.js flowchart scenarios/exec-ransomware-crisis.yaml
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
is aimed at. The example scenario in `scenarios/` is `exec`-level.

## Worked example

`scenarios/exec-ransomware-crisis.yaml` is a 9-node exec crisis scenario
covering a ransomware/data-leak claim: verification under uncertainty,
major incident declaration, attacker contact/payment decisions, and the
comms/regulatory disclosure fork. It has three distinct endings reflecting
different response quality, intended as discussion material in the
debrief.

Generate its flowchart:

```bash
npm run cli -- flowchart scenarios/exec-ransomware-crisis.yaml
```

Paste the output into a markdown file or viewer that renders Mermaid
(GitHub, GitLab, most markdown previewers) to see the branch structure.

## CLI commands

| Command                                    | Description                                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate <scenario.yaml>`                 | Checks the file against the schema and checks the branching graph for dangling references, duplicate ids, unreachable nodes, and paths with no ending |
| `flowchart <scenario.yaml> [--out <file>]` | Generates a Mermaid flowchart from the branching graph. Prints to stdout, or writes to `--out`                                                        |

## Development

```bash
npm run check-types   # tsc --noEmit
npm run eslint         # lint
npm run format         # prettier --check
npm test               # vitest run
```

## Roadmap

- Terminal-based facilitator "run" mode: step through a scenario's graph
  interactively, prompting for which branch was taken
- Additional worked examples at the `technical` and `management` audience
  levels
- A library of reusable scenario building blocks (generic bad-deploy,
  credential-leak, third-party-outage templates) to mix and adapt
