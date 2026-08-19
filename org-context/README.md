# Org context

This folder holds private context about your product, team and
organisation, used to help author scenarios that are specific and
realistic rather than generic. **Everything in this folder except this
README, `.gitignore`, and `org-context.template.md` is gitignored** — see
`org-context/.gitignore`. This is deliberate: this repo is open source, and
this folder is where sensitive organisational detail (system names, team
structure, supplier names, known weaknesses) is meant to live locally
without ever reaching git history.

## Setup

Copy the template and fill it in with real detail:

```bash
cp org-context/org-context.template.md org-context/org-context.md
```

`org-context.md` (or whatever you name it) will not be tracked by git. You
can maintain one file, or split into several (e.g. one per product/team) —
anything you add under `org-context/` other than the three files listed
above stays untracked.

## Using it

When authoring a new scenario, provide the relevant context file(s) to
the assistant alongside the scenario schema
([`docs/scenario-format.md`](../docs/scenario-format.md)) so injects,
role names, and failure modes reflect your actual systems and org
structure instead of generic placeholders.

## Before publishing or sharing anything

If you ever fork, mirror, or otherwise export this repo's history (not
just the working tree), double check nothing under `org-context/` was
committed at an earlier point — `git log --all --full-history -- 'org-context/*'`
should return nothing beyond this README, `.gitignore`, and the template.
