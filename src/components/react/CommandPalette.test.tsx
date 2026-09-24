// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CommandPalette, { type PaletteLink, type SearchApi } from './CommandPalette';

const links: PaletteLink[] = [
  { label: 'Docs', href: '/docs', group: 'Pages' },
  { label: 'Changelog', href: '/changelog', group: 'Pages' },
  {
    label: 'Installation',
    href: '/docs/getting-started/installation',
    group: 'Docs · Getting started',
    keywords: 'first run',
  },
];

function fakeSearch(hits: Array<{ url: string; title: string; excerpt: string }>): SearchApi {
  return {
    init: async () => {},
    debouncedSearch: async () => ({
      results: hits.map((hit) => ({
        data: async () => ({ url: hit.url, excerpt: hit.excerpt, meta: { title: hit.title } }),
      })),
    }),
  };
}

const assign = vi.fn();

function setup(props: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const trigger = document.createElement('a');
  trigger.href = '/search';
  trigger.dataset.paletteTrigger = '';
  trigger.textContent = 'Search the site';
  document.body.append(trigger);
  const view = render(
    <CommandPalette
      links={links}
      loadSearch={async () => fakeSearch([])}
      loadSession={async () => null}
      {...props}
    />,
  );
  return { trigger, ...view };
}

describe('<CommandPalette>', () => {
  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign, href: 'http://localhost/' },
    });
    document.documentElement.dataset.theme = 'light';
    localStorage.clear();
    document.querySelectorAll('[data-palette-trigger]').forEach((node) => node.remove());
  });

  it('opens from a trigger and lists pages and docs', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    expect(screen.queryByRole('combobox')).toBeNull();
    await user.click(trigger);
    expect(screen.getByRole('combobox', { name: 'Search pages, docs and actions' })).toHaveFocus();
    expect(screen.getByRole('option', { name: 'Docs' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Installation' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('opens with Ctrl+K, filters on every word and navigates with Enter', async () => {
    const user = userEvent.setup();
    setup();
    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox');
    await user.type(input, 'first run');
    expect(screen.getByRole('option', { name: 'Installation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('option', { name: 'Docs' })).toBeNull();
    await user.keyboard('{Enter}');
    expect(assign).toHaveBeenCalledWith('/docs/getting-started/installation');
  });

  it('moves the highlight with the arrow keys', async () => {
    const user = userEvent.setup();
    setup();
    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox');
    expect(screen.getByRole('option', { name: 'Docs' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Changelog' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Changelog' }).id,
    );
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Sign in' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows search results from the injected API', async () => {
    const user = userEvent.setup();
    setup({
      loadSearch: async () =>
        fakeSearch([
          { url: '/docs/deploy/vercel', title: 'Vercel', excerpt: 'Deploy to <mark>Vercel</mark>' },
        ]),
    });
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'vercel');
    const group = await screen.findByRole('group', { name: 'Search results' });
    expect(within(group).getByRole('option', { name: /Vercel/ })).toBeInTheDocument();
  });

  it('explains when the search index is missing', async () => {
    const user = userEvent.setup();
    setup({ loadSearch: async () => Promise.reject(new Error('404')) });
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'zzzz');
    await waitFor(() => expect(screen.getByText(/needs the index/)).toBeInTheDocument());
  });

  it('switches the theme and remembers the choice', async () => {
    const user = userEvent.setup();
    setup();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'theme');
    await user.keyboard('{Enter}');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('offers the dashboard and admin area to a signed-in administrator', async () => {
    const user = userEvent.setup();
    setup({ loadSession: async () => ({ name: 'Ada', admin: true }) });
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('option', { name: 'Dashboard (Ada)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Admin area' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sign in' })).toBeNull();
  });
});
