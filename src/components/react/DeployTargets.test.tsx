// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { HTMLAttributes, ReactNode } from 'react';

// Motion is presentation only here; plain elements keep the test deterministic.
vi.mock('motion/react', () => {
  const strip = ({
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layoutId: _layoutId,
    ...rest
  }: Record<string, unknown>) => rest as HTMLAttributes<HTMLElement>;
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: (props: Record<string, unknown>) => <div {...strip(props)} />,
      span: (props: Record<string, unknown>) => <span {...strip(props)} />,
    },
    useReducedMotion: () => true,
  };
});

import DeployTargets from './DeployTargets';

describe('<DeployTargets>', () => {
  it('shows Vercel first and switches the panel on click', async () => {
    const user = userEvent.setup();
    render(<DeployTargets />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Vercel', 'Cloudflare', 'Netlify', 'Node']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('DEPLOY_TARGET=vercel pnpm build');

    await user.click(screen.getByRole('tab', { name: 'Node' }));
    expect(screen.getByRole('tab', { name: 'Node' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('dist/server/entry.mjs');
    expect(screen.getByRole('link', { name: /Node deployment guide/ })).toHaveAttribute(
      'href',
      '/docs/deploy/node',
    );
  });

  it('moves between tabs with the arrow, Home and End keys and wraps around', async () => {
    const user = userEvent.setup();
    render(<DeployTargets />);
    const vercel = screen.getByRole('tab', { name: 'Vercel' });
    vercel.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Cloudflare' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Cloudflare' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Node' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Vercel' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Node' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Vercel' })).toHaveAttribute('aria-selected', 'true');
    // Only the selected tab is in the tab order.
    expect(screen.getByRole('tab', { name: 'Node' })).toHaveAttribute('tabindex', '-1');
  });
});
