export function highlightCode(code: string, lang: 'bash' | 'tsx'): string {
  if (lang === 'bash') {
    return code
      .replace(/(npm install)/g, '<span class="hl-keyword">$1</span>')
      .replace(/(border-beam)/g, '<span class="hl-string">$1</span>');
  }

  // Escape HTML first
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const masks: string[] = [];

  // Mask Comments: // ... or {/* ... */}
  html = html.replace(/(\/\/.*)/g, (match) => {
    masks.push(`<span class="hl-comment">${match}</span>`);
    return `__MASK_${masks.length - 1}__`;
  });
  html = html.replace(/(\{\/\*[\s\S]*?\*\/\})/g, (match) => {
    masks.push(`<span class="hl-comment">${match}</span>`);
    return `__MASK_${masks.length - 1}__`;
  });

  // Mask Double-quoted strings
  html = html.replace(/(&quot;[^\n&]*?&quot;)/g, (match) => {
    masks.push(`<span class="hl-string">${match}</span>`);
    return `__MASK_${masks.length - 1}__`;
  });

  // Mask Single-quoted strings
  html = html.replace(/(&#x27;[^\n&]*?&#x27;|&#39;[^\n&]*?&#39;|'[^\n&]*?')/g, (match) => {
    masks.push(`<span class="hl-string">${match}</span>`);
    return `__MASK_${masks.length - 1}__`;
  });

  // Highlight JSX Component tags: <BorderBeam, </BorderBeam, <Card, etc.
  html = html.replace(/(&lt;\/?)([A-Z][a-zA-Z0-9_]*)/g, '$1<span class="hl-component">$2</span>');

  // Highlight JSX standard HTML elements: <button, </button, etc.
  html = html.replace(/(&lt;\/?)([a-z][a-zA-Z0-9_]*)/g, '$1<span class="hl-tag">$2</span>');

  // Highlight Attributes: matching identifier followed by = (e.g. size=, colorVariant=)
  html = html.replace(/\b([a-zA-Z0-9_-]+)(=)/g, '<span class="hl-attr">$1</span>$2');

  // Highlight JS/TS keywords
  html = html.replace(/\b(import|from|const|return|export|default|function|let|type|interface|class|as)\b/g, '<span class="hl-keyword">$1</span>');

  // Highlight Numbers and Booleans
  html = html.replace(/\b(true|false|null|undefined|\d+(\.\d+)?)\b/g, (match) => {
    return `<span class="hl-number">${match}</span>`;
  });

  // Highlight Brackets/Braces/JSX punctuation: { } [ ] ( )
  html = html.replace(/([{}()\[\]])/g, '<span class="hl-punctuation">$1</span>');

  // Restore masks in reverse order to support nested lookups if any
  for (let i = masks.length - 1; i >= 0; i--) {
    html = html.replace(new RegExp(`__MASK_${i}__`, 'g'), masks[i]);
  }

  return html;
}
