// src/i18n/locales.js
// 薯包 P-H 国际化基础 (4c183cd4 续命): 5 语 / 60 关键文案
// 默认 zh-CN, fallback 同上, missing key 走 console.warn (dev 模式)
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES'];

export const DEFAULT_LOCALE = 'zh-CN';

// locale 元数据: 给 <select> 切换器用
export const LOCALE_META = {
  'zh-CN': { code: 'zh-CN', label: '简体中文', flag: '🇨🇳', dir: 'ltr' },
  'en-US': { code: 'en-US', label: 'English', flag: '🇺🇸', dir: 'ltr' },
  'ja-JP': { code: 'ja-JP', label: '日本語', flag: '🇯🇵', dir: 'ltr' },
  'ko-KR': { code: 'ko-KR', label: '한국어', flag: '🇰🇷', dir: 'ltr' },
  'es-ES': { code: 'es-ES', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
};

// 60 关键文案: 6 大类 × 10 key
export const STRINGS = {
  nav: {
    home:        { 'zh-CN': '首页',       'en-US': 'Home',         'ja-JP': 'ホーム',         'ko-KR': '홈',          'es-ES': 'Inicio' },
    pricing:     { 'zh-CN': '套餐',       'en-US': 'Pricing',      'ja-JP': '料金',           'ko-KR': '요금제',       'es-ES': 'Precios' },
    works:       { 'zh-CN': '作品',       'en-US': 'Works',        'ja-JP': '作品',           'ko-KR': '작품',         'es-ES': 'Trabajos' },
    gallery:     { 'zh-CN': '画廊',       'en-US': 'Gallery',      'ja-JP': 'ギャラリー',     'ko-KR': '갤러리',       'es-ES': 'Galería' },
    ecommerce:   { 'zh-CN': '电商',       'en-US': 'E-commerce',   'ja-JP': 'EC',             'ko-KR': '이커머스',     'es-ES': 'Comercio' },
    video:       { 'zh-CN': '视频',       'en-US': 'Video',        'ja-JP': '動画',           'ko-KR': '비디오',       'es-ES': 'Vídeo' },
    login:       { 'zh-CN': '登录',       'en-US': 'Sign in',      'ja-JP': 'ログイン',       'ko-KR': '로그인',       'es-ES': 'Entrar' },
    logout:      { 'zh-CN': '退出',       'en-US': 'Sign out',     'ja-JP': 'ログアウト',     'ko-KR': '로그아웃',     'es-ES': 'Salir' },
    profile:     { 'zh-CN': '个人中心',   'en-US': 'Profile',      'ja-JP': 'プロフィール',   'ko-KR': '프로필',       'es-ES': 'Perfil' },
    brand:       { 'zh-CN': '薯包 AI',    'en-US': 'Shubao AI',    'ja-JP': '薯包 AI',        'ko-KR': '薯包 AI',      'es-ES': 'Shubao AI' },
  },
  common: {
    confirm:     { 'zh-CN': '确定',           'en-US': 'Confirm',        'ja-JP': '確認',            'ko-KR': '확인',            'es-ES': 'Confirmar' },
    cancel:      { 'zh-CN': '取消',           'en-US': 'Cancel',         'ja-JP': 'キャンセル',      'ko-KR': '취소',            'es-ES': 'Cancelar' },
    save:        { 'zh-CN': '保存',           'en-US': 'Save',           'ja-JP': '保存',            'ko-KR': '저장',            'es-ES': 'Guardar' },
    delete:      { 'zh-CN': '删除',           'en-US': 'Delete',         'ja-JP': '削除',            'ko-KR': '삭제',            'es-ES': 'Eliminar' },
    edit:        { 'zh-CN': '编辑',           'en-US': 'Edit',           'ja-JP': '編集',            'ko-KR': '편집',            'es-ES': 'Editar' },
    loading:     { 'zh-CN': '加载中…',        'en-US': 'Loading…',       'ja-JP': '読み込み中…',     'ko-KR': '불러오는 중…',    'es-ES': 'Cargando…' },
    success:     { 'zh-CN': '操作成功',       'en-US': 'Success',        'ja-JP': '成功',            'ko-KR': '성공',            'es-ES': 'Éxito' },
    failed:      { 'zh-CN': '操作失败',       'en-US': 'Failed',         'ja-JP': '失敗',            'ko-KR': '실패',            'es-ES': 'Falló' },
    retry:       { 'zh-CN': '重试',           'en-US': 'Retry',          'ja-JP': '再試行',          'ko-KR': '다시 시도',       'es-ES': 'Reintentar' },
    more:        { 'zh-CN': '更多',           'en-US': 'More',           'ja-JP': 'もっと見る',      'ko-KR': '더 보기',         'es-ES': 'Más' },
  },
  video: {
    create_button:  { 'zh-CN': '生成视频',     'en-US': 'Generate Video',     'ja-JP': '動画を生成',          'ko-KR': '비디오 생성',     'es-ES': 'Generar vídeo' },
    upload_title:   { 'zh-CN': '上传素材',     'en-US': 'Upload Assets',      'ja-JP': '素材をアップロード',  'ko-KR': '소재 업로드',     'es-ES': 'Subir recursos' },
    duration:       { 'zh-CN': '时长',         'en-US': 'Duration',           'ja-JP': '長さ',                'ko-KR': '길이',            'es-ES': 'Duración' },
    resolution:     { 'zh-CN': '分辨率',       'en-US': 'Resolution',         'ja-JP': '解像度',              'ko-KR': '해상도',          'es-ES': 'Resolución' },
    aspect_ratio:   { 'zh-CN': '比例',         'en-US': 'Aspect Ratio',       'ja-JP': 'アスペクト比',        'ko-KR': '비율',            'es-ES': 'Relación' },
    model:          { 'zh-CN': '模型',         'en-US': 'Model',              'ja-JP': 'モデル',              'ko-KR': '모델',            'es-ES': 'Modelo' },
    generating:     { 'zh-CN': '正在生成…',    'en-US': 'Generating…',        'ja-JP': '生成中…',             'ko-KR': '생성 중…',        'es-ES': 'Generando…' },
    download:       { 'zh-CN': '下载',         'en-US': 'Download',           'ja-JP': 'ダウンロード',        'ko-KR': '다운로드',        'es-ES': 'Descargar' },
    preview:        { 'zh-CN': '预览',         'en-US': 'Preview',            'ja-JP': 'プレビュー',          'ko-KR': '미리보기',        'es-ES': 'Vista previa' },
    cost_credits:   { 'zh-CN': '消耗算力',     'en-US': 'Cost',               'ja-JP': 'コスト',              'ko-KR': '비용',            'es-ES': 'Coste' },
  },
  ec: {
    product_name:    { 'zh-CN': '商品名称',     'en-US': 'Product Name',     'ja-JP': '商品名',           'ko-KR': '상품명',          'es-ES': 'Nombre' },
    sku_panel:       { 'zh-CN': 'SKU 面板',    'en-US': 'SKU Panel',        'ja-JP': 'SKU パネル',       'ko-KR': 'SKU 패널',        'es-ES': 'Panel SKU' },
    copy_writer:     { 'zh-CN': '智能文案',     'en-US': 'Smart Copy',       'ja-JP': 'スマートコピー',   'ko-KR': '스마트 카피',     'es-ES': 'Copy IA' },
    platform:        { 'zh-CN': '发布平台',     'en-US': 'Platform',         'ja-JP': 'プラットフォーム', 'ko-KR': '플랫폼',          'es-ES': 'Plataforma' },
    white_bg:        { 'zh-CN': '白底主图',     'en-US': 'White Background', 'ja-JP': '白背景',           'ko-KR': '흰 배경',         'es-ES': 'Fondo blanco' },
    scene_shot:      { 'zh-CN': '场景图',       'en-US': 'Scene Shot',       'ja-JP': 'シーン',           'ko-KR': '씬 샷',           'es-ES': 'Escena' },
    detail_page:     { 'zh-CN': '详情页',       'en-US': 'Detail Page',      'ja-JP': '詳細ページ',       'ko-KR': '상세 페이지',     'es-ES': 'Detalle' },
    params_input:    { 'zh-CN': '商品参数',     'en-US': 'Parameters',       'ja-JP': '商品パラメータ',   'ko-KR': '상품 파라미터',   'es-ES': 'Parámetros' },
    export_zip:      { 'zh-CN': '导出压缩包',   'en-US': 'Export ZIP',       'ja-JP': 'ZIP 出力',         'ko-KR': 'ZIP 내보내기',    'es-ES': 'Exportar ZIP' },
    reference_image: { 'zh-CN': '参考图',       'en-US': 'Reference',        'ja-JP': '参考画像',         'ko-KR': '레퍼런스',        'es-ES': 'Referencia' },
  },
  error: {
    network_error:      { 'zh-CN': '网络错误',       'en-US': 'Network error',         'ja-JP': 'ネットワークエラー', 'ko-KR': '네트워크 오류',     'es-ES': 'Error de red' },
    auth_expired:       { 'zh-CN': '登录已过期',     'en-US': 'Session expired',       'ja-JP': 'セッション期限切れ', 'ko-KR': '세션 만료',         'es-ES': 'Sesión caducada' },
    quota_exceeded:     { 'zh-CN': '算力不足',       'en-US': 'Quota exceeded',        'ja-JP': 'クォータ超過',       'ko-KR': '할당량 초과',       'es-ES': 'Cuota agotada' },
    upload_failed:      { 'zh-CN': '上传失败',       'en-US': 'Upload failed',         'ja-JP': 'アップロード失敗',   'ko-KR': '업로드 실패',       'es-ES': 'Carga fallida' },
    server_error:       { 'zh-CN': '服务器异常',     'en-US': 'Server error',          'ja-JP': 'サーバーエラー',     'ko-KR': '서버 오류',         'es-ES': 'Error del servidor' },
    invalid_input:      { 'zh-CN': '输入不合法',     'en-US': 'Invalid input',         'ja-JP': '入力不正',           'ko-KR': '잘못된 입력',       'es-ES': 'Entrada inválida' },
    file_too_large:     { 'zh-CN': '文件过大',       'en-US': 'File too large',        'ja-JP': 'ファイルが大きすぎます','ko-KR': '파일이 너무 큼',  'es-ES': 'Archivo demasiado grande' },
    unsupported_format: { 'zh-CN': '不支持的格式',   'en-US': 'Unsupported format',    'ja-JP': '未対応形式',         'ko-KR': '지원 안 함',        'es-ES': 'Formato no admitido' },
    payment_required:   { 'zh-CN': '需要付费',       'en-US': 'Payment required',      'ja-JP': '支払いが必要',       'ko-KR': '결제 필요',         'es-ES': 'Pago requerido' },
    unknown_error:      { 'zh-CN': '未知错误',       'en-US': 'Unknown error',         'ja-JP': '不明なエラー',       'ko-KR': '알 수 없는 오류',   'es-ES': 'Error desconocido' },
  },
  locale: {
    switch_lang:  { 'zh-CN': '切换语言',     'en-US': 'Switch language',         'ja-JP': '言語切替',         'ko-KR': '언어 변경',          'es-ES': 'Cambiar idioma' },
    lang_zh:      { 'zh-CN': '简体中文',     'en-US': 'Simplified Chinese',      'ja-JP': '簡体字中国語',     'ko-KR': '중국어 간체',        'es-ES': 'Chino simplificado' },
    lang_en:      { 'zh-CN': '英语',         'en-US': 'English',                 'ja-JP': '英語',             'ko-KR': '영어',              'es-ES': 'Inglés' },
    lang_ja:      { 'zh-CN': '日语',         'en-US': 'Japanese',                'ja-JP': '日本語',           'ko-KR': '일본어',            'es-ES': 'Japonés' },
    lang_ko:      { 'zh-CN': '韩语',         'en-US': 'Korean',                  'ja-JP': '韓国語',           'ko-KR': '한국어',            'es-ES': 'Coreano' },
    lang_es:      { 'zh-CN': '西班牙语',     'en-US': 'Spanish',                 'ja-JP': 'スペイン語',       'ko-KR': '스페인어',          'es-ES': 'Español' },
    welcome:      { 'zh-CN': '欢迎使用薯包', 'en-US': 'Welcome to Shubao',       'ja-JP': '薯包へようこそ',   'ko-KR': '薯包에 오신 것을 환영합니다', 'es-ES': 'Bienvenido a Shubao' },
    tagline:      { 'zh-CN': 'AI 创作平台',  'en-US': 'AI Creative Platform',    'ja-JP': 'AI 創作プラットフォーム', 'ko-KR': 'AI 창작 플랫폼', 'es-ES': 'Plataforma creativa IA' },
    copyright:    { 'zh-CN': '版权所有',     'en-US': 'All rights reserved',     'ja-JP': '全著作権所有',     'ko-KR': '모든 권리 보유',    'es-ES': 'Todos los derechos reservados' },
    free_trial:   { 'zh-CN': '免费试用',     'en-US': 'Free trial',              'ja-JP': '無料トライアル',   'ko-KR': '무료 체험',         'es-ES': 'Prueba gratuita' },
  },
};

// 纯函数: 给定 (key, locale) 返回文案. 严格 3 级 fallback: zh-CN -> key
// 适用场景: SSR / 测试 / 非 React 上下文
export function translate(key, locale = DEFAULT_LOCALE) {
  if (key === null || key === undefined) return key;
  if (typeof key !== 'string' || key.length === 0) return key;
  const parts = key.split('.');
  if (parts.length !== 2) {
    if (typeof console !== 'undefined') console.warn('[i18n] invalid key:', key);
    return key;
  }
  const [cat, sub] = parts;
  const catMap = STRINGS[cat];
  if (!catMap) {
    if (typeof console !== 'undefined') console.warn('[i18n] missing category:', cat);
    return key;
  }
  const entry = catMap[sub];
  if (!entry) {
    if (typeof console !== 'undefined') console.warn('[i18n] missing subkey:', key);
    return key;
  }
  const text = entry[locale] || entry[DEFAULT_LOCALE];
  if (!text) {
    if (typeof console !== 'undefined') console.warn('[i18n] no translation for:', key, locale);
    return key;
  }
  return text;
}

// 校验函数: 给定一个 locale, 遍历 STRINGS 检查完整性
export function validateLocale(locale) {
  const missing = [];
  for (const cat of Object.keys(STRINGS)) {
    for (const sub of Object.keys(STRINGS[cat])) {
      const v = STRINGS[cat][sub][locale];
      if (typeof v !== 'string' || v.length === 0) {
        missing.push(`${cat}.${sub}`);
      }
    }
  }
  return { locale, missing, total: 60, complete: missing.length === 0 };
}

export function listKeys() {
  const keys = [];
  for (const cat of Object.keys(STRINGS)) {
    for (const sub of Object.keys(STRINGS[cat])) {
      keys.push(`${cat}.${sub}`);
    }
  }
  return keys;
}
