# Authoring org-specific scenarios

This is the guide an AI assistant (or a person) follows to draft a new
scenario file tailored to a real team, product and organisation, rather
than a generic example. It assumes familiarity with
[`docs/scenario-format.md`](scenario-format.md) — read that first if you
haven't already.

This file is tool-agnostic on purpose: it's referenced from both a Kiro
steering file (`.kiro/steering/scenario-authoring.md`) and a Claude Code
skill (`.claude/skills/author-scenario/SKILL.md`) so the same guidance
applies regardless of which assistant is being used. Edit this file when
the authoring process changes; the wrappers should rarely need to change.

## Before drafting anything

1. Check whether `org-context/` has a filled-in context file (anything
   other than `README.md`, `.gitignore`, `org-context.template.md`). If
   the user hasn't set one up yet, point them at
   `org-context/README.md` and offer to help fill in
   `org-context.template.md` from a short conversation before continuing.
   **Never write real organisational detail into a scenario under
   `scenarios/`** — that folder is shareable/open source, so scenarios
   there should stay genericised (fictional company/product/system names)
   even when inspired by real context. If the user wants to keep real
   detail, write the scenario to `scenarios-private/` instead (gitignored,
   same format — see `scenarios-private/README.md`).
2. Confirm the audience level (`technical`, `management`, `exec`) — this
   drives tone, stakes, and what kind of decisions the scenario should
   center on (see the existing worked examples in `scenarios/` for
   the difference in register between tiers).
3. Confirm the category/theme if not already given (availability,
   security/breach, data, third-party outage, etc.) and whether it should
   echo a real past incident (more realistic, good for buy-in) or be
   deliberately novel (tests process rather than muscle memory from an
   incident people already remember).
4. Check [`building-blocks/`](../building-blocks/) for a fragment that
   matches the chosen theme (bad deploy, credential leak, third-party
   outage) — starting from one saves writing the opening arc from scratch
   and comes pre-validated. See `building-blocks/README.md` for how to
   splice one in. Not every scenario has a matching block; that's fine,
   draft from scratch in that case.

## Drafting process

1. **Read the relevant org context.** Pull out: the actual systems/teams
   involved, real role titles (mapped to generic role names in the
   scenario — e.g. "VP Engineering" rather than a real person's name),
   known weak points worth exercising, and any third parties/regulators
   that should appear if relevant to this scenario's category.
2. **Write a one-paragraph premise** before writing any nodes. If this
   doesn't clearly name what's being tested (a decision, a process gap, an
   ownership question), it's not specific enough yet — revisit it.
3. **Sketch the branch structure before writing full inject text**, or
   start from a building block's nodes if one matched the theme (rename
   its node ids first — see `building-blocks/README.md`). List node
   titles and the key decision at each fork first, as a short outline.
   Check the outline has:
   - at least one path that represents a strong/model response
   - at least one path where a plausible reasonable-sounding choice leads
     to a worse outcome, to make the cost of that choice concrete
   - forks that map to real ownership/process questions from the org
     context (e.g. "who owns this system", "when do we escalate", "who
     approves this comms"), not just arbitrary plot branches
4. **Write the full nodes**, following the field structure in
   `docs/scenario-format.md`. Keep `inject` text factual and concrete
   (specific numbers, times, quotes) — vague injects produce vague
   discussion. Use `facilitator_notes` for what a good response looks
   like and what to watch for, never information participants should see.
5. **Genericise anything sensitive** pulled from org context: replace real
   system/product/team/company names and any real past-incident specifics
   with clearly fictional equivalents, unless the user explicitly says the
   scenario itself is private and won't be committed to a public repo —
   in that case, write it to `scenarios-private/` instead of `scenarios/`
   (see `scenarios-private/README.md`); don't genericise it there.
6. **Validate and review the flowchart** before considering it done:
   ```bash
   npm run cli -- validate scenarios/<new-scenario>.yaml
   npm run cli -- flowchart scenarios/<new-scenario>.yaml
   ```
   Fix any errors; treat warnings (unreachable nodes, no path to an
   ending) as real problems to resolve, not noise.

## Good questions to ask if org context is thin

If `org-context/` isn't filled in, or is missing detail relevant to this
scenario, ask rather than guessing:

- What actually broke, technically, last time something like this
  happened here (if it has)?
- Who is genuinely unsure of their role during an incident today — where
  are the real ownership gaps?
- What's the one thing about how this org handles incidents that
  everyone privately complains about?
- Who are the people/teams that would actually be in the room for a
  scenario at this audience level?

## After drafting

Tell the user which node(s) represent the "strongest" and "weakest"
outcomes, and why — this is useful framing for the debrief even before the
scenario is ever run. Do not silently invent a company/system/incident
history that sounds real; if you're extrapolating rather than working from
provided org context, say so.
