---
name: cavuno-board-theme
description: Optional hosted-board theme compatibility with @cavuno/board/theme. Use only when a custom frontend deliberately mirrors or migrates an existing Cavuno hosted theme; the consuming application normally owns tokens, fonts, and color mode.
---

# Optional hosted-board theme compatibility

The custom frontend owns its visual system by default: semantic design tokens, component styles, font loading, and light/dark-mode state belong in the application. Do not make remote `board.context().theme` the default source of truth for a new SDK frontend.

`@cavuno/board/theme` exists for a narrower job: mirroring an existing hosted board or providing a starting point during a hosted-to-custom migration.

## When to use

- The human explicitly wants the custom frontend to mirror the current hosted board.
- A migration needs a temporary compatibility layer while tokens move into the application.
- One application intentionally renders many Cavuno boards with different operator-owned themes.

## When not to use

- A normal custom frontend whose design system already defines tokens and fonts.
- Component-level styling.
- As a replacement for the framework's theme provider or font system.

## Read compatibility values

```ts snippet
import {
  boardThemeToCss,
  googleFontsUrl,
  themeMode,
} from '@cavuno/board/theme';

const context = await board.context();
const hostedTheme = {
  css: boardThemeToCss(context.theme),
  fontUrl: googleFontsUrl(context.theme),
  mode: themeMode(context.theme),
};
```

`boardThemeToCss` validates the stored colors before emitting CSS. A null theme returns no CSS, so the application default remains intact.

## Migration guidance

1. Compare the returned colors, fonts, and mode with the consuming design system.
2. Move the chosen values into the application's own semantic tokens and font loader.
3. Remove the runtime theme injection when the application becomes authoritative.

If permanent multi-board mirroring is an explicit requirement, inject the validated CSS after the static theme and make the framework's theme provider apply the returned mode. Do not interpolate raw stored colors or build font URLs yourself.

## Verify

- [ ] The application renders correctly when `context.theme` is null.
- [ ] New custom frontends do not fetch theme data merely to establish basic styling.
- [ ] Compatibility CSS never contains unsafe stored color syntax.
- [ ] Font loading and color-mode ownership are explicit and tested.
- [ ] A migration has a documented point where the application becomes authoritative.
