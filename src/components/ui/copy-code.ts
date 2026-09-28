/**
 * Copy-to-clipboard behaviour for code blocks, shared by `Prose.astro` (which adds a button
 * to every code block rendered from Markdown) and `CodeBlock.astro` (which renders its own).
 * Browser only; imported from processed `<script>` tags, so it is covered by the CSP hashes.
 */

const RESET_MS = 1500;

/** Copies the block's text and reports the result in the button's own label. */
export function bindCopyButton(button: HTMLButtonElement, source: HTMLElement): void {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source.innerText);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = label), RESET_MS);
  });
}

/** Wraps a Markdown code block and adds a copy button that appears on hover or focus. */
export function enhanceCodeBlocks(root: ParentNode): void {
  for (const pre of root.querySelectorAll<HTMLPreElement>(
    'pre.astro-code:not([data-copy-ready])',
  )) {
    pre.dataset.copyReady = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper group relative';
    pre.replaceWith(wrapper);
    wrapper.append(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-live', 'polite');
    button.className =
      'absolute top-2 right-2 rounded-md border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground';
    button.textContent = 'Copy';
    bindCopyButton(button, pre);
    wrapper.append(button);
  }
}
