# Scenario building blocks

Reusable fragments of a scenario's node graph — a short opening arc (a few
nodes covering how an incident starts and the first decision point or two)
that you can splice into a new scenario instead of writing the opening
from scratch every time. See [`docs/scenario-format.md`](../docs/scenario-format.md)
for the full node schema these fragments use.

A building block is **not** a runnable scenario on its own — it has no
metadata (`id`, `title`, `audience`, `roles`, etc.) and its final nodes are
deliberately left as **grafting points**: nodes with no `branches`, ready
for you to extend with your own audience-appropriate continuation rather
than a generic one.

## Available blocks

| File                      | Premise                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bad-deploy.yaml`         | A routine deploy causes a rising error rate; is it rolled back or investigated first?                            |
| `credential-leak.yaml`    | A credential/secret is found exposed publicly (e.g. committed to a public repo)                                  |
| `third-party-outage.yaml` | A critical third-party dependency degrades or goes down, and it's unclear whether the problem is yours or theirs |

Each file's header comment states: the premise, a suggested audience
range (a block written for a `technical` opening can often be extended
into a `management` or `exec` scenario by grafting escalation/comms nodes
onto it), and which node ids are grafting points.

## Using a building block

1. Copy the `nodes:` entries you want from the block into your new
   scenario file's `nodes:` list.
2. **Rename every node id** to something namespaced/unique for your new
   scenario (e.g. prefix with the scenario name) if there's any risk of
   collision with other nodes you're adding — the block's ids are
   generic (`node-alert`, `node-investigate`, etc.) and _will_ collide if
   you use more than one block, or reuse a block twice.
3. Add your scenario's metadata (`id`, `title`, `audience`,
   `duration_minutes`, `summary`, `objectives`, `category`, `roles`,
   `start`).
4. Extend each grafting point with `branches` that continue the story
   appropriately for your chosen audience tier — see
   [`docs/authoring-scenarios.md`](../docs/authoring-scenarios.md) for the
   general authoring process (sketch branches before writing full inject
   text, make sure at least one path is a strong response and one is a
   costly-but-plausible weaker one, etc).
5. Validate and review the flowchart as usual:
   ```bash
   npm run cli -- validate scenarios/<new-scenario>.yaml
   npm run cli -- flowchart scenarios/<new-scenario>.yaml
   ```

Blocks can also be combined — e.g. splice `third-party-outage.yaml`'s
opening into a scenario, then graft `credential-leak.yaml`'s nodes onto
one of its endings for a "the outage was actually a symptom of a breach"
escalation. Remember to rename ids from both blocks to avoid collisions
when doing this.

## Adding a new block

A good building block:

- Is genuinely reusable — not tied to any specific company/product/system
  (see the sensitivity guidance in `docs/authoring-scenarios.md` — the
  same rule applies here, blocks are public)
- Has 3-6 nodes: enough to establish the premise and one real decision
  point, not a full scenario
- Ends with at least one grafting point per plausible response quality
  (at least one "handled it well so far" path and one "this went
  sideways" path, mirroring the pattern in the full worked examples under
  `scenarios/`)
- States its grafting points explicitly in a header comment
