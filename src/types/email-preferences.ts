// Email preferences types. Response and body entities alias the generated
// OpenAPI components.
import type { Schemas } from './_spec';

/**
 * A person's email preferences on the board (`emailPreferences.get`): their
 * job alerts, job matches (null when the board sends them none), marketing,
 * and every live marketing topic.
 */
export type EmailPreferences = Schemas['PublicEmailPreferences'];

/**
 * Body for `emailPreferences.update`. Turning marketing or a topic on needs
 * `consentText`, the wording shown next to the switch, naming the board.
 */
export type EmailPreferencesUpdate = Schemas['EmailPreferencesUpdateBody'];
