# Private scenarios

This folder is for scenario files that reference real organisational
detail (real system/team/product names, real past incidents) and aren't
meant to be shared publicly. **Everything in this folder except this
README and `.gitignore` is gitignored** — see `scenarios-private/.gitignore`.

Scenarios under [`../scenarios/`](../scenarios/) are the public, worked
examples for this repo and must stay genericised/fictional, since the repo
is open source. If a scenario is built from real `org-context/` detail and
the user wants to keep that detail rather than genericise it, it belongs
here instead.

## Usage

The format is identical to `scenarios/` — see
[`../docs/scenario-format.md`](../docs/scenario-format.md). The CLI takes
any file path, so everything works the same:

```bash
npm run cli -- validate scenarios-private/<name>.yaml
npm run cli -- flowchart scenarios-private/<name>.yaml
npm run cli -- run scenarios-private/<name>.yaml
```

## Before publishing or sharing anything

If you ever fork, mirror, or otherwise export this repo's history, double
check nothing under `scenarios-private/` was committed at an earlier
point — `git log --all --full-history -- 'scenarios-private/*'` should
return nothing beyond this README and `.gitignore`.
