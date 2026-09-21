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

function hidden(node: Element): boolean {
  if (
    NON_RENDERED.has(node.tagName) ||
    attribute(node, 'hidden') !== undefined ||
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

function hasContent(node: Node): boolean {
  if (node.nodeName === '#text')
    return /\S/.test((node as DefaultTreeAdapterTypes.TextNode).value);
  if ('tagName' in node) {
    if (hidden(node)) return false;
    if (node.tagName === 'img') return Boolean(attribute(node, 'alt')?.trim());
    if (node.tagName === 'svg' && attribute(node, 'aria-label')?.trim())
      return true;
  }
  return 'childNodes' in node && node.childNodes.some(hasContent);
}

/**
 * Inspect actual HTML elements, not marker strings or serialized scripts.
 * Reject explicit hiding on the link or its ancestors. This static diagnostic
 * does not evaluate external stylesheets or client-side changes.
 */
export function hasCrawlableCavunoBacklink(html: string): boolean {
  function visit(node: Node): boolean {
    if ('tagName' in node) {
      if (hidden(node)) return false;
      if (node.tagName === 'a') {
        const href = attribute(node, 'href');
        if (href !== undefined && hasContent(node)) {
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
  return visit(parse(html));
}
