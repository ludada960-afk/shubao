/**
 * supplementUploadModel.js
 * 补充素材上传状态管理纯函数
 * 不包含任何副作用，不调用 API，不操作 DOM
 */

/**
 * 产品图角度建议列表
 */
export const PRODUCT_IMAGE_SUGGESTIONS = [
  { key: 'main', label: '清晰主视图', description: '展示产品正面全貌' },
  { key: 'side', label: '侧面角度', description: '展示产品侧面轮廓' },
  { key: 'back', label: '背面结构', description: '展示产品背面细节' },
  { key: 'detail', label: '局部细节', description: '展示材质、工艺特写' },
  { key: 'usage', label: '使用状态', description: '展示产品使用场景' },
  { key: 'package', label: '包装与配件', description: '展示包装和附带配件' },
];

/**
 * 参考图建议列表
 */
export const REFERENCE_IMAGE_SUGGESTIONS = [
  { key: 'style', label: '整体风格', description: '参考整体视觉风格' },
  { key: 'composition', label: '构图参考', description: '参考画面构图方式' },
  { key: 'scene', label: '使用场景', description: '参考场景布置' },
  { key: 'typography', label: '文案版式', description: '参考文字排版' },
  { key: 'lighting', label: '光影与色调', description: '参考光影和色彩' },
];

/**
 * 获取下一张产品图的建议
 * @param {number} currentCount - 当前产品图数量
 * @returns {Object | null} 建议对象
 */
export function getNextProductImageSuggestion(currentCount) {
  if (currentCount >= PRODUCT_IMAGE_SUGGESTIONS.length) {
    return null;
  }
  return PRODUCT_IMAGE_SUGGESTIONS[currentCount];
}

/**
 * 获取下一张参考图的建议
 * @param {number} currentCount - 当前参考图数量
 * @returns {Object | null} 建议对象
 */
export function getNextReferenceImageSuggestion(currentCount) {
  if (currentCount >= REFERENCE_IMAGE_SUGGESTIONS.length) {
    return null;
  }
  return REFERENCE_IMAGE_SUGGESTIONS[currentCount];
}

/**
 * 标准化补充图片数据
 * @param {Array} images - 图片数组
 * @param {Object} options
 * @param {string} options.sourceType - 图片来源类型
 * @param {boolean} options.isInherited - 是否继承自第一步
 * @returns {Array} 标准化后的图片数组
 */
export function normalizeSupplementImages(
  images,
  { sourceType = 'product', isInherited = false } = {}
) {
  if (!Array.isArray(images)) return [];

  return images.map((img, index) => {
    // 处理字符串 URL
    if (typeof img === 'string') {
      return {
        id: `${sourceType}-${Date.now()}-${index}`,
        url: img,
        sourceType,
        isInherited,
        isAdded: !isInherited,
        index,
        status: 'loaded',
      };
    }

    // 处理对象格式
    return {
      id: img.id || `${sourceType}-${Date.now()}-${index}`,
      url: img.url || img.src || '',
      sourceType: img.sourceType || sourceType,
      isInherited: img.isInherited ?? isInherited,
      isAdded: img.isAdded ?? !isInherited,
      index: img.index ?? index,
      status: img.status || 'loaded',
      file: img.file || null,
    };
  });
}

/**
 * 分离继承图片和新增图片
 * @param {Array} images - 混合图片数组
 * @returns {Object} { inherited: [], added: [] }
 */
export function splitInheritedAndAddedImages(images) {
  if (!Array.isArray(images)) {
    return { inherited: [], added: [] };
  }

  return images.reduce(
    (acc, img) => {
      if (img.isInherited || img.inherited) {
        acc.inherited.push(img);
      } else {
        acc.added.push(img);
      }
      return acc;
    },
    { inherited: [], added: [] }
  );
}

/**
 * 判断图片是否可以删除
 * 只有本轮新增的图片可以删除，继承的图片不能删除
 * @param {Object} image - 图片对象
 * @returns {boolean}
 */
export function canRemoveSupplementImage(image) {
  if (!image) return false;

  // 继承的图片不能删除
  if (image.isInherited || image.inherited) return false;

  // 新增的图片可以删除
  if (image.isAdded || image.added) return true;

  // 默认情况下，没有标记为继承的可以删除
  return !image.isInherited;
}

/**
 * 追加新上传的文件到图片列表
 * @param {Array} currentImages - 当前图片列表
 * @param {FileList | File[]} files - 新上传的文件
 * @param {Object} options
 * @param {string} options.sourceType - 'product' | 'reference'
 * @returns {Array} 更新后的图片列表
 */
export function appendSupplementFiles(currentImages, files, { sourceType = 'product' } = {}) {
  if (!files || files.length === 0) return currentImages;

  const fileArray = Array.from(files);
  const startIndex = currentImages.length;

  const newImages = fileArray.map((file, idx) => {
    // 在 Node.js 测试环境中，URL.createObjectURL 可能不可用或接收的不是 Blob
    let url = '';
    if (typeof URL !== 'undefined' && URL.createObjectURL && file instanceof Blob) {
      try {
        url = URL.createObjectURL(file);
      } catch (e) {
        url = '';
      }
    }

    return {
      id: `${sourceType}-${Date.now()}-${idx}`,
      url,
      file,
      sourceType,
      isInherited: false,
      isAdded: true,
      index: startIndex + idx,
      status: 'loading',
      createdAt: Date.now(),
    };
  });

  return [...currentImages, ...newImages];
}

/**
 * 移除指定图片
 * @param {Array} images - 图片列表
 * @param {string} imageId - 要移除的图片 ID
 * @returns {Array} 更新后的图片列表
 */
export function removeSupplementImage(images, imageId) {
  if (!Array.isArray(images)) return [];

  const image = images.find((img) => img.id === imageId);

  // 检查是否可以删除
  if (!canRemoveSupplementImage(image)) {
    return images;
  }

  // 释放 blob URL
  if (image?.url && image.url.startsWith('blob:') && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(image.url);
    } catch (e) {
      // 忽略释放失败
    }
  }

  return images.filter((img) => img.id !== imageId);
}

/**
 * 获取图片状态标签
 * @param {Object} image - 图片对象
 * @returns {string | null} 状态标签文本
 */
export function getImageStatusLabel(image) {
  if (!image) return null;

  if (image.isInherited || image.inherited) {
    return '已带入';
  }

  if (image.isAdded || image.added) {
    return '本轮新增';
  }

  return null;
}

/**
 * 验证图片文件
 * @param {File} file - 文件对象
 * @param {Object} options
 * @param {number} options.maxSize - 最大文件大小（字节）
 * @param {string[]} options.allowedTypes - 允许的文件类型
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateImageFile(
  file,
  { maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] } = {}
) {
  if (!file) {
    return { valid: false, error: '文件不存在' };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `不支持的文件格式: ${file.type}，请上传 ${allowedTypes.join(', ')}`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件过大: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大允许 ${maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * 获取上传区域的提示文本
 * @param {number} count - 当前图片数量
 * @param {string} type - 'product' | 'reference'
 * @returns {string}
 */
export function getUploadPlaceholderText(count, type = 'product') {
  if (type === 'product') {
    if (count === 0) return '上传产品主图';
    const suggestion = getNextProductImageSuggestion(count);
    return suggestion ? `建议: ${suggestion.label}` : '继续添加产品图';
  }

  if (type === 'reference') {
    if (count === 0) return '上传参考图（可选）';
    const suggestion = getNextReferenceImageSuggestion(count);
    return suggestion ? `建议: ${suggestion.label}` : '继续添加参考图';
  }

  return '上传图片';
}

/**
 * 计算图片列表统计
 * @param {Array} productImages - 产品图列表
 * @param {Array} referenceImages - 参考图列表
 * @returns {Object} 统计信息
 */
export function getSupplementStats(productImages, referenceImages) {
  const pInherited = (productImages || []).filter((img) => img.isInherited).length;
  const pAdded = (productImages || []).filter((img) => img.isAdded).length;
  const rInherited = (referenceImages || []).filter((img) => img.isInherited).length;
  const rAdded = (referenceImages || []).filter((img) => img.isAdded).length;

  return {
    product: {
      total: (productImages || []).length,
      inherited: pInherited,
      added: pAdded,
    },
    reference: {
      total: (referenceImages || []).length,
      inherited: rInherited,
      added: rAdded,
    },
    total: (productImages || []).length + (referenceImages || []).length,
  };
}
