import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import MonthlyTrendChart from '../MonthlyTrendChart';

test('fits the plot to its container without shrinking labels or dropping data points on resize', () => {
  const original = globalThis.ResizeObserver;
  let notify: (() => void) | undefined;
  let disconnected = false;
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) { notify = () => callback([], this); }
    observe() {}
    unobserve() {}
    disconnect() { disconnected = true; }
  };
  const data = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'].map((label, index) => ({ label, value: 250 - index * 30 }));
  const view = render(<MonthlyTrendChart className="dashboard-chart" data={data} height={250} />);
  try {
    const chart = view.container.querySelector('.kds-monthly-trend-chart');
    assert.ok(chart?.classList.contains('dashboard-chart'));
    assert.equal((chart as HTMLElement | null)?.style.getPropertyValue('--kds-monthly-trend-min-height'), '250px');
    const plot = view.container.querySelector('.kds-monthly-trend-plot');
    assert.ok(plot);
    let width = 1200;
    let height = 520;
    Object.defineProperties(plot, { clientWidth: { get: () => width }, clientHeight: { get: () => height } });
    assert.ok(notify);
    act(() => notify?.());
    const svg = view.container.querySelector('svg');
    assert.equal(svg?.getAttribute('viewBox'), '0 0 1200 520');
    assert.equal(view.container.querySelector('svg text')?.getAttribute('font-size'), '12');
    assert.ok(Number(svg?.querySelectorAll('circle')[5].getAttribute('cx')) > width * 0.9);
    width = 280;
    height = 250;
    act(() => notify?.());
    assert.equal(svg?.getAttribute('viewBox'), '0 0 280 250');
    assert.equal(svg?.querySelectorAll('title').length, 6);
    const labels = Array.from(svg?.querySelectorAll('text') ?? []).map(el => el.textContent).filter(text => data.some(point => point.label === text));
    assert.deepEqual(labels, ['Mai', 'Out']);
  } finally { view.unmount(); globalThis.ResizeObserver = original; }
  assert.equal(disconnected, true);
});

