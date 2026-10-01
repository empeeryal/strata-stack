import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';

import BackToTop from '@/components/ui/BackToTop.astro';
import Badge from '@/components/ui/Badge.astro';
import BarChart from '@/components/ui/BarChart.astro';
import Button from '@/components/ui/Button.astro';
import Callout from '@/components/ui/Callout.astro';
import PricingTable from '@/components/ui/PricingTable.astro';
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
    expect(html).toContain('border-input');
  });

  it('renders a button element otherwise', async () => {
    const html = await container.renderToString(Button, {
      props: { type: 'submit' },
      slots: { default: 'Go' },
    });
    expect(html).toContain('<button');
    expect(html).toContain('type="submit"');
  });

  it('adds a safe rel and target for external links', async () => {
    const html = await container.renderToString(Button, {
      props: { href: 'https://example.com', external: true },
      slots: { default: 'Out' },
    });
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});

describe('<BackToTop>', () => {
  it('renders a hidden, labelled button inside its custom element', async () => {
    const html = await container.renderToString(BackToTop);
    expect(html).toContain('<back-to-top');
    expect(html).toMatch(/<button[^>]*\shidden/);
    expect(html).toContain('aria-label="Back to top"');
    expect(html).toContain('fixed');
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
  it('renders the title, icon and content as a note', async () => {
    const html = await container.renderToString(Callout, {
      props: { type: 'warning', title: 'Careful' },
      slots: { default: '<p>Mind the gap.</p>' },
    });
    expect(html).toContain('role="note"');
    expect(html).toContain('Careful');
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

describe('<BarChart>', () => {
  const data = [
    { label: 'Mon', detail: 'Monday', value: 2 },
    { label: 'Tue', detail: 'Tuesday', value: 0 },
    { label: 'Wed', detail: 'Wednesday', value: 5 },
  ];

  it('renders an accessible SVG with one column per non-zero value', async () => {
    const html = await container.renderToString(BarChart, {
      props: { data, title: 'Sign-ups per day', unit: 'sign-ups' },
    });
    expect(html).toContain('role="img"');
    expect(html).toContain('Sign-ups per day');
    expect(html).toContain('7 sign-ups in total; the peak is 5 on Wednesday.');
    expect(html.match(/class="fill-chart-1/g)).toHaveLength(2);
    expect(html).toContain('<title>Tuesday: 0 sign-ups</title>');
  });

  it('labels only the peak and lists every day in the table', async () => {
    const html = await container.renderToString(BarChart, {
      props: { data, title: 'Sign-ups per day', unit: 'sign-ups' },
    });
    expect(html.match(/fill-foreground/g)).toHaveLength(1);
    expect(html.match(/<tr class="border-t">/g)).toHaveLength(3);
    expect(html).toContain('Table view');
  });

  it('says so when there is nothing to show', async () => {
    const html = await container.renderToString(BarChart, {
      props: { data: data.map((point) => ({ ...point, value: 0 })), title: 'Quiet week' },
    });
    expect(html).toContain('No items in this period.');
    expect(html).not.toContain('fill-chart-1');
  });
});

describe('<PricingTable>', () => {
  const tiers = [
    {
      name: 'Starter',
      description: 'Personal sites.',
      monthly: 0,
      features: ['One site'],
      cta: { label: 'Start', href: '/signup' },
    },
    {
      name: 'Pro',
      description: 'Business sites.',
      monthly: 19,
      annual: 15,
      features: ['Unlimited sites', 'Email support'],
      cta: { label: 'Choose Pro', href: '/contact' },
      highlighted: true,
      badge: 'Most popular',
    },
    {
      name: 'Enterprise',
      description: 'Call us.',
      monthly: null,
      features: ['Everything'],
      cta: { label: 'Talk to us', href: '/contact' },
    },
  ];

  it('renders every tier with monthly prices visible and annual ones hidden', async () => {
    const html = await container.renderToString(PricingTable, { props: { tiers } });
    expect(html).toContain('Starter');
    expect(html).toContain('$0');
    expect(html).toContain('$19');
    expect(html).toMatch(/data-price="annual"[^>]*hidden/);
    // Only tiers with two prices take part in the switch.
    expect(html.match(/data-price="monthly"/g)).toHaveLength(1);
    expect(html).toContain('$15');
    expect(html).toContain('Custom');
    expect(html).toContain('Most popular');
    expect(html).toContain('ring-primary');
    expect(html).toContain('href="/contact"');
  });

  it('includes the billing switch, hidden until the script runs, with the best saving', async () => {
    const html = await container.renderToString(PricingTable, { props: { tiers } });
    expect(html).toMatch(/data-billing-switch[^>]*hidden/);
    expect(html).toContain('Billing period');
    expect(html).toContain('save 21%');
  });

  it('omits the switch when no tier has an annual price', async () => {
    const html = await container.renderToString(PricingTable, {
      props: { tiers: [tiers[0]!, tiers[2]!] },
    });
    expect(html).not.toContain('data-billing-switch');
  });
});
