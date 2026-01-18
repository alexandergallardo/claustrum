/**
 * Logging and progress tracking utilities for the ITCR seeder.
 * Provides step tracking, formatted console output, and failure reporting.
 */

/**
 * Internal state for tracking the last executed step.
 */
let __lastStep: string | null = null;

/**
 * Sets the current step name for progress tracking.
 * This value is included in failure reports to help diagnose where errors occurred.
 *
 * @param step - The name/description of the current step
 */
export function setStep(step: string): void {
  __lastStep = step;
}

/**
 * Retrieves the name of the last executed step.
 * Returns "(unknown)" if no step has been set.
 *
 * @returns The name of the last step, or "(unknown)" if not set
 */
export function getLastStep(): string {
  return __lastStep ?? "(unknown)";
}

/**
 * Logs a section header to the console.
 * Used to separate major phases of the seeding process.
 *
 * @param title - The section title to display
 */
export function logSection(title: string): void {
  console.log(`\n${title}`);
}

/**
 * Logs a progress message with a horizontal ellipsis indicator.
 * Used for ongoing operations that may take time.
 *
 * @param message - The progress message to display
 */
export function logProgress(message: string): void {
  console.log(`  ⋯ ${message}`);
}

/**
 * Logs a success message with a checkmark indicator.
 * Used when an operation completes successfully.
 *
 * @param message - The success message to display
 */
export function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`);
}

/**
 * Logs an informational message with a bullet point indicator.
 * Used for general information that doesn't require special attention.
 *
 * @param message - The info message to display
 */
export function logInfo(message: string): void {
  console.log(`  • ${message}`);
}

/**
 * Logs a warning message with a warning symbol indicator.
 * Used for non-critical issues that should be noted.
 *
 * @param message - The warning message to display
 */
export function logWarn(message: string): void {
  console.log(`  ⚠ ${message}`);
}

/**
 * Logs an error message with an X mark indicator.
 * Used for errors that are handled and don't stop execution.
 *
 * @param message - The error message to display
 */
export function logError(message: string): void {
  console.log(`  ✗ ${message}`);
}

/**
 * Prints a formatted failure report to stderr when the seeder encounters a top-level error.
 * The report includes the last step, TLS settings, and likely error source.
 *
 * @param err - The error that caused the failure
 */
export function printTopLevelFailureReport(err: unknown): void {
  const insecure = envBool("SEED_INSECURE_HTTPS", false);

  const e = err instanceof Error ? err : new Error(String(err));
  const stack = e.stack ?? "";
  const message = e.message ?? String(err);

  const isItcr =
    message.includes("tec-appsext.itcr.ac.cr") ||
    stack.includes("tec-appsext.itcr.ac.cr");
  const isSupabaseRest =
    message.includes("/rest/v1") || stack.includes("/rest/v1");

  const lines: string[] = [];
  lines.push("");
  lines.push("========================================");
  lines.push("ITCR seeder failed");
  lines.push("========================================");
  lines.push(`Last step: ${getLastStep()}`);
  lines.push(`SEED_INSECURE_HTTPS: ${insecure ? "enabled" : "disabled"}`);
  lines.push(
    `Likely source: ${isSupabaseRest ? "Supabase REST (/rest/v1)" : isItcr ? "ITCR HTTPS endpoints" : "unknown"}`,
  );
  lines.push("");
  lines.push("Error message:");
  lines.push(message);
  lines.push("========================================");
  lines.push("");

  console.error(lines.join("\n"));
}

/**
 * Parses a boolean environment variable.
 * Accepts "1", "true", "yes", or "on" as true values (case-insensitive).
 *
 * @param name - The environment variable name
 * @param defaultValue - The value to return if the variable is not set (default: false)
 * @returns The parsed boolean value
 */
export function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v == null || v === "") return defaultValue;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
