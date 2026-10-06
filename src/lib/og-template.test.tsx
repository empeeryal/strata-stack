import type { JSX, ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { OgTemplate } from './og-template';

type Styled = ReactElement<{ style?: Record<string, string | number>; children?: ReactNode }>;

/** Every element of the tree, depth first. */
function elements(node: ReactNode): Styled[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  const element = node as Styled;
  return [element, ...elements(element.props.children)];
}

/** The element whose only child is the given text. */
function textNode(tree: JSX.Element, text: string): Styled | undefined {
  return elements(tree).find((element) => element.props.children === text);
}

const base = { kind: 'Docs', siteName: 'Strata', host: 'stratastack.dev' };

describe('OgTemplate', () => {
  it('shrinks the title as it gets longer', () => {
    const sizes = ['Short', 'A title of thirty-seven characters!!!', 'x'.repeat(61)].map(
      (title) => textNode(OgTemplate({ ...base, title }), title)?.props.style?.fontSize,
    );
    expect(sizes).toEqual(['72px', '60px', '52px']);
  });

  it('truncates a long description and leaves it out when there is none', () => {
    const long = 'd'.repeat(200);
    const tree = OgTemplate({ ...base, title: 'T', description: long });
    const shown = elements(tree)
      .map((element) => element.props.children)
      .find(
        (children): children is string =>
          typeof children === 'string' && children.startsWith('ddd'),
      );
    expect(shown).toHaveLength(150);
    expect(shown?.endsWith('…')).toBe(true);

    const without = OgTemplate({ ...base, title: 'T' });
    expect(elements(without).some((element) => element.props.children === long)).toBe(false);
  });

  it('shows the kind, the site name, the host and the meta line', () => {
    const tree = OgTemplate({ ...base, title: 'T', meta: 'Guides' });
    for (const text of ['Docs', 'Strata', 'stratastack.dev', 'Guides']) {
      expect(textNode(tree, text), text).toBeDefined();
    }
  });
});
