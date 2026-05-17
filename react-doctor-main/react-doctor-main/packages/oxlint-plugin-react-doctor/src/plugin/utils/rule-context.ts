import type { ReportDescriptor } from "./report-descriptor.js";

export interface RuleContext {
  report: (descriptor: ReportDescriptor) => void;
  getFilename?: () => string;
  readonly settings?: Readonly<Record<string, unknown>>;
}
