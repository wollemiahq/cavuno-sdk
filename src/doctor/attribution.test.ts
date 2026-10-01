import { describe, expect, it } from 'vitest';

import { hasCrawlableCavunoBacklink } from './attribution';

describe('Cavuno attribution HTML', () => {
  it.each([
    '<a href="https://cavuno.com/?ref=board"><span>Powered by</span><svg></svg><span>Cavuno</span></a>',
    '<a href=https://www.cavuno.com>Cavuno</a>',
    '<A HREF="https://cavuno&#46;com">Bereitgestellt von Cavuno</A>',
    '<a href="https://cavuno.com"><img src="/brand.svg" alt="Cavuno"></a>',
    '<template id="B:2"></template><div hidden id="S:2"><footer><a href="https://cavuno.com">Cavuno</a></footer></div><script>$RC("B:2","S:2")</script>',
    '<template id="B:1"></template><div hidden id="S:1"><a href="https://cavuno.com">Cavuno</a></div><script>$RR("B:1","S:1",[["/_next/static/css/a.css","high"]])</script>',
    '<template id="P:3"></template><div hidden id="S:3"><a href="https://cavuno.com">Cavuno</a></div><script>$RS("S:3","P:3")</script>',
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
    '<div hidden id="S:2"><a href="https://cavuno.com">Cavuno</a></div>',
    '<div hidden id="S:2"><a href="https://cavuno.com">Cavuno</a></div><script>$RC("B:2","S:3")</script>',
    '<div hidden id="S:2"><a href="https://cavuno.com">Cavuno</a></div><p>$RC("B:2","S:2")</p>',
    '<div hidden id="P:3"><a href="https://cavuno.com">Cavuno</a></div><script>$RS("S:3","P:3")</script>',
    '<div hidden id="S:2"><a hidden href="https://cavuno.com">Cavuno</a></div><script>$RC("B:2","S:2")</script>',
    '<div hidden id="S:2" style="display:none"><a href="https://cavuno.com">Cavuno</a></div><script>$RC("B:2","S:2")</script>',
  ])('rejects missing, inert or explicitly hidden links: %s', (html) => {
    expect(hasCrawlableCavunoBacklink(html)).toBe(false);
  });
});
