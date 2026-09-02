/** Parse / rebuild :::wsite-html blocks for the admin editor. */

export type ParsedWsiteContent = {
  hasWsite: boolean;
  prefix: string;
  wsiteInner: string;
};

export function hasWsiteHtml(content: string) {
  return /:::wsite-html/.test(content);
}

/** Split markdown prefix from imported Weebly HTML block. */
export function parseWsiteContent(content: string): ParsedWsiteContent {
  const idx = content.indexOf(":::wsite-html");
  if (idx < 0) {
    return { hasWsite: false, prefix: content, wsiteInner: "" };
  }

  const prefix = content.slice(0, idx).trim();
  const rest = content.slice(idx);
  const wrapped = rest.match(/^:::wsite-html\s*\n([\s\S]*?)\n:::\s*$/);
  if (wrapped) {
    return { hasWsite: true, prefix, wsiteInner: wrapped[1] };
  }

  const partial = rest.match(/^:::wsite-html\s*\n([\s\S]*?)\n:::/);
  if (partial) {
    return { hasWsite: true, prefix, wsiteInner: partial[1] };
  }

  const inner = rest
    .replace(/^:::wsite-html\s*\n?/, "")
    .replace(/\n?:::\s*$/, "")
    .trim();
  return { hasWsite: true, prefix, wsiteInner: inner };
}

export function buildWsiteContent(prefix: string, wsiteInner: string) {
  const head = prefix.trim();
  const inner = wsiteInner.trim();
  if (!inner) return head;
  const block = `:::wsite-html\n${inner}\n:::`;
  return head ? `${head}\n\n${block}` : block;
}
