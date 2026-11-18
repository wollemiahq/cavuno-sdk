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
 * What `emailPreferences.update` returns: the preferences after the change,
 * and `confirmationEmailQueued`, true when the change emailed a fresh
 * confirmation link. Say "check your inbox" only when it is true.
 */
export type EmailPreferencesUpdateResult =
  Schemas['PublicEmailPreferencesUpdateResult'];

/**
 * Body for `emailPreferences.update`. Turning marketing or a topic on needs
 * `consentText`, the wording shown next to the switch, naming the board.
 */
export type EmailPreferencesUpdate = Schemas['EmailPreferencesUpdateBody'];
