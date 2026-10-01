import { parse, type DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

const NON_RENDERED = new Set([
  'head',
  'script',
  'style',
  'template',
  'noscript',
  'textarea',
]);

function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

/**
 * React streams a late Suspense segment into `<div hidden id="S:n">` and an
 * inline script moves it into the page (`$RC("B:n","S:n")`,
 * `$RR("B:n","S:n",[…])` with stylesheets, or `$RS("S:n","P:n")`), so
 * browsers and crawlers render it. Collect the segment ids those scripts reveal.
 */
const STREAMED_REVEAL =
  /\$R[CR]\(\s*"[^"]+"\s*,\s*"([^"]+)"|\$RS\(\s*"([^"]+)"/g;

function revealedSegmentIds(root: Node): Set<string> {
  const ids = new Set<string>();
  function visit(node: Node): void {
    if ('tagName' in node && node.tagName === 'script') {
      for (const child of node.childNodes) {
        if (child.nodeName !== '#text') continue;
        const text = (child as DefaultTreeAdapterTypes.TextNode).value;
        for (const match of text.matchAll(STREAMED_REVEAL)) {
          ids.add((match[1] ?? match[2])!);
        }
      }
      return;
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(root);
  return ids;
}

function hidden(node: Element, revealed: ReadonlySet<string>): boolean {
  const id = attribute(node, 'id');
  const streamedSegment =
    node.tagName === 'div' && id !== undefined && revealed.has(id);
  if (
    NON_RENDERED.has(node.tagName) ||
    (attribute(node, 'hidden') !== undefined && !streamedSegment) ||
    attribute(node, 'inert') !== undefined ||
    attribute(node, 'aria-hidden')?.toLowerCase() === 'true'
  )
    return true;

  const style = (attribute(node, 'style') ?? '').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  return style.split(';').some((declaration) => {
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .replace(/!\s*important\s*$/i, '')
      .trim()
      .toLowerCase();
    return (
      (property === 'display' && value === 'none') ||
      (property === 'visibility' && ['hidden', 'collapse'].includes(value)) ||
      (property === 'opacity' &&
        value !== '' &&
        Number(value.replace(/%$/, '')) === 0)
    );
  });
}

function hasContent(node: Node, revealed: ReadonlySet<string>): boolean {
  if (node.nodeName === '#text')
    return /\S/.test((node as DefaultTreeAdapterTypes.TextNode).value);
  if ('tagName' in node) {
    if (hidden(node, revealed)) return false;
    if (node.tagName === 'img') return Boolean(attribute(node, 'alt')?.trim());
    if (node.tagName === 'svg' && attribute(node, 'aria-label')?.trim())
      return true;
  }
  return (
    'childNodes' in node &&
    node.childNodes.some((child) => hasContent(child, revealed))
  );
}

/**
 * Inspect actual HTML elements, not marker strings or serialized scripts.
 * Reject explicit hiding on the link or its ancestors, except a React streamed
 * segment that an inline reveal script puts on the page. This static
 * diagnostic does not evaluate external stylesheets or other client changes.
 */
export function hasCrawlableCavunoBacklink(html: string): boolean {
  const root = parse(html);
  const revealed = revealedSegmentIds(root);
  function visit(node: Node): boolean {
    if ('tagName' in node) {
      if (hidden(node, revealed)) return false;
      if (node.tagName === 'a') {
        const href = attribute(node, 'href');
        if (href !== undefined && hasContent(node, revealed)) {
          try {
            const url = new URL(href);
            if (
              ['http:', 'https:'].includes(url.protocol) &&
              ['cavuno.com', 'www.cavuno.com'].includes(url.hostname)
            )
              return true;
          } catch {
            // Relative and invalid URLs are not Cavuno backlinks.
          }
        }
      }
    }
    return 'childNodes' in node && node.childNodes.some(visit);
  }
  return visit(root);
}
