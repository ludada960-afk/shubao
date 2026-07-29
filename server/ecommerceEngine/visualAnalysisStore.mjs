function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseResult(row) {
  if (!row) return null;
  try {
    const result = JSON.parse(row.result_json);
    return isRecord(result) ? result : null;
  } catch {
    return null;
  }
}

export function createVisualAnalysisStore(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_visual_analysis_cache (
      cache_key TEXT PRIMARY KEY,
      analysis_type TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_visual_analysis_lookup
      ON ecommerce_visual_analysis_cache(analysis_type, model, prompt_version);
  `);

  const select = db.prepare(`
    SELECT result_json FROM ecommerce_visual_analysis_cache WHERE cache_key = ?
  `);
  const upsert = db.prepare(`
    INSERT INTO ecommerce_visual_analysis_cache (
      cache_key, analysis_type, model, prompt_version, result_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      analysis_type = excluded.analysis_type,
      model = excluded.model,
      prompt_version = excluded.prompt_version,
      result_json = excluded.result_json,
      updated_at = excluded.updated_at
  `);

  return {
    get(key) {
      const cacheKey = cleanString(key);
      if (!cacheKey) throw new TypeError('visual analysis cache key is required');
      return parseResult(select.get(cacheKey));
    },
    put({ key, type, model, promptVersion, result } = {}) {
      const cacheKey = cleanString(key);
      const analysisType = cleanString(type);
      const modelName = cleanString(model);
      const version = cleanString(promptVersion);
      if (!cacheKey || !analysisType || !modelName || !version || !isRecord(result)) {
        throw new TypeError('complete visual analysis cache metadata and result are required');
      }
      const now = new Date().toISOString();
      upsert.run(cacheKey, analysisType, modelName, version, JSON.stringify(result), now, now);
      return parseResult(select.get(cacheKey));
    },
  };
}
