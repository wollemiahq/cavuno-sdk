/**
 *  — shared types for the route-derivation adapter registry.
 */

export type DerivedRoute = {
  path: string;
  navigable: boolean;
  /**
   * Originating file when the parser tracked it (worker compile path).
   * Omitted from the navigator public contract via deriveRoutes strip.
   */
  sourcePath?: string;
};

export type FrameworkId =
  | 'tanstack'
  | 'next'
  | 'astro'
  | 'sveltekit'
  | 'nuxt'
  | 'react-router';
