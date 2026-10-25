import assert from 'node:assert/strict';
import ReactDOM from 'react-dom';
import React from 'react';
import { test } from 'vitest';

import ReactDomShim from '../../../../design-system/components/reactQuillReactDomShim';
import * as ReactDomShimModule from '../../../../design-system/components/reactQuillReactDomShim';
import ReactShim from '../../../../design-system/components/reactQuillReactShim';
import * as ReactShimModule from '../../../../design-system/components/reactQuillReactShim';

test('mantém o contrato de default esperado pelo ReactQuill', () => {
  assert.equal(ReactShimModule.__esModule, true);
  assert.equal(ReactDomShimModule.__esModule, true);
  assert.equal(ReactShim.Component, React.Component);
  assert.equal(typeof ReactShim.createElement, 'function');
  assert.equal(typeof ReactDomShim.findDOMNode, 'function');
  assert.equal(ReactDomShim.findDOMNode, ReactDOM.findDOMNode);
});
