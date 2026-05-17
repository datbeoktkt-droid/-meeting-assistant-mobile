import reactDoctorPlugin from "oxlint-plugin-react-doctor";
import type {
  Diagnostic,
  DiagnosticSurface,
  ReactDoctorConfig,
  SurfaceControls,
} from "@react-doctor/types";
import { DEFAULT_SURFACE_EXCLUDED_TAGS } from "./diagnostic-surface.js";

interface ResolvedSurfaceControls {
  includeTags: ReadonlySet<string>;
  excludeTags: ReadonlySet<string>;
  includeCategories: ReadonlySet<string>;
  excludeCategories: ReadonlySet<string>;
  includeRuleKeys: ReadonlySet<string>;
  excludeRuleKeys: ReadonlySet<string>;
}

const toStringSet = (values: ReadonlyArray<string> | undefined): ReadonlySet<string> => {
  if (!values || values.length === 0) return new Set<string>();
  const collected = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) collected.add(value);
  }
  return collected;
};

const buildResolvedControls = (
  surface: DiagnosticSurface,
  userControls: SurfaceControls | undefined,
): ResolvedSurfaceControls => {
  const baseExcludeTags = new Set<string>(DEFAULT_SURFACE_EXCLUDED_TAGS[surface]);
  const userIncludeTags = toStringSet(userControls?.includeTags);
  for (const includedTag of userIncludeTags) baseExcludeTags.delete(includedTag);
  const userExcludeTags = toStringSet(userControls?.excludeTags);
  for (const excludedTag of userExcludeTags) baseExcludeTags.add(excludedTag);

  return {
    includeTags: userIncludeTags,
    excludeTags: baseExcludeTags,
    includeCategories: toStringSet(userControls?.includeCategories),
    excludeCategories: toStringSet(userControls?.excludeCategories),
    includeRuleKeys: toStringSet(userControls?.includeRules),
    excludeRuleKeys: toStringSet(userControls?.excludeRules),
  };
};

const getRuleTags = (diagnostic: Diagnostic): ReadonlyArray<string> => {
  if (diagnostic.plugin !== "react-doctor") return [];
  const rule = reactDoctorPlugin.rules[diagnostic.rule];
  return rule?.tags ?? [];
};

const intersectsAny = (
  values: ReadonlyArray<string>,
  candidateSet: ReadonlySet<string>,
): boolean => {
  for (const value of values) {
    if (candidateSet.has(value)) return true;
  }
  return false;
};

export const isDiagnosticOnSurface = (
  diagnostic: Diagnostic,
  surface: DiagnosticSurface,
  config: ReactDoctorConfig | null,
): boolean => {
  const resolved = buildResolvedControls(surface, config?.surfaces?.[surface]);
  const ruleKey = `${diagnostic.plugin}/${diagnostic.rule}`;
  const tags = getRuleTags(diagnostic);

  if (resolved.includeRuleKeys.has(ruleKey)) return true;
  if (resolved.includeCategories.has(diagnostic.category)) return true;
  if (intersectsAny(tags, resolved.includeTags)) return true;

  if (resolved.excludeRuleKeys.has(ruleKey)) return false;
  if (resolved.excludeCategories.has(diagnostic.category)) return false;
  if (intersectsAny(tags, resolved.excludeTags)) return false;

  return true;
};

export const filterDiagnosticsForSurface = (
  diagnostics: Diagnostic[],
  surface: DiagnosticSurface,
  config: ReactDoctorConfig | null,
): Diagnostic[] =>
  diagnostics.filter((diagnostic) => isDiagnosticOnSurface(diagnostic, surface, config));
