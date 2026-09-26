import assert from 'node:assert/strict';
import ReactDOM from 'react-dom';
import React from 'react';
import { test } from 'vitest';

import ReactDomShim from '../reactQuillReactDomShim';
import ReactShim from '../reactQuillReactShim';

test('mantém o contrato de default esperado pelo ReactQuill', () => {
  assert.equal(ReactShim.Component, React.Component);
  assert.equal(typeof ReactShim.createElement, 'function');
  assert.equal(typeof ReactDomShim.findDOMNode, 'function');
  assert.equal(ReactDomShim.findDOMNode, ReactDOM.findDOMNode);
});
