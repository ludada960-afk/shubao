import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CONFIG = new URL('../ecosystem.config.cjs', import.meta.url);

test('production PM2 configuration allows one gigabyte for 2K ecommerce processing', async () => {
  const config = await readFile(CONFIG, 'utf8');

  assert.match(config, /name:\s*'shubao'/);
  assert.match(config, /max_memory_restart:\s*'1G'/);
});
