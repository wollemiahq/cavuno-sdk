import { describe, expect, it } from 'vitest';

import { hasCrawlableCavunoBacklink } from './attribution';

describe('Cavuno attribution HTML', () => {
  it.each([
    '<a href="https://cavuno.com/?ref=board"><span>Powered by</span><svg></svg><span>Cavuno</span></a>',
    '<a href=https://www.cavuno.com>Cavuno</a>',
    '<A HREF="https://cavuno&#46;com">Bereitgestellt von Cavuno</A>',
    '<a href="https://cavuno.com"><img src="/brand.svg" alt="Cavuno"></a>',
  ])('accepts a real backlink: %s', (html) => {
    expect(hasCrawlableCavunoBacklink(html)).toBe(true);
  });

  it.each([
    '<div data-cavuno-attribution>badge</div>',
    '<p>data-cavuno-attribution</p>',
    '<script>const link = \'<a href="https://cavuno.com">Cavuno</a>\';</script>',
    '<script>const marker = "data-cavuno-attribution";</script>',
    '<!-- <a href="https://cavuno.com">Cavuno</a> -->',
    '<template><a href="https://cavuno.com">Cavuno</a></template>',
    '<a data-href="https://cavuno.com">Cavuno</a>',
    '<a href="https://example.com" title=\'href="https://cavuno.com"\'>Cavuno</a>',
    '<a href="https://cavuno.com"></a>',
    '<a href="https://cavuno.com"><span hidden>Cavuno</span></a>',
    '<a hidden href="https://cavuno.com">Cavuno</a>',
    '<div hidden><a href="https://cavuno.com">Cavuno</a></div>',
    '<div aria-hidden="true"><a href="https://cavuno.com">Cavuno</a></div>',
    '<div style="display: none !important"><a href="https://cavuno.com">Cavuno</a></div>',
    '<a style="visibility:hidden" href="https://cavuno.com">Cavuno</a>',
    '<a style="opacity:0" href="https://cavuno.com">Cavuno</a>',
    '<a href="https://cavuno.com.example.org">Cavuno</a>',
  ])('rejects missing, inert or explicitly hidden links: %s', (html) => {
    expect(hasCrawlableCavunoBacklink(html)).toBe(false);
  });
});
