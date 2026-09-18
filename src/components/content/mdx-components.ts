import Badge from '@/components/ui/Badge.astro';
import Callout from '@/components/ui/Callout.astro';
import Card from '@/components/ui/Card.astro';
import Kbd from '@/components/ui/Kbd.astro';
import Steps from '@/components/ui/Steps.astro';
import TabItem from '@/components/ui/TabItem.astro';
import Tabs from '@/components/ui/Tabs.astro';

/**
 * Components available in every MDX file without an import statement.
 * Passed to `<Content components={mdxComponents} />` by the docs and blog layouts.
 */
export const mdxComponents = {
  Badge,
  Callout,
  Card,
  Kbd,
  Steps,
  TabItem,
  Tabs,
};
