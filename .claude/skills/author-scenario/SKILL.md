---
name: author-scenario
description: Draft a new tabletop incident exercise scenario file (docs/scenario-format.md) tailored to this org's real teams, systems and incident history. Use when the user asks to write, create, or draft a new incident exercise / tabletop scenario, or to adapt an existing one for their organisation.
---

Read `docs/scenario-format.md` for the scenario file schema, then follow
the authoring process, org-context handling rules, and sensitivity
guidance in `docs/authoring-scenarios.md` exactly.

In particular:

- Check `org-context/` for a filled-in organisational context file
  (anything beyond `README.md`, `.gitignore`, `org-context.template.md`)
  before drafting. If none exists, point the user at `org-context/README.md`.
- Never write real organisational detail into a scenario under
  `scenarios/` — that folder must stay genericised/fictional, since this
  repository is open source. If the user wants to keep real detail rather
  than genericise it, write the scenario to `scenarios-private/` instead
  (see `scenarios-private/README.md`); both it and `org-context/` are
  gitignored.
- Validate the finished scenario and review its generated flowchart before
  considering the work done:
  ```bash
  npm run cli -- validate scenarios/<new-scenario>.yaml
  npm run cli -- flowchart scenarios/<new-scenario>.yaml
  ```
