// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { enhanceCodeBlocks } from './copy-code';

/** A rendered Markdown code block inside a `data-prose` container with translated labels. */
function render(labels = true) {
  const root = document.createElement('div');
  if (labels) {
    root.dataset.copyLabel = 'Kopieren';
    root.dataset.copiedLabel = 'Kopiert';
    root.dataset.copyFailedLabel = 'Fehlgeschlagen';
  }
  root.innerHTML = '<pre class="astro-code"><code>pnpm install</code></pre>';
  document.body.append(root);
  enhanceCodeBlocks(root);
  return root.querySelector('button')!;
}

describe('enhanceCodeBlocks', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    trackEvent.mockReset();
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it("adds one button per block with the container's labels and reports a copy", async () => {
    writeText.mockResolvedValue(undefined);
    const button = render();
    expect(button.textContent).toBe('Kopieren');
    expect(button.getAttribute('aria-live')).toBe('polite');

    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Kopiert'));
    expect(writeText).toHaveBeenCalledWith('pnpm install');
    expect(trackEvent).toHaveBeenCalledWith('Code copied');

    vi.advanceTimersByTime(1500);
    expect(button.textContent).toBe('Kopieren');
    // Running it again on the same container adds nothing.
    enhanceCodeBlocks(button.parentElement!.parentElement!);
    expect(document.querySelectorAll('button')).toHaveLength(1);
  });

  it('says so when the clipboard refuses, and counts no event', async () => {
    writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const button = render(false);
    expect(button.textContent).toBe('Copy');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Copy failed'));
    expect(trackEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(button.textContent).toBe('Copy');
  });
});
