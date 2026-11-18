/**
 * `@cavuno/board/email` — a "did you mean" check for mistyped email
 * addresses, in the style of Mailcheck. The domain is compared with a short
 * list of common mailbox providers, and the closest one within one or two
 * edits (a transposed pair counts as one) is suggested. A real top-level
 * domain the person typed is kept. Only the domain is ever corrected, never
 * the part before the @.
 *
 * Pure and dependency-free, so it runs in the browser on blur and on the
 * server alike. A suggestion is a hint to show the person, not a check:
 * an address it leaves alone can still be wrong, and one it would correct
 * can still be real.
 */

/** Common mailbox domains, most used first: a tie goes to the earlier one. */
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
  'me.com',
  'mac.com',
  'googlemail.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'ymail.com',
  'rocketmail.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'gmx.at',
  'web.de',
  't-online.de',
  'freenet.de',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'qq.com',
  '163.com',
  'naver.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'cox.net',
  'charter.net',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.co.in',
  'yahoo.co.jp',
  'yahoo.com.au',
  'yahoo.com.br',
  'hotmail.co.uk',
  'hotmail.ca',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',
  'live.co.uk',
  'live.ca',
  'live.fr',
  'live.nl',
  'outlook.fr',
  'outlook.de',
  'outlook.es',
  'btinternet.com',
  'sky.com',
  'orange.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'wanadoo.fr',
  'libero.it',
  'virgilio.it',
  'bigpond.com',
  'optusnet.com.au',
  'shaw.ca',
  'rogers.com',
  'sympatico.ca',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ziggo.nl',
  'kpnmail.nl',
  'telenet.be',
  'skynet.be',
  'seznam.cz',
  'wp.pl',
  'o2.pl',
  'onet.pl',
  'interia.pl',
] as const;

const KNOWN = new Set<string>(COMMON_DOMAINS);

/** Real domains close enough to a provider's to be "corrected" to it. */
const NOT_TYPOS = new Set<string>([
  'cloud.com',
  'email.com',
  'foxmail.com',
  'online.de',
]);

/**
 * Real top-level domains a person may well mean. One of these is never
 * swapped for another (`mail.de` is not a typo of `mail.ru`); typos such as
 * `.con`, `.cm` or `.co` are not on the list, so they are corrected.
 */
const REAL_TLDS = new Set<string>([
  'com',
  'net',
  'org',
  'edu',
  'gov',
  'mil',
  'info',
  'biz',
  'eu',
  'us',
  'uk',
  'ca',
  'au',
  'nz',
  'ie',
  'de',
  'at',
  'ch',
  'fr',
  'be',
  'nl',
  'lu',
  'it',
  'es',
  'pt',
  'se',
  'no',
  'dk',
  'fi',
  'is',
  'pl',
  'cz',
  'sk',
  'hu',
  'ro',
  'gr',
  'ru',
  'ua',
  'tr',
  'il',
  'in',
  'jp',
  'kr',
  'cn',
  'hk',
  'tw',
  'sg',
  'my',
  'ph',
  'id',
  'th',
  'vn',
  'mx',
  'br',
  'ar',
  'cl',
  'za',
  'ng',
  'ke',
  'co.uk',
  'co.nz',
  'co.jp',
  'co.in',
  'co.il',
  'co.za',
  'co.id',
  'co.kr',
  'co.th',
  'com.au',
  'net.au',
  'com.br',
  'com.mx',
  'com.ar',
  'com.tw',
  'com.sg',
  'com.tr',
  'com.hk',
  'com.ph',
  'com.vn',
  'sa',
  'fm',
]);

/** `['yahoo', 'co.uk']` for `yahoo.co.uk`. */
function splitDomain(domain: string): [name: string, tld: string] {
  const dot = domain.indexOf('.');
  return [domain.slice(0, dot), domain.slice(dot + 1)];
}

/**
 * Edits allowed in a provider's name: none for a short name such as `aol` or
 * `gmx` (only its top-level domain is corrected), one for a name of four or
 * five letters, two for a longer one. Short names are only an edit or two
 * from unrelated real domains (`nike.com` is two from `live.com`).
 */
function nameEditsFor(name: string): number {
  if (name.length <= 3) return 0;
  return name.length <= 5 ? 1 : 2;
}

/**
 * Optimal string alignment distance: insertions, deletions, substitutions
 * and swaps of two neighbouring characters each cost one. Stops early and
 * answers `limit + 1` once the distance must exceed `limit`.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let twoBack: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2]! + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    twoBack = previous;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * The address with its domain corrected when the domain looks like a typo
 * of a common mailbox provider's, or `null` when it doesn't (including a
 * domain on the list, and anything that isn't `local@domain`).
 *
 * @example
 * ```ts
 * import { suggestEmailAddress } from '@cavuno/board/email';
 *
 * suggestEmailAddress('jane@gmial.com'); // 'jane@gmail.com'
 * suggestEmailAddress('jane@hotmail.con'); // 'jane@hotmail.com'
 * suggestEmailAddress('jane@gmail.com'); // null
 * ```
 */
export function suggestEmailAddress(email: string): string | null {
  const address = email.trim();
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return null;
  const local = address.slice(0, at);
  const domain = address
    .slice(at + 1)
    .toLowerCase()
    .replace(/\.+$/, '');
  if (!domain.includes('.') || KNOWN.has(domain) || NOT_TYPOS.has(domain)) {
    return null;
  }

  const [typedName, typedTld] = splitDomain(domain);
  const keepTld = REAL_TLDS.has(typedTld);
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of COMMON_DOMAINS) {
    const [name, tld] = splitDomain(candidate);
    // A real top-level domain stays; a mistyped one is one edit at most.
    if (keepTld && tld !== typedTld) continue;
    const tldDistance = keepTld ? 0 : editDistance(typedTld, tld, 1);
    if (tldDistance > 1) continue;
    const limit = nameEditsFor(name);
    const nameDistance = editDistance(typedName, name, limit);
    if (nameDistance > limit) continue;
    if (nameDistance + tldDistance < bestDistance) {
      best = candidate;
      bestDistance = nameDistance + tldDistance;
    }
  }
  return best === null ? null : `${local}@${best}`;
}
