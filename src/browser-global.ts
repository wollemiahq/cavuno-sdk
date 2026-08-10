/**
 * Classic-script surface for static HTML and no-build integrations.
 *
 * Keep the root runtime exports in sync by construction. The five helper
 * namespaces deliberately mirror their public package subpaths without
 * flattening their symbols into the global root.
 */
export * from './index';
export * as filters from './filters';
export * as format from './format';
export * as paths from './paths';
export * as seo from './seo';
export * as suggest from './suggest';
