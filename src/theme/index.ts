/**
 * `@cavuno/board/theme` — board theme → shadcn CSS-variable overrides
 *.
 *
 * The board's stored theme (16 semantic colors × light/dark from
 * `board.context().theme`) is mapped onto the canonical shadcn token
 * vocabulary and emitted as overrides of the app's theme block. One
 * contract, two consumers: the dashboard edits the board theme, and agents
 * restyle through the standard shadcn theme file — both end up in the same
 * tokens. The hosted board renders the same 16 source colors through its
 * own token system; a coverage golden  asserts neither side
 * silently drops a color key.
 *
 * A null theme emits nothing — the app's static default theme applies
 * untouched.
 */

/** The 16 board color keys (the wire ships them as an open record). */
export const BOARD_COLOR_KEYS = [
  'brandColor',
  'buttonPrimary',
  'buttonPrimaryText',
  'buttonDanger',
  'background',
  'surfaceBackground',
  'mutedBackground',
  'highlightBackground',
  'text',
  'textSubtle',
  'textMuted',
  'textDisabled',
  'textError',
  'border',
  'contrastBackground',
  'contrastText',
] as const;

export type BoardColorKey = (typeof BOARD_COLOR_KEYS)[number];

/**
 * Structural input — satisfied by the SDK's `PublicBoardTheme` (whose color
 * records are open on the wire) and any narrowed server copy.
 */
export interface ThemeInput {
  mode: string;
  schemeId: string;
  typography: { fontSans: string; fontHeading?: string | null };
  colors: {
    light?: Record<string, unknown>;
    dark?: Record<string, unknown>;
  };
}

/**
 * Characters that let a color value break out of a `<style>` block and mount a
 * stored XSS. Theme colors are attacker-controllable — a board team-member with
 * `settings.manage` writes them (the write path validates colors as bare
 * strings) and the public unauthenticated board API re-serves the open color
 * record verbatim — and consumers emit the mapped token straight into
 * `<style>{ --token: <value> }`. A value like
 * `red} </style><script>…</script>` breaks the stylesheet out. None of these
 * characters — nor a C0/C1/DEL control or U+2028/U+2029 line separator —
 * appears in a legitimate CSS color, `var()`, `rgb()`, `hsl()`, or `oklch()`
 * value, so any value carrying one is dropped (the token is not emitted → the
 * static default applies).
 *
 * SECURITY DENYLIST — the single source of truth for the theme-color guard.
 * The Board API uses the `isSafeThemeColorValue` predicate below rather than
 * re-declaring the regex, so the two layers cannot drift.
 */
// eslint-disable-next-line no-control-regex
const CSS_INJECTION_CHARS = /[<>{};]|[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/**
 * True when `value` is safe to emit inside a `<style>` CSS declaration — i.e.
 * carries none of the breakout characters above. Shared by the SDK render sink
 * (`boardThemeToCss`) and the hosted public-API serializer, so the denylist
 * lives in exactly one place.
 */
export function isSafeThemeColorValue(value: string): boolean {
  return !CSS_INJECTION_CHARS.test(value);
}

function color(
  colors: Record<string, unknown>,
  key: BoardColorKey,
): string | undefined {
  const value = colors[key];
  if (typeof value !== 'string' || !value) return undefined;
  return isSafeThemeColorValue(value) ? value : undefined;
}

/**
 * Email-safe snapshot keys.
 * Light-only subset consumed by server-rendered email branding.
 */
export type EmailSafeSnapshotColorKey =
  | 'buttonPrimary'
  | 'buttonPrimaryText'
  | 'background'
  | 'mutedBackground'
  | 'border'
  | 'text'
  | 'textMuted'
  | 'brandColor';

/**
 * Inverse of the email-safe subset of `tokenLines`: for each snapshot
 * color key, the ordered list of CSS custom property names (no `--`)
 * that may supply it. First PRESENT property wins when DIFFERENT CSS
 * names map to one snapshot key (e.g. muted > secondary for
 * mutedBackground). Within one CSS property name, multi-`:root` cascade
 * is last-wins and is resolved before this table is consulted.
 *
 * Additive export for the platform brand-snapshot deriver —
 * keeps the CSS ↔ board contract next to its forward twin.
 */
export const EMAIL_SAFE_SNAPSHOT_FROM_CSS: {
  readonly [K in EmailSafeSnapshotColorKey]: readonly string[];
} = {
  buttonPrimary: ['primary'],
  buttonPrimaryText: ['primary-foreground'],
  background: ['background'],
  // Muted wins; secondary fills only when --muted is absent.
  mutedBackground: ['muted', 'secondary'],
  border: ['border'],
  text: ['foreground'],
  textMuted: ['muted-foreground'],
  brandColor: ['ring'],
};

/**
 * Board key → CSS custom property name(s) (no `--` prefix).
 *
 * The forward write contract for the builder theme tab and the
 * emission table for `boardThemeToCss` / `tokenLines` — one table, so a
 * tab edit and a render path cannot drift. When a board key fans out to
 * several CSS names (e.g. `text` → foreground + card-foreground + …),
 * a single tab edit writes every name with the same hex value.
 *
 * Fallbacks that only apply at *emit* time when a preferred key is
 * absent (`destructive` ← buttonDanger ?? textError; `ring` ← brandColor
 * ?? buttonPrimary) stay in `tokenLines` — they are not owned write
 * targets of the fallback key.
 */
export const BOARD_COLOR_TO_CSS_TOKENS: {
  readonly [K in BoardColorKey]: readonly string[];
} = {
  background: ['background'],
  text: [
    'foreground',
    'card-foreground',
    'popover-foreground',
    'secondary-foreground',
    'accent-foreground',
  ],
  surfaceBackground: ['card', 'popover'],
  mutedBackground: ['secondary', 'muted'],
  highlightBackground: ['accent'],
  buttonPrimary: ['primary'],
  buttonPrimaryText: ['primary-foreground'],
  buttonDanger: ['destructive'],
  textMuted: ['muted-foreground'],
  border: ['border', 'input'],
  brandColor: ['ring'],
  contrastBackground: ['contrast-background'],
  contrastText: ['contrast-foreground'],
  textSubtle: ['foreground-subtle'],
  textDisabled: ['foreground-disabled'],
  textError: ['foreground-error'],
};

/**
 * CSS custom property names (without `--`) backed by optional color tokens.
 * A starter may omit these declarations; required declarations must still
 * be present.
 */
export const OPTIONAL_THEME_DECLARATIONS = [
  'foreground-subtle',
  'foreground-disabled',
] as const;

export type OptionalThemeDeclaration =
  (typeof OPTIONAL_THEME_DECLARATIONS)[number];

/** True when a CSS custom property name (with or without `--`) is optional. */
export function isOptionalThemeDeclaration(token: string): boolean {
  const name = token.startsWith('--') ? token.slice(2) : token;
  return (OPTIONAL_THEME_DECLARATIONS as readonly string[]).includes(name);
}

/**
 * Board key → shadcn token(s). Driven by `BOARD_COLOR_TO_CSS_TOKENS` so the
 * theme-tab write path and this emission path share one contract. Tests
 * pin the mapping so a drive-by "improvement" can't silently restyle
 * every board.
 */
function tokenLines(colors: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const set = (token: string, value: string | undefined) => {
    if (value) lines.push(`  --${token}: ${value};`);
  };

  for (const boardKey of BOARD_COLOR_KEYS) {
    const value = color(colors, boardKey);
    if (!value) continue;
    for (const cssToken of BOARD_COLOR_TO_CSS_TOKENS[boardKey]) {
      set(cssToken, value);
    }
  }

  // Emit-time fallbacks only — not owned write targets of the fallback key.
  // Prefer buttonDanger for destructive; textError fills when absent.
  if (!color(colors, 'buttonDanger') && color(colors, 'textError')) {
    set('destructive', color(colors, 'textError'));
  }
  // Prefer brandColor for ring; buttonPrimary fills when absent.
  if (!color(colors, 'brandColor') && color(colors, 'buttonPrimary')) {
    set('ring', color(colors, 'buttonPrimary'));
  }

  return lines;
}

/**
 * Render the board theme as `:root` (+ `.dark`) CSS-variable overrides.
 * Inject once at the app shell, after the static theme stylesheet.
 *
 * @example
 * const css = boardThemeToCss((await board.context()).theme);
 */
export function boardThemeToCss(theme: ThemeInput | null): string {
  if (!theme) return '';

  const light = tokenLines(theme.colors.light ?? {});
  const dark = tokenLines(theme.colors.dark ?? {});

  const fontSans = theme.typography?.fontSans;
  const genericStack = 'ui-sans-serif, system-ui, sans-serif';
  const sansStack = fontSans
    ? `'${themeFontFamily(fontSans)}', ${genericStack}`
    : genericStack;
  if (fontSans) {
    // `fontSans` is also attacker-controllable but is not the same XSS class:
    // `themeFontFamily` maps known keys to a fixed slug and runs unknown keys
    // through `encodeURIComponent`, which percent-encodes `< > { } ; " /` — so a
    // value can neither open a tag, close the `<style>` block, nor start a new
    // CSS declaration/rule. `encodeURIComponent` does NOT encode `'`, so a value
    // can still terminate this single-quoted family string early; but with no
    // `;`/`}`/`<` that only yields a malformed font value on that board, not
    // markup or a new declaration. Preserve this if you change
    // `themeFontFamily`/`googleFamily`.
    light.push(`  --font-sans: ${sansStack};`);
  }

  // Heading face falls back through the sans stack — the hosted board's
  // exact rule (theme-css-generator builds headingStack = `heading,
  // sansStack`). Absent on the wire → not emitted, so the app's static
  // default (conventionally `--font-heading: var(--font-sans)`) applies.
  // Same injection posture as fontSans: `themeFontFamily` percent-encodes
  // every breakout character.
  const fontHeading = theme.typography?.fontHeading;
  if (fontHeading) {
    light.push(
      `  --font-heading: '${themeFontFamily(fontHeading)}', ${sansStack};`,
    );
  }

  const blocks: string[] = [];
  if (light.length > 0) blocks.push(`:root {\n${light.join('\n')}\n}`);
  if (dark.length > 0) blocks.push(`.dark {\n${dark.join('\n')}\n}`);
  return blocks.join('\n\n');
}

/** The board's color-scheme preference; unknown/absent → `system`. */
export function themeMode(
  theme: ThemeInput | null,
): 'light' | 'dark' | 'system' {
  if (!theme) return 'system';
  return theme.mode === 'light' || theme.mode === 'dark'
    ? theme.mode
    : 'system';
}

/**
 * Theme font key → Google Fonts family slug, transcribed from the hosted
 * board's `theme-fonts-metadata.ts` (tested against it). The wire's
 * `typography.fontSans` is an internal KEY (`'source-sans-pro'`), and the
 * Google family is not always a re-casing of it (`source-sans-pro` →
 * `Source+Sans+3`) — never build a font request from the raw key.
 */
export const THEME_FONT_GOOGLE_FAMILIES: Record<string, string> = {
  'be-vietnam-pro': 'Be+Vietnam+Pro',
  inter: 'Inter',
  'plus-jakarta-sans': 'Plus+Jakarta+Sans',
  'dm-sans': 'DM+Sans',
  'public-sans': 'Public+Sans',
  figtree: 'Figtree',
  'work-sans': 'Work+Sans',
  'open-sans': 'Open+Sans',
  poppins: 'Poppins',
  hind: 'Hind',
  lexend: 'Lexend',
  'fira-sans': 'Fira+Sans',
  manrope: 'Manrope',
  'source-sans-pro': 'Source+Sans+3',
  outfit: 'Outfit',
  'space-grotesk': 'Space+Grotesk',
  geist: 'Geist',
  'source-serif-4': 'Source+Serif+4',
  lora: 'Lora',
  'crimson-pro': 'Crimson+Pro',
};

/** Google family slug for a font key; unknown keys (future additions) fall
 * back to a slug built from the raw value so nothing hard-fails. */
function googleFamily(fontKey: string): string {
  return (
    THEME_FONT_GOOGLE_FAMILIES[fontKey] ??
    encodeURIComponent(fontKey).replaceAll('%20', '+')
  );
}

/**
 * The CSS `font-family` name the Google stylesheet registers for a font key
 * — the name `--font-sans` must reference for the loaded font to apply
 * (e.g. `'source-sans-pro'` → `"Source Sans 3"`).
 */
export function themeFontFamily(fontKey: string): string {
  return googleFamily(fontKey).replaceAll('+', ' ');
}

/** One Google Fonts request covering the sans + heading families. */
export function googleFontsUrl(theme: ThemeInput | null): string | null {
  if (!theme) return null;
  const families = new Set<string>();
  if (theme.typography?.fontSans) {
    families.add(googleFamily(theme.typography.fontSans));
  }
  if (theme.typography?.fontHeading) {
    families.add(googleFamily(theme.typography.fontHeading));
  }
  if (families.size === 0) return null;

  const params = [...families]
    .map((f) => `family=${f}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
