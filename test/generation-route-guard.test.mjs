import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BETA_GUARDED_POST_ROUTES,
  RATE_LIMITED_POST_ROUTES,
  getGenerationRateLimit,
} from '../server/generationRouteGuard.mjs';

const EXPENSIVE_POST_ROUTES = [
  '/api/generate',
  '/api/regenerate-image',
  '/api/regenerate-text',
  '/api/analyze',
  '/api/extract-product-link',
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  '/api/polish-ec-text',
  '/api/reverse-prompt',
  '/api/remove-bg',
  '/api/generate-ecommerce',
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/analyze-layers',
  '/api/plog-generate',
  '/api/extension/analyze',
  '/api/extension/regenerate',
];

const CANVAS_AI_ROUTES = [
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/analyze-layers',
];

function extractSignedGenerationRoutes(source) {
  const start = source.indexOf('const SIGNED_GENERATION_ROUTES');
  assert.notEqual(start, -1, 'SIGNED_GENERATION_ROUTES must exist');
  const end = source.indexOf(']);', start);
  assert.notEqual(end, -1, 'SIGNED_GENERATION_ROUTES must have a stable closing marker');
  const declaration = source.slice(start, end + 3);
  return new Set(
    [...declaration.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]),
  );
}

function extractFunctionDeclaration(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a balanced function body`);
}

test('every expensive generation route requires beta access and rate limiting', () => {
  for (const route of EXPENSIVE_POST_ROUTES) {
    assert.equal(BETA_GUARDED_POST_ROUTES.has(route), true, `${route} must require beta access`);
    assert.equal(RATE_LIMITED_POST_ROUTES.has(route), true, `${route} must be rate limited`);
  }
});

test('every Canvas AI route belongs to the signed generation route set', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const signedRoutes = extractSignedGenerationRoutes(source);

  for (const route of CANVAS_AI_ROUTES) {
    assert.equal(signedRoutes.has(route), true, `${route} must require a signed owner`);
  }
});

test('unsigned Canvas AI requests cannot use body or query email to reach rate limiting or handlers', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const signedRoutes = extractSignedGenerationRoutes(source);
  const declaration = extractFunctionDeclaration(source, 'betaAccessMiddleware');
  const createMiddleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'requireBetaEmail',
    'contentBillingHttpError',
    `${declaration}; return betaAccessMiddleware;`,
  );
  let signedAuthCalls = 0;
  let bodyAuthCalls = 0;
  const middleware = createMiddleware(
    new Set(),
    signedRoutes,
    () => {
      signedAuthCalls += 1;
      throw Object.assign(new Error('signed session required'), {
        code: 'AUTH_SESSION_REQUIRED',
      });
    },
    {},
    email => {
      bodyAuthCalls += 1;
      return { ok: true, email };
    },
    error => ({
      status: 401,
      body: { error: error.message, code: error.code },
    }),
  );

  for (const route of CANVAS_AI_ROUTES) {
    let downstreamCalls = 0;
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    middleware({
      path: route,
      body: { email: 'body-owner@example.com' },
      query: { email: 'query-owner@example.com' },
      headers: {},
    }, response, () => {
      downstreamCalls += 1;
    });

    assert.equal(response.statusCode, 401, route);
    assert.equal(response.body.code, 'AUTH_SESSION_REQUIRED', route);
    assert.equal(downstreamCalls, 0, `${route} must stop before rate limiting and handlers`);
  }

  assert.equal(signedAuthCalls, CANVAS_AI_ROUTES.length);
  assert.equal(bodyAuthCalls, 0);
});

test('owner beta account has a testing-friendly rate limit without disabling abuse protection', () => {
  assert.deepEqual(getGenerationRateLimit('867550189@qq.com'), { max: 60, windowMs: 60_000 });
  assert.deepEqual(getGenerationRateLimit('someone@example.com'), { max: 10, windowMs: 60_000 });
});
