#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const targetFiles = [
  path.join(projectRoot, 'node_modules', 'react-side-effect', 'lib', 'index.js'),
  path.join(projectRoot, 'node_modules', 'react-side-effect', 'lib', 'index.es.js'),
];

const replacement = `_proto.componentDidMount = function componentDidMount() {
        mountedInstances.push(this);
        emitChange();
      };`;
const original = `_proto.UNSAFE_componentWillMount = function UNSAFE_componentWillMount() {
        mountedInstances.push(this);
        emitChange();
      };`;

function patchFile(filePath) {
  let fileContent;
  try {
    fileContent = readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`patch-react-side-effect: unable to read ${filePath}`);
    throw error;
  }

  if (!fileContent.includes('react-side-effect')) {
    console.warn('patch-react-side-effect: unexpected file content.');
  }

  if (fileContent.includes(replacement)) {
    console.log('patch-react-side-effect: patch already applied.');
    return;
  }

  if (!fileContent.includes(original)) {
    throw new Error('patch-react-side-effect: original snippet not found, aborting.');
  }

  const updatedContent = fileContent.replace(original, replacement);
  writeFileSync(filePath, updatedContent, 'utf8');
  console.log('patch-react-side-effect: patched successfully.');
}

targetFiles.forEach((filePath) => patchFile(filePath));
