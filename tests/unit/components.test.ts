import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';

import Badge from '@/components/ui/Badge.astro';
import Button from '@/components/ui/Button.astro';
import Callout from '@/components/ui/Callout.astro';
import Prose from '@/components/ui/Prose.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('<Button>', () => {
  it('renders an anchor when href is provided', async () => {
    const html = await container.renderToString(Button, {
      props: { href: '/docs', variant: 'outline' },
      slots: { default: 'Read the docs' },
    });
    expect(html).toContain('<a');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('Read the docs');
    expect(html).toContain('border');
  });

  it('renders a button element otherwise and adds safe rel for external links', async () => {
    const button = await container.renderToString(Button, {
      props: { type: 'submit' },
      slots: { default: 'Go' },
    });
    expect(button).toContain('<button');
    expect(button).toContain('type="submit"');

    const external = await container.renderToString(Button, {
      props: { href: 'https://example.com', external: true },
      slots: { default: 'Out' },
    });
    expect(external).toContain('rel="noopener noreferrer"');
    expect(external).toContain('target="_blank"');
  });
});

describe('<Badge>', () => {
  it('supports variants and links', async () => {
    const html = await container.renderToString(Badge, {
      props: { variant: 'success', href: '/blog/tags/astro' },
      slots: { default: 'astro' },
    });
    expect(html).toContain('href="/blog/tags/astro"');
    expect(html).toContain('bg-success');
  });
});

describe('<Callout>', () => {
  it('renders the title, icon and content', async () => {
    const html = await container.renderToString(Callout, {
      props: { type: 'warning', title: 'Careful' },
      slots: { default: '<p>Mind the gap.</p>' },
    });
    expect(html).toContain('aria-label="Careful"');
    expect(html).toContain('Mind the gap.');
    expect(html).toContain('<svg');
  });
});

describe('<Prose>', () => {
  it('injects heading anchors', async () => {
    const html = await container.renderToString(Prose, {
      slots: { default: '<h2 id="intro">Intro</h2><p>Text</p>' },
    });
    expect(html).toContain('<a class="heading-anchor" href="#intro"');
    expect(html).toContain('class="prose"');
  });
});
