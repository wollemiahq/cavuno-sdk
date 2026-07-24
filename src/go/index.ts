/**
 * `@cavuno/board/go` — framework-portable `/go` indirection handler
 *.
 *
 * Starters mount this at `/go/*` the same way they mount the sitemap
 * walker. Pure Request → Response; no Next.js (or any framework) imports.
 */

export {
  createGoHandler,
  resolveGoRedirect,
  goResponseHeaders,
  type CreateGoHandlerConfig,
  type GoJobLookup,
  type ResolvedJobSlugs,
  type GoRedirectResult,
} from './create-go-handler';
