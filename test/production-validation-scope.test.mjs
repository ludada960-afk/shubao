import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProductionValidation } from '../scripts/production-validation-scope.mjs';

test('front-end navigation changes use non-billable production validation', () => {
  assert.equal(classifyProductionValidation([
    'src/App.jsx',
    'src/components/layout/CreativeDomainNav.jsx',
    'src/components/layout/creativeDomainNavigation.js',
    'src/styles/app-shell.css',
    'test/app-shell-contract.test.mjs',
  ]), 'frontend');
});

test('ecommerce and server changes require the real ecommerce gate', () => {
  assert.equal(classifyProductionValidation([
    'src/pages/Home/EcMode.jsx',
    'src/pages/Home/ec/ecommerceTaskProgressModel.js',
  ]), 'full');
  assert.equal(classifyProductionValidation(['server/index.mjs']), 'full');
  assert.equal(classifyProductionValidation(['server/billing/walletService.mjs']), 'full');
});

test('unknown production-impacting files fail closed to the full gate', () => {
  assert.equal(classifyProductionValidation(['src/services/api.js']), 'full');
  assert.equal(classifyProductionValidation(['package-lock.json']), 'full');
  assert.equal(classifyProductionValidation([]), 'full');
});
