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
  '/api/canvas/segmentation-plan',
  '/api/canvas/analyze-layers',
  '/api/canvas/ocr',
  '/api/canvas/replace-text',
  '/api/canvas/pixel-layers',
  '/api/canvas/psd-export',
  '/api/plog-generate',
  '/api/extension/analyze',
  '/api/extension/regenerate',
];

const CANVAS_AI_ROUTES = [
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/segmentation-plan',
  '/api/canvas/analyze-layers',
  '/api/canvas/ocr',
  '/api/canvas/replace-text',
  '/api/canvas/pixel-layers',
  '/api/canvas/psd-export',
];

const SIGNED_ECOMMERCE_ASSISTANT_ROUTES = [
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  '/api/polish-ec-text',
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

function extractPostGuardMiddleware(source) {
  const marker = source.indexOf('// 所有会调用生图、识图或 LLM 上游的 POST 路由');
  assert.notEqual(marker, -1, 'POST generation guard marker must exist');
  const start = source.indexOf('(req, res, next) => {', marker);
  assert.notEqual(start, -1, 'POST generation guard middleware must exist');
  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail('POST generation guard middleware must have a balanced function body');
}

function createProductionPathNormalizer(source) {
  if (!source.includes('function normalizeGuardedPath')) return path => path;
  const declaration = extractFunctionDeclaration(source, 'normalizeGuardedPath');
  return new Function(`${declaration}; return normalizeGuardedPath;`)();
}

function createUnsignedCanvasGuardHarness(source) {
  const normalizeGuardedPath = createProductionPathNormalizer(source);
  const signedRoutes = extractSignedGenerationRoutes(source);
  const betaDeclaration = extractFunctionDeclaration(source, 'betaAccessMiddleware');
  const createBetaMiddleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'requireBetaEmail',
    'contentBillingHttpError',
    'normalizeGuardedPath',
    `${betaDeclaration}; return betaAccessMiddleware;`,
  );
  let signedAuthCalls = 0;
  let bodyAuthCalls = 0;
  const betaMiddleware = createBetaMiddleware(
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
    normalizeGuardedPath,
  );
  const guardSource = extractPostGuardMiddleware(source);
  const createGuard = new Function(
    'BETA_GUARDED_POST_ROUTES',
    'RATE_LIMITED_POST_ROUTES',
    'rateLimiter',
    'betaAccessMiddleware',
    'normalizeGuardedPath',
    `return ${guardSource};`,
  );
  let rateLimitCalls = 0;
  const guard = createGuard(
    BETA_GUARDED_POST_ROUTES,
    RATE_LIMITED_POST_ROUTES,
    (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
    betaMiddleware,
    normalizeGuardedPath,
  );

  return {
    guard,
    normalizeGuardedPath,
    counts() {
      return { signedAuthCalls, bodyAuthCalls, rateLimitCalls };
    },
  };
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

test('every ecommerce AI assistant route requires a signed owner session', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const signedRoutes = extractSignedGenerationRoutes(source);

  for (const route of SIGNED_ECOMMERCE_ASSISTANT_ROUTES) {
    assert.equal(signedRoutes.has(route), true, `${route} must require a signed owner`);
  }
});

test('unsigned Canvas AI requests cannot use body or query email to reach rate limiting or handlers', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const normalizeGuardedPath = createProductionPathNormalizer(source);
  const signedRoutes = extractSignedGenerationRoutes(source);
  const declaration = extractFunctionDeclaration(source, 'betaAccessMiddleware');
  const createMiddleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'requireBetaEmail',
    'contentBillingHttpError',
    'normalizeGuardedPath',
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
    normalizeGuardedPath,
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

test('unsigned Canvas trailing-slash variants cannot bypass signed auth or reach rate limiting and handlers', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const normalizeGuardedPath = createProductionPathNormalizer(source);
  const signedRoutes = extractSignedGenerationRoutes(source);
  const betaDeclaration = extractFunctionDeclaration(source, 'betaAccessMiddleware');
  const createBetaMiddleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'requireBetaEmail',
    'contentBillingHttpError',
    'normalizeGuardedPath',
    `${betaDeclaration}; return betaAccessMiddleware;`,
  );
  let signedAuthCalls = 0;
  let bodyAuthCalls = 0;
  const betaMiddleware = createBetaMiddleware(
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
    normalizeGuardedPath,
  );
  const guardSource = extractPostGuardMiddleware(source);
  const createGuard = new Function(
    'BETA_GUARDED_POST_ROUTES',
    'RATE_LIMITED_POST_ROUTES',
    'rateLimiter',
    'betaAccessMiddleware',
    'normalizeGuardedPath',
    `return ${guardSource};`,
  );
  let rateLimitCalls = 0;
  const guard = createGuard(
    BETA_GUARDED_POST_ROUTES,
    RATE_LIMITED_POST_ROUTES,
    (_req, _res, next) => {
      rateLimitCalls += 1;
      next();
    },
    betaMiddleware,
    normalizeGuardedPath,
  );

  const variants = CANVAS_AI_ROUTES.flatMap(route => [`${route}/`, `${route}///`]);
  for (const path of variants) {
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

    guard({
      method: 'POST',
      path,
      body: { email: 'body-owner@example.com' },
      query: { email: 'query-owner@example.com' },
      headers: {},
    }, response, () => {
      downstreamCalls += 1;
    });

    assert.equal(response.statusCode, 401, path);
    assert.equal(response.body.code, 'AUTH_SESSION_REQUIRED', path);
    assert.equal(downstreamCalls, 0, `${path} must not reach route handlers`);
  }

  assert.equal(signedAuthCalls, variants.length);
  assert.equal(bodyAuthCalls, 0);
  assert.equal(rateLimitCalls, 0);
});

test('unsigned mixed-case Canvas routes cannot bypass signed auth or reach rate limiting and handlers', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const harness = createUnsignedCanvasGuardHarness(source);
  const variants = [
    '/API/CANVAS/TRANSFORM',
    '/api/canvas/Analyze-Layers',
    '/api/canvas/Pixel-Layers',
    '/api/canvas/PSD-Export',
    '/Api/Canvas/Regenerate///',
  ];

  for (const path of variants) {
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

    harness.guard({
      method: 'POST',
      path,
      body: { email: 'body-owner@example.com' },
      query: { email: 'query-owner@example.com' },
      headers: {},
    }, response, () => {
      downstreamCalls += 1;
    });

    assert.equal(response.statusCode, 401, path);
    assert.equal(response.body.code, 'AUTH_SESSION_REQUIRED', path);
    assert.equal(downstreamCalls, 0, `${path} must not reach route handlers`);
  }

  assert.deepEqual(harness.counts(), {
    signedAuthCalls: variants.length,
    bodyAuthCalls: 0,
    rateLimitCalls: 0,
  });
  assert.equal(
    harness.normalizeGuardedPath('/API//Canvas/TRANSFORM///'),
    '/api//canvas/transform',
  );
});

test('content preview trailing slashes use the normalized path for preview and rate-limit membership', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const normalizeGuardedPath = createProductionPathNormalizer(source);
  const signedRoutes = extractSignedGenerationRoutes(source);
  const betaDeclaration = extractFunctionDeclaration(source, 'betaAccessMiddleware');
  const createBetaMiddleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'requireBetaEmail',
    'contentBillingHttpError',
    'normalizeGuardedPath',
    `${betaDeclaration}; return betaAccessMiddleware;`,
  );
  let signedAuthCalls = 0;
  const betaMiddleware = createBetaMiddleware(
    new Set(['/api/generate', '/api/plog-generate']),
    signedRoutes,
    () => {
      signedAuthCalls += 1;
      throw new Error('preview request must not require signed auth');
    },
    {},
    () => {
      throw new Error('preview request must not use body email auth');
    },
    error => ({ status: 401, body: { error: error.message } }),
    normalizeGuardedPath,
  );
  const guardSource = extractPostGuardMiddleware(source);
  const createGuard = new Function(
    'BETA_GUARDED_POST_ROUTES',
    'RATE_LIMITED_POST_ROUTES',
    'rateLimiter',
    'betaAccessMiddleware',
    'normalizeGuardedPath',
    `return ${guardSource};`,
  );
  let rateLimitCalls = 0;
  let downstreamCalls = 0;
  const guard = createGuard(
    BETA_GUARDED_POST_ROUTES,
    RATE_LIMITED_POST_ROUTES,
    (req, _res, next) => {
      rateLimitCalls += 1;
      assert.equal(req._contentPreview, true);
      next();
    },
    betaMiddleware,
    normalizeGuardedPath,
  );
  const request = {
    method: 'POST',
    path: '/api/generate///',
    body: { preview: true },
    headers: {},
  };

  guard(request, {}, () => {
    downstreamCalls += 1;
  });

  assert.equal(request._contentPreview, true);
  assert.equal(signedAuthCalls, 0);
  assert.equal(rateLimitCalls, 1);
  assert.equal(downstreamCalls, 1);
});

test('guarded path normalization preserves root and internal path bytes', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const normalizeGuardedPath = createProductionPathNormalizer(source);

  assert.equal(normalizeGuardedPath('/'), '/');
  assert.equal(normalizeGuardedPath('///'), '/');
  assert.equal(normalizeGuardedPath('/api/canvas/transform///'), '/api/canvas/transform');
  assert.equal(normalizeGuardedPath('/api//canvas/transform///'), '/api//canvas/transform');
  assert.equal(normalizeGuardedPath('/api/canvas/%74ransform/'), '/api/canvas/%74ransform');
});

test('owner beta account has a testing-friendly rate limit without disabling abuse protection', () => {
  assert.deepEqual(getGenerationRateLimit('867550189@qq.com'), { max: 60, windowMs: 60_000 });
  assert.deepEqual(getGenerationRateLimit('someone@example.com'), { max: 10, windowMs: 60_000 });
});
