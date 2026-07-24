import { describe, expect, it } from 'vitest';

import {
  BOARD_COLOR_KEYS,
  boardThemeToCss,
  googleFontsUrl,
  themeMode,
} from './index';

import type { ThemeInput } from './index';

// The board-key → shadcn-token mapping is the theming CONTRACT between the
// dashboard's theme editor and every tenant frontend — these pin it so a
// drive-by "improvement" can't silently restyle every board.

function theme(overrides: Partial<ThemeInput> = {}): ThemeInput {
  return {
    mode: 'light',
    schemeId: 'custom',
    typography: { fontSans: 'Inter' },
    colors: {},
    ...overrides,
  };
}

describe('boardThemeToCss', () => {
  it('a null theme emits nothing (static default applies untouched)', () => {
    expect(boardThemeToCss(null)).toBe('');
  });

  it('maps the board keys onto the shadcn tokens', () => {
    const css = boardThemeToCss(
      theme({
        colors: {
          light: {
            background: '#ffffff',
            text: '#242424',
            buttonPrimary: '#7c3aed',
            buttonPrimaryText: '#ffffff',
            mutedBackground: '#f5f5f5',
            textMuted: '#9ca3af',
            highlightBackground: '#fdf4ff',
            border: '#e5e7eb',
            brandColor: '#7c3aed',
          },
        },
      }),
    );
    expect(css).toContain('--background: #ffffff;');
    expect(css).toContain('--foreground: #242424;');
    expect(css).toContain('--primary: #7c3aed;');
    expect(css).toContain('--primary-foreground: #ffffff;');
    expect(css).toContain('--secondary: #f5f5f5;');
    expect(css).toContain('--muted-foreground: #9ca3af;');
    expect(css).toContain('--accent: #fdf4ff;');
    expect(css).toContain('--border: #e5e7eb;');
    expect(css).toContain('--input: #e5e7eb;');
    expect(css).toContain('--ring: #7c3aed;');
    expect(css).toContain(':root {');
    expect(css).not.toContain('.dark {');
  });

  it('every one of the 16 board color keys is consumed (none silently dropped)', () => {
    for (const key of BOARD_COLOR_KEYS) {
      const withKey = boardThemeToCss(
        theme({ colors: { light: { [key]: '#123456' } } }),
      );
      expect(withKey, key).toContain('#123456');
    }
  });

  it('fallback chains: destructive prefers buttonDanger; ring prefers brandColor', () => {
    expect(
      boardThemeToCss(theme({ colors: { light: { textError: '#dc2626' } } })),
    ).toContain('--destructive: #dc2626;');
    expect(
      boardThemeToCss(
        theme({
          colors: {
            light: { buttonDanger: '#b91c1c', textError: '#dc2626' },
          },
        }),
      ),
    ).toContain('--destructive: #b91c1c;');
    expect(
      boardThemeToCss(
        theme({ colors: { light: { buttonPrimary: '#0ea5e9' } } }),
      ),
    ).toContain('--ring: #0ea5e9;');
  });

  it('dark palette emits a .dark block; non-string values are ignored', () => {
    const css = boardThemeToCss(
      theme({
        colors: {
          light: { background: '#fff' },
          dark: { background: '#0a0a0a', text: 42, border: '' },
        },
      }),
    );
    expect(css).toContain('.dark {\n  --background: #0a0a0a;\n}');
    expect(css).not.toContain('42');
  });

  it('drops CSS-injection payloads so an attacker cannot break out of <style>', () => {
    // A board team-member with settings.manage can store an arbitrary string
    // in any theme color — boards.settings.update validates colors as bare
    // v.string() — and the public unauthenticated board API re-serves it
    // verbatim. Consumers inject the mapped token straight into
    // `<style>{ --token: <value> }`, so a value carrying `</style>` (or a `}`
    // breakout) is a stored XSS against every job-seeker on the board. The
    // dangerous value must never reach the emitted stylesheet.
    const payload = 'red} </style><script>alert(document.cookie)</script>';
    const css = boardThemeToCss(
      theme({
        colors: {
          light: { background: payload, text: '#242424' },
          dark: { background: payload },
        },
      }),
    );
    expect(css).not.toContain('</style>');
    expect(css).not.toContain('<script>');
    expect(css).not.toContain(payload);
    // `{`, `}`, `;` are legitimate CSS structure — but `<`/`>` never appear in
    // valid output, so their absence proves no markup breakout survived.
    expect(css).not.toMatch(/[<>]/);
    // The poisoned color is dropped (default token applies); the safe sibling
    // token is still emitted, proving we drop only the offending value.
    expect(css).toContain('--foreground: #242424;');
  });

  it('snapshot-shaped context theme hydrates after a color change', () => {
    // The public board-context theme for a snapshot-carrying board is the
    // email-safe light subset mirrored onto light+dark. The widget
    // and SDK BoardTheme consume it via boardThemeToCss with no adapter.
    const before = theme({
      typography: { fontSans: 'geist', fontHeading: 'lora' },
      colors: {
        light: {
          buttonPrimary: '#111111',
          brandColor: '#111111',
          background: '#FBFAF7',
          text: '#26221C',
        },
        dark: {
          buttonPrimary: '#111111',
          brandColor: '#111111',
          background: '#FBFAF7',
          text: '#26221C',
        },
      },
    });
    expect(boardThemeToCss(before)).toContain('--primary: #111111;');

    // Builder color change after sync — hydrated CSS must track the new value.
    const after = theme({
      typography: { fontSans: 'geist', fontHeading: 'lora' },
      colors: {
        light: {
          buttonPrimary: '#C026D3',
          brandColor: '#C026D3',
          background: '#FBFAF7',
          text: '#26221C',
        },
        dark: {
          buttonPrimary: '#C026D3',
          brandColor: '#C026D3',
          background: '#FBFAF7',
          text: '#26221C',
        },
      },
    });
    const css = boardThemeToCss(after);
    expect(css).toContain('--primary: #C026D3;');
    expect(css).toContain('--ring: #C026D3;');
    expect(css).not.toContain('#111111');
  });

  it('emits the font-sans stack from the MAPPED family, not the raw key', () => {
    expect(
      boardThemeToCss(theme({ typography: { fontSans: 'inter' } })),
    ).toContain("--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;");
    // The wire ships internal keys; the Google family is not always a
    // re-casing (source-sans-pro loads as "Source Sans 3").
    expect(
      boardThemeToCss(theme({ typography: { fontSans: 'source-sans-pro' } })),
    ).toContain("--font-sans: 'Source Sans 3',");
  });

  it('emits the font-heading stack with the sans family as its fallback (hosted parity)', () => {
    // Hosted builds headingStack = `heading, sansStack` (theme-css-generator);
    // the SDK mirrors it so display type follows the board theme everywhere.
    expect(
      boardThemeToCss(
        theme({ typography: { fontSans: 'inter', fontHeading: 'lora' } }),
      ),
    ).toContain(
      "--font-heading: 'Lora', 'Inter', ui-sans-serif, system-ui, sans-serif;",
    );
    // Mapped family, not the raw key (same rule as font-sans).
    expect(
      boardThemeToCss(
        theme({
          typography: { fontSans: 'inter', fontHeading: 'source-serif-4' },
        }),
      ),
    ).toContain("--font-heading: 'Source Serif 4',");
  });

  it('omits --font-heading when the wire carries no fontHeading (static default applies)', () => {
    expect(
      boardThemeToCss(theme({ typography: { fontSans: 'inter' } })),
    ).not.toContain('--font-heading');
  });
});

describe('themeMode', () => {
  it('normalizes to light/dark/system', () => {
    expect(themeMode(null)).toBe('system');
    expect(themeMode(theme({ mode: 'dark' }))).toBe('dark');
    expect(themeMode(theme({ mode: 'auto' }))).toBe('system');
  });
});

describe('googleFontsUrl', () => {
  it('builds one request from MAPPED Google families, deduped', () => {
    expect(
      googleFontsUrl(
        theme({
          typography: { fontSans: 'source-sans-pro', fontHeading: 'lora' },
        }),
      ),
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap',
    );
    expect(
      googleFontsUrl(
        theme({ typography: { fontSans: 'inter', fontHeading: 'inter' } }),
      ),
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    );
    // Unknown future keys degrade to an encoded slug, never a crash.
    expect(
      googleFontsUrl(theme({ typography: { fontSans: 'brand-new-font' } })),
    ).toContain('family=brand-new-font');
    expect(googleFontsUrl(null)).toBeNull();
  });
});
