import type { DiagnosticSurface, ReactDoctorConfig, SurfaceControls } from "@react-doctor/types";
import { DIAGNOSTIC_SURFACES, isDiagnosticSurface } from "./diagnostic-surface.js";

// Boolean fields where the user might write `"true"` / `"false"` strings
// in JSON by mistake. We coerce-and-warn rather than silently accept the
// string (which JS treats as truthy and bypasses the negation path).
const BOOLEAN_FIELD_NAMES = [
  "lint",
  "verbose",
  "customRulesOnly",
  "share",
  "respectInlineDisables",
  "adoptExistingLintConfig",
  "offline",
] as const satisfies ReadonlyArray<keyof ReactDoctorConfig>;

const STRING_FIELD_NAMES = ["rootDir"] as const satisfies ReadonlyArray<keyof ReactDoctorConfig>;

// HACK: write to stderr directly so the warning is visible even in
// `--json` mode (where the logger is silenced to keep stdout a single
// valid JSON document). Same pattern as `coerceDiffValue` in cli.ts.
const warnConfigField = (message: string): void => {
  process.stderr.write(`[react-doctor] ${message}\n`);
};

const coerceMaybeBooleanString = (fieldName: string, value: unknown): boolean | undefined => {
  if (typeof value === "boolean" || value === undefined) return value as boolean | undefined;
  if (value === "true") {
    warnConfigField(`config field "${fieldName}" is the string "true"; treating as boolean true.`);
    return true;
  }
  if (value === "false") {
    warnConfigField(
      `config field "${fieldName}" is the string "false"; treating as boolean false.`,
    );
    return false;
  }
  warnConfigField(
    `config field "${fieldName}" must be a boolean (got ${typeof value}); ignoring this field.`,
  );
  return undefined;
};

const validateString = (fieldName: string, value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  warnConfigField(
    `config field "${fieldName}" must be a string (got ${typeof value}); ignoring this field.`,
  );
  return undefined;
};

const SURFACE_CONTROL_FIELD_NAMES = [
  "includeTags",
  "excludeTags",
  "includeCategories",
  "excludeCategories",
  "includeRules",
  "excludeRules",
] as const satisfies ReadonlyArray<keyof SurfaceControls>;

const validateStringArrayField = (fieldName: string, value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    warnConfigField(
      `config field "${fieldName}" must be an array of strings (got ${typeof value}); ignoring this field.`,
    );
    return undefined;
  }
  const collected: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      warnConfigField(
        `config field "${fieldName}" contains a non-string entry (${typeof entry}); ignoring the entry.`,
      );
      continue;
    }
    collected.push(entry);
  }
  return collected;
};

const validateSurfaceControls = (
  surface: DiagnosticSurface,
  rawControls: unknown,
): SurfaceControls | undefined => {
  if (rawControls === undefined) return undefined;
  if (typeof rawControls !== "object" || rawControls === null || Array.isArray(rawControls)) {
    warnConfigField(
      `config field "surfaces.${surface}" must be an object (got ${typeof rawControls}); ignoring this surface.`,
    );
    return undefined;
  }
  const validated: SurfaceControls = {};
  for (const fieldName of SURFACE_CONTROL_FIELD_NAMES) {
    const value = (rawControls as Record<string, unknown>)[fieldName];
    const validatedValue = validateStringArrayField(`surfaces.${surface}.${fieldName}`, value);
    if (validatedValue !== undefined) {
      (validated as Record<string, string[]>)[fieldName] = validatedValue;
    }
  }
  return validated;
};

const validateSurfacesField = (
  rawSurfaces: unknown,
): Partial<Record<DiagnosticSurface, SurfaceControls>> | undefined => {
  if (rawSurfaces === undefined) return undefined;
  if (typeof rawSurfaces !== "object" || rawSurfaces === null || Array.isArray(rawSurfaces)) {
    warnConfigField(
      `config field "surfaces" must be an object (got ${typeof rawSurfaces}); ignoring this field.`,
    );
    return undefined;
  }
  const validated: Partial<Record<DiagnosticSurface, SurfaceControls>> = {};
  for (const [key, value] of Object.entries(rawSurfaces)) {
    if (!isDiagnosticSurface(key)) {
      warnConfigField(
        `config field "surfaces.${key}" is not a known surface (expected one of: ${DIAGNOSTIC_SURFACES.join(", ")}); ignoring.`,
      );
      continue;
    }
    const controls = validateSurfaceControls(key, value);
    if (controls !== undefined) validated[key] = controls;
  }
  return validated;
};

// Returns a config with boolean fields coerced from common JSON-typing
// mistakes (string "true"/"false") and other invalid types stripped.
// Non-boolean fields pass through untouched — the consumer still does
// its own runtime checks for those.
export const validateConfigTypes = (config: ReactDoctorConfig): ReactDoctorConfig => {
  const validated: ReactDoctorConfig = { ...config };
  for (const fieldName of BOOLEAN_FIELD_NAMES) {
    const original = (config as Record<string, unknown>)[fieldName];
    if (original === undefined) continue;
    const coerced = coerceMaybeBooleanString(fieldName, original);
    if (coerced === undefined) {
      delete (validated as Record<string, unknown>)[fieldName];
    } else {
      (validated as Record<string, unknown>)[fieldName] = coerced;
    }
  }
  for (const fieldName of STRING_FIELD_NAMES) {
    const original = (config as Record<string, unknown>)[fieldName];
    if (original === undefined) continue;
    const validatedString = validateString(fieldName, original);
    if (validatedString === undefined) {
      delete (validated as Record<string, unknown>)[fieldName];
    } else {
      (validated as Record<string, unknown>)[fieldName] = validatedString;
    }
  }
  if ((config as Record<string, unknown>).surfaces !== undefined) {
    const validatedSurfaces = validateSurfacesField((config as Record<string, unknown>).surfaces);
    if (validatedSurfaces === undefined) {
      delete (validated as Record<string, unknown>).surfaces;
    } else {
      (validated as Record<string, unknown>).surfaces = validatedSurfaces;
    }
  }
  return validated;
};
