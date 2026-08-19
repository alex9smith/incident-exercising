import * as v from "valibot";

const AUDIENCE_LEVELS = ["technical", "management", "exec"] as const;

export const AudienceSchema = v.picklist(AUDIENCE_LEVELS);

export type Audience = v.InferOutput<typeof AudienceSchema>;

export const RoleSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Role name must not be empty")),
  description: v.pipe(
    v.string(),
    v.nonEmpty("Role description must not be empty"),
  ),
});

export type Role = v.InferOutput<typeof RoleSchema>;

export const BranchSchema = v.object({
  label: v.pipe(v.string(), v.nonEmpty("Branch label must not be empty")),
  next: v.pipe(v.string(), v.nonEmpty("Branch next id must not be empty")),
});

export type Branch = v.InferOutput<typeof BranchSchema>;

export const NodeSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty("Node id must not be empty")),
  title: v.pipe(v.string(), v.nonEmpty("Node title must not be empty")),
  inject: v.pipe(v.string(), v.nonEmpty("Node inject must not be empty")),
  facilitator_notes: v.optional(v.string()),
  branches: v.optional(v.array(BranchSchema)),
});

export type ScenarioNode = v.InferOutput<typeof NodeSchema>;

export const ScenarioSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty("Scenario id must not be empty")),
  title: v.pipe(v.string(), v.nonEmpty("Scenario title must not be empty")),
  audience: AudienceSchema,
  duration_minutes: v.pipe(
    v.number(),
    v.integer("duration_minutes must be an integer"),
    v.minValue(1, "duration_minutes must be positive"),
  ),
  summary: v.pipe(v.string(), v.nonEmpty("Scenario summary must not be empty")),
  objectives: v.pipe(
    v.array(v.pipe(v.string(), v.nonEmpty())),
    v.minLength(1, "At least one objective is required"),
  ),
  category: v.pipe(
    v.string(),
    v.nonEmpty("Scenario category must not be empty"),
  ),
  roles: v.pipe(
    v.array(RoleSchema),
    v.minLength(1, "At least one role is required"),
  ),
  start: v.pipe(v.string(), v.nonEmpty("start must not be empty")),
  nodes: v.pipe(
    v.array(NodeSchema),
    v.minLength(1, "At least one node is required"),
  ),
});

export type Scenario = v.InferOutput<typeof ScenarioSchema>;
