/**
 * Kept in lockstep with the package.json `version` field — guarded by
 * version.test.ts, which fails the suite on any drift. A hand-written
 * constant because the package is platform-neutral and cannot read
 * package.json at runtime.
 */
export const SDK_VERSION = '4.10.0'; //
