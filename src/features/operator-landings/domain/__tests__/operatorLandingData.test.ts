import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  OPERATOR_LANDING_SLUGS,
  getOperatorLandingByPath,
  getOperatorLandingBySlug,
  getOperatorLandingPath,
  getOperatorQuotePath,
  listOperatorLandingPages,
} from '../../index';

test('all initial operator pages have unique, routable slugs and conversion content', () => {
  const pages = listOperatorLandingPages();
  const slugs = pages.map((page) => page.slug);

  assert.equal(pages.length, 10);
  assert.deepEqual(slugs, OPERATOR_LANDING_SLUGS);
  assert.equal(new Set(slugs).size, slugs.length);

  for (const page of pages) {
    assert.ok(page.name);
    assert.ok(page.heroHeadline);
    assert.ok(page.heroDescription);
    assert.ok(page.seo.title);
    assert.ok(page.seo.description);
    assert.ok(page.faqs.length >= 3);
    assert.equal(getOperatorLandingPath(page.slug), `/planos/${page.slug}`);
  }
});

test('operator repository resolves only known slugs and preserves quote attribution', () => {
  const page = getOperatorLandingBySlug('porto-saude');

  assert.equal(page?.name, 'Porto Saúde');
  assert.equal(getOperatorLandingBySlug('nao-existe'), null);
  assert.equal(getOperatorLandingByPath('amil', 'pme'), null);
  assert.equal(getOperatorLandingByPath('amil')?.path, '/planos/amil');
  assert.equal(getOperatorQuotePath('porto-saude'), '/?operadora=porto-saude#cotacao');
});
