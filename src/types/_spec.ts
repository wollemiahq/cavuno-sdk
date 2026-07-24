// The single source the public board response + body types are generated
// from: the v1 OpenAPI `components.schemas` map (itself generated from the
// server's Zod schemas). Public types alias into `Schemas[...]` so they
// track the contract — see `scripts/gen-types.ts` + the CI drift gate.
import type { components } from '../generated/openapi-types';

export type Schemas = components['schemas'];
