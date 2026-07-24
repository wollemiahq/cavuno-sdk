/**
 * Programmatic doctor surface used by the `cavuno-board doctor` CLI and
 * integrations that need structured diagnostic results.
 */
export { runDoctor } from './run';
export type { DoctorRun, RunDoctorOptions } from './run';
export type { CheckResult, CheckStatus, DoctorEnv, DoctorSummary } from './checks';
