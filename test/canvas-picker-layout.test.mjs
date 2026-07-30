import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const legacyCss = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/workflowNodes.css', import.meta.url), 'utf8');
const modularCss = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNodes.module.css', import.meta.url), 'utf8');
const modularPicker = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/CanvasNodeActionPicker.jsx', import.meta.url), 'utf8');

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || '';
}

test('small viewport pickers use a flex column whose action list owns the available scroll height', () => {
  const legacyParent = rule(legacyCss, '.workflow-action-picker');
  const legacyList = rule(legacyCss, '.workflow-picker-list');
  const modularParent = rule(modularCss, '.actionPicker');
  const modularList = rule(modularCss, '.pickerList');

  for (const parent of [legacyParent, modularParent]) {
    assert.match(parent, /display:\s*flex/);
    assert.match(parent, /flex-direction:\s*column/);
    assert.match(parent, /min-height:\s*0/);
    assert.match(parent, /overflow:\s*hidden/);
  }
  for (const list of [legacyList, modularList]) {
    assert.match(list, /flex:\s*1/);
    assert.match(list, /min-height:\s*0/);
    assert.match(list, /overflow-y:\s*auto/);
  }
  assert.match(legacyCss, /@media \(max-width: 700px\)[\s\S]*?\.workflow-action-picker\s*\{[^}]*max-height:\s*calc\(100vh - 20px\)/);
  assert.match(modularPicker, /width:\s*position\.width/);
  assert.match(modularPicker, /maxHeight:\s*position\.maxHeight/);
});
