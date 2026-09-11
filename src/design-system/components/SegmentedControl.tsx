import Tabs, { type TabItem, type TabsProps } from './Tabs';

export type SegmentedControlProps<T extends string> = Omit<TabsProps<T>, 'variant'>;

/**
 * Canonical view/filter switcher. It shares the Tabs keyboard and geometry
 * foundation while keeping navigation tabs semantically distinct at call sites.
 */
export default function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return <Tabs {...props} variant="pill" />;
}

export type { TabItem as SegmentedControlItem };
