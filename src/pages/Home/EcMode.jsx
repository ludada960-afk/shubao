nally {
      if (profileApplyNonceRef.current === applyNonce) setProductProfileApplying('');
    }
  };

  // 「当前商品」全局生效：选中档案即带入商品事实，并自动把主图填入商品槽位。
  const selectActiveProductProfile = async profile => {
    if (!profile?.profileId) return;
    setActiveProfileId(profile.profileId);
    await applySavedProductProfile(profile);
  };

  // 档案详情：把该商品名下全部弱关联素材逐一解析成可预览 URL 后聚合展示。
  const openProfileDetail = async profile => {
    const profileId = String(profile?.profileId || '').trim();
    if (!profileId || !profileAccessRef.current.allowed) return;
    const nonce = ++profileDetailNonceRef.current;
    setProfileRailTab('detail');
    setDetailProfileId(profileId);
    setDetailMedia([]);
    setDetailLoading(true);
    try {
      const refs = Array.isArray(profile?.assets) ? profile.assets : [];
      const resolved = (await Promise.all(refs.map(async ref => {
        if (!ref?.projectId || !ref?.projectAssetId || !ref?.expectedContentHash) return null;
        try {
          const asset = await getProjectAsset(ref.projectId, ref.projectAssetId, 'reuse');
          const url = asset.stableUrl || asset.url;
          if (!url || (asset.mediaKind && asset.mediaKind !== 'image')) return null;
          const role = ['product', 'generated', 'reference', 'person', 'scene'].includes(ref.role) ? ref.role : 'product';
          return { role, url, label: asset.metadata?.displayName || '' };
        } catch {
          return null;
        }
      }))).filter(Boolean);
      if (profileDetailNonceRef.current !== nonce) return;
      setDetailMedia(resolved);
    } catch {
      if (profileDetailNonceRef.current === nonce) setDetailMedia([]);
    } finally {
      if (profileDetailNonceRef.current === nonce) setDetailLoading(false);
    }
  };

  const archiveSavedProductProfile = async profile => {
    if (!profile?.profileId || !profileAccessRef.current.allowed) return;
    setProductProfileError('');
    try {
      await archiveProductProfile(profile.profileId);
      setProductProfiles(previous => previous.filter(item => item.profileId !== profile.profileId));
    } catch (error) {
      setProductProfileError(error?.message || '商品档案归档失败，请稍后重试');
    }
  };

  useEffect(() => {
    invalidateEcommerceGenerationRequest({
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef
    });
    setDraftId(createEcommerceDraftId());
    setUploadingAssets(false);
    setAssetUploadError('');
  }, [ownerEmail]);

  useEffect(() => {
    if (!workVersion || workVersion <= observedEcommerceWorkVersion) return;
    observedEcommerceWorkVersion = workVersion;
    invalidateEcommerceGenerationRequest({
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef
    });
    setDraftId(createEcommerceDraftId());
    setUploadingAssets(false);
    setAssetUploadError('');
  }, [draftId, ownerEmail, workVersion]);

  useEffect(
    () => () => {
      invalidateEcommerceGenerationRequest({
        tokenRef: generationTokenRef,
        abortRef: generationAbortRef
      });
    },
    []
  );

  /* — 图片 — */
  const [productImages, setProductImages] = useState([]);
  const [refImages, setRefImages] = useState([]);
  const [abilityRecipeId, setAbilityRecipeId] = useState('product_suite');
  const [personMode, setPersonMode] = useState('smart');
  const [roleImages, setRoleImages] = useState(() => createAbilityEditorState().roleImages);
  const [unmappedImages, setUnmappedImages] = useState([]);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState('');
  const objectUrlsRef = useRef(new Set());
  const prodFileRef = useRef(null);
  const refFileRef = useRef(null);
  const cardRef = useRef(null);
  const btnRowRef = useRef(null);
  const btnRefs = useRef({});

  /* — 文字 — */
  const [description, setDescription] = useState('');
  const [userSkills, setUserSkills] = useState([]);
  /* 9-11 二轮批注: 技能库入口移到「视觉方向」面板 (不再挂在输入框右侧); 技能以结构化字段进生成请求 */
  const [skillOpen, setSkillOpen] = useState(false);
  /* 9-14 用户决策: 首页电商生图与「万物上身」一律默认走设计方案流程。
     点「下一步」= 生成设计方案 → 进画布, 不再询问 (原两条路的浮层已删, 只留方案链路)。 */
  const applySkill = useCallback(skill => {
    if (!skill) return;
    /* 内置风格技能 (premium_minimal 等) = 画面风格, 直接落到 styleSkill; 任务型技能 → 叠加进 userSkills */
    if (skill.key && STYLE_SKILL_KEYS.has(skill.key)) {
      setStyleSkill(skill.key);
      setSkillOpen(false);
      return;
    }
    if (!skill.body) return;
    setUserSkills(current => {
      const next = [...(current || [])];
      if (!next.some(item => item.id === skill.id)) next.push({ id: skill.id, name: skill.name, version: skill.version || 1, body: skill.body });
      return next.slice(0, 2);
    });
    setSkillOpen(false);
  }, []);
  const removeSkillById = useCallback(id => setUserSkills(current => (current || []).filter(item => item.id !== id)), []);

  /* — 配置 — */
  const [platform, setPlatform] = useState('taobao');
  const [sizing, setSizing] = useState({ smart: true, images: [] });
  const productSuiteSizingRef = useRef({ smart: true, images: [] });
  const contentType = 'main';
  const [targetLanguage, setTargetLanguage] = useState('zh-CN');
  const [styleSkill, setStyleSkill] = useState('smart');
  const [customColors, setCustomColors] = useState(null);
  const [productParams, setProductParams] = useState({
    category: '',
    size: '',
    baseColor: '',
    accentColor: '',
    material: '',
    craft: ''
  });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({
    plan: '',
    sellingPoints: '',
    qc: '',
    details: '',
    maintenance: ''
  });

  /* — 生图设置（分辨率/品质/创意度/反向提示词/种子） — */
  const [genSettings, setGenSettings] = useState({
    resolution: '2K',
    imageModel: 'image2',
    negativePrompt: ''
  });

  /* 9-12 用户批注：首页「下一步」必须先算好积分给用户看，且**随配置实时变化**
     （改模型/清晰度/张数都要跟着变）。口径 = 每张积分 × 张数，与后端 generationUnits 同源。 */
  const planPoints = (() => {
    const model = normalizeImageModel(genSettings.imageModel || 'image2');
    const resolution = String(genSettings.resolution || '2K').toUpperCase();
    const unitsPerImage = generationUnits(model, resolution) || 0;
    /* 9-12 用户批注：默认整套（如 1白底+3主图+1素材+5详情=10 张）必须按整套张数算积分，
       不能在 sizing.images 为空时退化成 1 张 → 显示 1 积分。这里与底部摘要同源。 */
    const planned = resolveSizingImages(platform, { ...sizing, resolution });
    const totalImages = (Array.isArray(planned) && planned.length ? planned : (Array.isArray(sizing.images) ? sizing.images : []))
      .reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
    const count = Math.max(1, totalImages);
    const modelLabel = IMAGE_MODELS.find(entry => entry.id === model)?.label || 'GPT Image 2';
    return {
      totalImages: count,
      modelLabel,
      unitsPerImage,
      points: Number(((unitsPerImage * count) / 1000).toFixed(1)),
    };
  })();

  useEffect(() => {
    if (!recoveryCheckpoint || recoveryCheckpoint.project?.kind !== 'ecommerce') return;
    const restored = restoreCheckpointIntoEditor(recoveryCheckpoint);
    const restoredCommerceContext = normalizeCommerceContext({
      ...(restored.commerceContext || {}),
      platform: restored.commerceContext?.platform || restored.platform
    });
    setDescription(restored.description);
    setPlatform(restoredCommerceContext.platform);
    setSizing(restored.sizing);
    setTargetLanguage(restoredCommerceContext.targetLanguage);
    setStyleSkill(restored.styleSkill);
    setCustomColors(restored.customColors);
    setProductParams(restored.productParams);
    setSkus(restored.skus);
    setCopywriting(restored.copywriting);
    setGenSettings(restored.genSettings);
    setProductImages(restored.productImages);
    setRefImages(restored.referenceImages);
    const restoredRecipeId = restored.abilityRecipe?.id || restored.recipeId || 'product_suite';
    let restoredRecipe;
    try {
      restoredRecipe = getEcommerceAbilityRecipe(restoredRecipeId);
    } catch {
      restoredRecipe = getEcommerceAbilityRecipe('product_suite');
    }
    setAbilityRecipeId(restoredRecipe.id);
    setPersonMode(restored.personMode === 'reference' ? 'reference' : 'smart');
    setRoleImages({
      items: Array.isArray(restored.roleImages?.items) ? restored.roleImages.items : [],
      person: Array.isArray(restored.roleImages?.person) ? restored.roleImages.person : [],
      scene: Array.isArray(restored.roleImages?.scene) ? restored.roleImages.scene : [],
    });
    setUnmappedImages(Array.isArray(restored.unmappedImages) ? restored.unmappedImages : []);
  }, [recoveryCheckpoint]);

  /* — 面板（Portal 定位用视口坐标）—— */
  const [activePanel, setActivePanel] = useState(null);
  const [panelPos, setPanelPos] = useState({
    left: 0,
    bottom: 0,
    width: 0,
    maxH: 400,
    btnCenterX: 0,
    /* 面板可视区内「多行输入框还能长到多高」——由面板顶到视口顶的安全高度反算。
       用户批注①（子项 3）：「可以拉长当前这个框的高度，但这样就得往下面再做一些适配」。
       这就是那层适配：手柄拉伸上限 = 面板可用高 - 已在框内的其它内容高度 - 底部留白。 */
    textareaAvailable: null
  });

  /* Esc 关闭 + 点击外部关闭 */
  useEffect(() => {
    if (!activePanel) {
      return;
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    const handleClick = (e) => {
      const panel = document.getElementById('ec-floating-panel');
      const btnRow = btnRowRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btnRow && btnRow.contains(e.target)) return;
      if (e.target?.closest?.('[data-anchored-portal="true"]')) return;
      setActivePanel(null);
    };
    window.addEventListener('keydown', handleKey);
    setTimeout(() => window.addEventListener('mousedown', handleClick), 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [activePanel]);

  /* 9-11 二轮批注: 面板打开 → 页面锁滚, 滚轮只滚面板 (所有板块同规则) */
  usePanelScrollLock(Boolean(activePanel));

  const adjustedPanels = deriveEffectiveSmartOverrides({
    platform,
    sizing,
    styleSkill,
    customColors,
    productParams,
    skus,
    copywriting,
    genSettings,
    commerceContext: { platform, contentType, targetLanguage }
  });
  const activeProductProfile = productProfiles.find(profile => profile.profileId === activeProfileId) || null;
  const activeAbilityRecipe = getEcommerceAbilityRecipe(abilityRecipeId);
  const activeItemImages = abilityRecipeId === 'anything_tryon' ? roleImages.items : productImages;
  const canGen = abilityRecipeId === 'anything_tryon'
    ? activeItemImages.length > 0
    : productImages.length > 0 || description.trim().length > 0;

  /* ── 下一步 ──
     9-14 用户决策: 电商生图 + 万物上身统一默认**带设计方案**。
     本函数不再接受 quick 参数, 恒走「生成设计方案 → 进画布」这条链路, 首页不再出现二选一。 */
  const handleNext = async () => {
    if (!canGen || uploadingAssets) return;
    /* 同步闸门必须先落位：state 更新是异步的，挡不住同一 tick 的连点。 */
    if (nextClickInFlightRef.current) return;
    nextClickInFlightRef.current = true;
    const loginPreflight = ecommerceLoginPreflight({ logged: state.logged });
    if (!loginPreflight.allowed) {
      nextClickInFlightRef.current = false;
      dispatch(loginPreflight.action);
      setAssetUploadError('');
      return;
    }
    const generationToken = beginGeneration();
    if (!generationToken) {
      nextClickInFlightRef.current = false;
      const contextError = createEcommerceGenerationPreconditionError();
      setAssetUploadError(contextError.message);
      setUploadingAssets(false);
      return;
    }
    const generationController = new AbortController();
    generationAbortRef.current = generationController;
    setUploadingAssets(true);
    setAssetUploadError('');
    const commerceContext = normalizeCommerceContext({
      platform,
      contentType,
      targetLanguage
    });
    const effectiveSizing = {
      smart: sizing.smart !== false,
      resolution: genSettings.resolution,
      imageModel: genSettings.imageModel || 'image2',
      contentType: commerceContext.contentType,
      images: resolveSizingImages(commerceContext.platform, {
        ...sizing,
        resolution: genSettings.resolution
      })
    };
    const effectiveStyle = styleSkill;
    const effectiveParams = productParams;
    const effectiveCopy = copywriting;

    try {
      const tryOn = abilityRecipeId === 'anything_tryon';
      const [realShots, refShots, personShots, sceneShots] = tryOn
        ? await Promise.all([
          uploadEcommerceAssets(roleImages.items, 'product', { signal: generationController.signal }),
          Promise.resolve([]),
          uploadEcommerceAssets(roleImages.person, 'person', { signal: generationController.signal }),
          uploadEcommerceAssets(roleImages.scene, 'scene', { signal: generationController.signal }),
        ])
        : await Promise.all([
          uploadEcommerceAssets(productImages, 'product', { signal: generationController.signal }),
          uploadEcommerceAssets(refImages, 'reference', { signal: generationController.signal }),
          Promise.resolve([]),
          Promise.resolve([]),
        ]);
      if (!isGenerationCurrent(generationToken)) return;
      const roleAssetGroups = tryOn
        ? { items: realShots, person: personShots, scene: sceneShots }
        : { product: realShots, reference: refShots };
      const assetRoles = Object.entries(roleAssetGroups).flatMap(([role, assets]) => assets.map((asset, ordinal) => ({
        assetId: asset.assetId,
        role,
        ordinal,
      })));
      /* P7 方案入画布 (用户 9-11): 「下一步」= 发射到画布 (素材 + 提示词 + 方案对象),
         独立整页「第二步设计方案」不再是主路径 (旧 ecStep=2 保留可读, 入口收敛到画布)。 */
      const launchParams = {
        draftId,
        activeProductProfileId: activeProfileId,
        productName: description.trim() || '商品',
        description: description.trim(),
        category: effectiveParams.category || '其他',
        realShots,
        refShots,
        productImages: realShots,
        personShots,
        sceneShots,
        abilityRecipe: {
          id: activeAbilityRecipe.id,
          version: activeAbilityRecipe.version,
          ...(tryOn ? {
            constraints: {
              preserveMaterial: effectiveParams.preserveMaterial !== false,
              preservePattern: effectiveParams.preservePattern !== false,
              consistentPersonScene: effectiveParams.consistentPersonScene !== false,
            },
          } : {}),
        },
        assetRoles,
        roleImages: roleAssetGroups,
        personMode: tryOn ? personMode : 'smart',
        unmappedImages,
        platform: commerceContext.platform,
        contentType: commerceContext.contentType,
        targetLanguage: commerceContext.targetLanguage,
        commerceContext,
        sizing: effectiveSizing,
        userSkills,
        styleSkill: effectiveStyle,
        customColors,
        productParams: effectiveParams,
        skus,
        copywriting: effectiveCopy,
        genSettings
      };
      onStepChange?.(launchParams);
      /* 9-14: 恒带设计方案发射到画布 —— 画布物化为「素材行 + 生成要求 + 设计方案节点」,
         方案节点生成后「应用到画布」再连套图生成器。首页无快速通道入口, quick 恒为 false。 */
      dispatch({ type: 'SET_CREATION_LAUNCH', launch: { kind: 'ec-plan-launch', quick: false, ...launchParams } });
      dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
      setEcStep?.(2); /* 旧步骤态保留 (legacy 可读口径), 主路径已走画布发射 */
    } catch (error) {
      if (!isGenerationCurrent(generationToken)) return;
      setAssetUploadError(error?.message || '原图上传失败，请重试');
    } finally {
      /* 闸门必须在所有出口释放（含失败、含被取消），否则按钮会永久卡死。 */
      nextClickInFlightRef.current = false;
      if (isGenerationCurrent(generationToken)) {
        setUploadingAssets(false);
        generationTokenRef.current = null;
        generationAbortRef.current = null;
      }
    }
  };

  /* ── 图片上传：统一按能力配方的语义槽处理 ── */
  const appendRoleFiles = (role, event) => {
    const files = Array.from(event?.target?.files || []);
    const recipe = getEcommerceAbilityRecipe(abilityRecipeId);
    const slot = recipe.inputSlots.find(item => item.id === role);
    if (!slot) return;
    const current = role === 'product'
      ? productImages
      : role === 'reference' ? refImages : (roleImages[role] || []);
    const available = Math.max(0, slot.max - current.length);
    if (!available) {
      setAssetUploadError(`${slot.label}最多上传 ${slot.max} 张`);
      event.target.value = '';
      return;
    }
    const additions = files.slice(0, available).map(file => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return { url, file };
    });
    const next = [...current, ...additions];
    if (role === 'product' || role === 'items') setProductImages(next);
    if (role === 'reference') setRefImages(next);
    setRoleImages(previous => ({ ...previous, [role]: next }));
    setAssetUploadError('');
    event.target.value = '';
  };

  const handleRoleUpload = (role, event) => {
    if (role === 'person' && event?.target?.files?.length) setPersonMode('reference');
    appendRoleFiles(role, event);
  };
  const handleProdUpload = event => appendRoleFiles(abilityRecipeId === 'anything_tryon' ? 'items' : 'product', event);
  const handleRefUpload = event => appendRoleFiles(abilityRecipeId === 'anything_tryon' ? 'scene' : 'reference', event);

  const handlePersonModeChange = mode => {
    const nextMode = mode === 'reference' ? 'reference' : 'smart';
    if (nextMode === 'smart') {
      (roleImages.person || []).forEach(image => {
        if (image?.url?.startsWith('blob:')) {
          URL.revokeObjectURL(image.url);
          objectUrlsRef.current.delete(image.url);
        }
      });
      setRoleImages(previous => ({ ...previous, person: [] }));
    }
    setPersonMode(nextMode);
  };

  const removeRoleImage = (role, index) => {
    const current = role === 'product'
      ? productImages
      : role === 'reference' ? refImages : (roleImages[role] || []);
    const removed = current[index];
    if (removed?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
      objectUrlsRef.current.delete(removed.url);
    }
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    if (role === 'product' || role === 'items') setProductImages(next);
    if (role === 'reference') setRefImages(next);
    if (role === 'person' && next.length === 0) setPersonMode('smart');
    setRoleImages(previous => ({ ...previous, [role]: next }));
  };

  const handleRecipeChange = nextRecipeId => {
    if (nextRecipeId === abilityRecipeId) return;
    const switched = switchAbilityRecipe({
      currentRecipeId: abilityRecipeId,
      nextRecipeId,
      currentRoleImages: {
        ...roleImages,
        product: productImages,
        reference: refImages,
        unmapped: unmappedImages,
      },
      productImages,
      refImages,
    });
    setAbilityRecipeId(nextRecipeId);
    setPersonMode(switched.personMode || 'smart');
    setUnmappedImages(switched.unmappedImages || []);
    if (nextRecipeId === 'anything_tryon') {
      productSuiteSizingRef.current = sizing;
      setSizing({
        smart: false,
        images: [{ key: 'main_3x4', label: '穿搭成片', count: 4, ratio: '3:4', targetRatio: '3:4', cropPolicy: 'none' }],
      });
      setRoleImages({
        items: switched.roleImages.items || [],
        person: switched.roleImages.person || [],
        scene: switched.roleImages.scene || [],
      });
      setProductImages(switched.roleImages.items || []);
      setRefImages([]);
    } else {
      setSizing(productSuiteSizingRef.current || { smart: true, images: [] });
      setProductImages(switched.productImages || []);
      setRefImages(switched.refImages || []);
      setRoleImages({ items: [], person: [], scene: [] });
    }
    setAssetUploadError('');
  };

  useEffect(() => {
    if (!initialRecipeId || initialRecipeId === abilityRecipeId) return;
    try {
      handleRecipeChange(getEcommerceAbilityRecipe(initialRecipeId).id);
    } catch {
      // Ignore stale navigation intents and keep the default recipe.
    }
  }, [initialRecipeId]);

  const removeProdImg = index => removeRoleImage(abilityRecipeId === 'anything_tryon' ? 'items' : 'product', index);
  const removeRefImg = index => removeRoleImage(abilityRecipeId === 'anything_tryon' ? 'scene' : 'reference', index);

  /* ── 产品图上传建议提示 ── */
  const getProdHint = (count) => {
    if (count === 0) return '建议上传 3-5 张产品图（正面、侧面、细节），多角度让 AI 生成更精准';
    if (count === 1) return '✓ 已上传正面图，建议再上传侧面图和细节图';
    if (count === 2) return '✓ 已上传 2 张，建议再上传 1-3 张细节/使用场景图';
    if (count >= 3 && count <= 5) return `✓ 已上传 ${count} 张，数量合适，AI 生成效果最佳`;
    return `已上传 ${count} 张产品图`;
  };

  const getNextProductShot = (count) => PRODUCT_SHOT_PLAN[Math.min(count, PRODUCT_SHOT_PLAN.length - 1)];

  /* ── 参考图上传建议提示 ── */
  const getRefHint = (count) => {
    if (count === 0) return '可上传竞品图、爆款图或喜欢的风格图（支持批量上传）';
    return `已上传 ${count} 张参考图`;
  };

  /* ── 组件卸载时释放所有 Object URL 防止内存泄漏 ── */
  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  /* ── 6 个功能按钮（AI 感图标升级）── */
  /* 内置风格技能 key (与后端 styleSkills 同源) — 从技能库选中即落到本次生成的风格 */
const STYLE_SKILL_KEYS = new Set(['premium_minimal', 'lifestyle_scene', 'fashion_editorial', 'warm_natural', 'tech_precision']);

const DEFAULT_BUTTONS = [
    {
      key: 'settings',
      label: '生成设置',
      icon: <Settings2 size={15} strokeWidth={1.8} />
    },
    {
      key: 'sizing',
      label: '套图方案',
      icon: <Images size={15} strokeWidth={1.8} />
    },
    {
      key: 'sku',
      label: 'SKU变体',
      icon: <Package size={15} strokeWidth={1.8} />
    },
    {
      /* 9-11 三轮用户批注: 视觉方向整个拿掉, 入口就是技能库 (点开即技能库, 不再叠面板+弹窗) */
      key: 'skills',
      label: '技能库',
      icon: <Wand2 size={15} strokeWidth={1.8} />,
      opensSkillLibrary: true
    },
    {
      key: 'params',
      label: '商品信息',
      icon: <SlidersHorizontal size={15} strokeWidth={1.8} />
    },
    {
      key: 'copy',
      label: '内容规范',
      icon: <FileText size={15} strokeWidth={1.8} />
    }
  ];
  const BUTTONS = abilityRecipeId === 'anything_tryon'
    ? [
      DEFAULT_BUTTONS[0],
      { ...DEFAULT_BUTTONS[1], label: '成片规格' },
      DEFAULT_BUTTONS[3],
      { ...DEFAULT_BUTTONS[4], label: '商品细节' },
    ]
    : DEFAULT_BUTTONS;

  /* ── 面板定位：Portal 固定到当前按钮，并在滚动时持续跟随 ── */
  const repositionPanel = useCallback(() => {
    if (!activePanel) return;
    const el = btnRefs.current[activePanel];
    if (!el) return;
    const btnRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    /* 用户批注①（子项 2/3）：六个面板宽度必须统一（口径 360–560，统一值取
       PANEL_WIDTH_TABLE.standard = 480），窄屏由 resolvePanelWidth 兜底。
       改造前这里是 sizing:480 / sku:540 / style:520 / params:520 / copy:620 /
       settings:460 六套写死的宽度 —— 这就是「有的宽有的窄」的根因。 */
    const panelW = resolvePanelWidth(vw);
    const btnCenterX = btnRect.left + btnRect.width / 2;
    /* 8-14：面板高度按内容自然撑开（Home.css 里 height:auto + 视口 max-height）。
       这里读一次已渲染高度上报给 CSS，让 bottom 上限能反算出「顶部不越顶栏安全区」。
       读不到（首帧还没挂载）就沿用上一次的值，避免抖动。 */
    const livePanel = document.getElementById('ec-floating-panel');
    const panelH = livePanel ? Math.ceil(livePanel.getBoundingClientRect().height) : 0;
    /* 多行输入框的可用高度：面板顶部到视口顶的安全距离（扣除 topbar 68 + 16 呼吸），
       再减掉面板自身的头部与内边距。这样「拉到底」时输入框下沿始终落在可视区内，
       出现的是面板内部滚动，而不是被截断。 */
    const panelTop = livePanel ? livePanel.getBoundingClientRect().top : 0;
    const panelHead = livePanel?.querySelector('.ec-config-panel-header')?.getBoundingClientRect().height || 0;
    const roomToTop = livePanel ? Math.max(120, panelTop - 84) : 0;
    const textareaAvailable = Math.max(120, Math.round(roomToTop + panelH - panelHead - 96));
    setPanelPos((previous) => ({
      left: Math.max(16, Math.min(btnCenterX - panelW / 2, vw - panelW - 16)),
      bottom: Math.max(16, window.innerHeight - btnRect.top + 10),
      width: panelW,
      maxH: Math.max(300, Math.min(620, btnRect.top - 24)),
      btnCenterX,
      panelH: panelH || previous.panelH || 0,
      textareaAvailable
    }));
  }, [activePanel]);

  /* 8-14：面板内容变化（展开模型列表 / 锁定品牌色出现取色器）后高度会变，
     ResizeObserver 把新高度同步回 CSS 变量，保证 bottom 上限始终按真实高度反算。 */
  useEffect(() => {
    if (!activePanel) return undefined;
    const el = document.getElementById('ec-floating-panel');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      const withinPanel = el.querySelector('.ec-config-panel-body');
      /* 输入框可用高度 = 面板可视高 - 面板头部 - 内边距留白 */
      const headH = el.querySelector('.ec-config-panel-header')?.getBoundingClientRect().height || 0;
      const available = Math.max(120, Math.round(h - headH - 96));
      setPanelPos((previous) => (
        previous.panelH === h && previous.textareaAvailable === available
          ? previous
          : { ...previous, panelH: h, textareaAvailable: available }
      ));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activePanel]);

  useEffect(() => {
    if (!activePanel) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [activePanel, repositionPanel]);

  const openPanel = useCallback(
    (key) => {
      /* 9-11 三轮批注: 技能库不是浮层面板, 点开即弹技能库 (避免面板与弹窗叠在一起) */
      if (key === 'skills') {
        setActivePanel(null);
        setSkillOpen(current => !current);
        return;
      }
      if (activePanel === key) {
        setActivePanel(null);
        return;
      }
      const el = btnRefs.current[key];
      const btnRow = btnRowRef.current;
      if (el && btnRow) {
        const btnRect = el.getBoundingClientRect();
        const rowRect = btnRow.getBoundingClientRect();
        const vw = window.innerWidth;

        // 面板宽度：六个面板统一走视觉语言规范（不再是「按内容类型各调各的」）
        const panelW = resolvePanelWidth(vw);

        // 使用 Portal 固定在视口：不受顶部导航、父级 overflow 或卡片高度裁切。
        const btnCenterX = btnRect.left + btnRect.width / 2;
        const panelLeft = Math.max(16, Math.min(btnCenterX - panelW / 2, vw - panelW - 16));
        const panelBottom = Math.max(16, window.innerHeight - btnRect.top + 10);
        const maxH = Math.max(300, Math.min(620, btnRect.top - 24));

        setPanelPos({
          left: panelLeft,
          bottom: panelBottom,
          width: panelW,
          maxH,
          btnCenterX
        });
      }
      setActivePanel(key);
    },
    [activePanel]
  );

  /* ── 浮层渲染：Portal 到 body，彻底避免卡片与导航裁切 ── */
  const renderPanel = () => {
    if (!activePanel) return null;
    const panelMeta = BUTTONS.find((item) => item.key === activePanel);
    return createPortal(
      <div
        id="ec-floating-panel"
        className="ec-config-panel"
        data-panel={activePanel}
        style={{
          ...GLASS_PANEL,
          position: 'fixed',
          bottom: panelPos.bottom,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          overflowY: 'auto',
          zIndex: 1100,
          transformOrigin: 'bottom center',
          '--ec-panel-anchor-x': `${Math.max(28, Math.min(panelPos.width - 28, panelPos.btnCenterX - panelPos.left))}px`,
          /* 8-14 用户批注：面板「压得这么矮 / 或顶出屏幕」—— 高度必须按内容自然撑开。
             这里只上报两条信息给 Home.css 统一裁决（height:auto + max-height 视口上限）：
               --ec-panel-bottom-safe：触发条上方的锚点（贴住按钮）
               --ec-panel-h：面板当前自然高度，用于反算「顶部不越顶栏安全区」的 bottom 上限
             高度本身不在这里写死，避免再次把面板压扁。 */
          '--ec-panel-bottom-safe': `${panelPos.bottom}px`,
          '--ec-panel-h': `${panelPos.panelH || 460}px`
        }}
      >
        <div className="ec-config-panel-header">
          <span className="ec-config-panel-icon">{panelMeta?.icon}</span>
          <div>
            <strong>{panelMeta?.label}</strong>
            <span>{abilityRecipeId === 'anything_tryon' ? '调整本次上身成片的生成规则' : '调整本次电商套图的生成规则'}</span>
          </div>
        </div>
        <div className="ec-config-panel-body">
          {activePanel === 'sizing' && (abilityRecipeId === 'anything_tryon'
            ? <TryOnPlanPanel sizing={sizing} onSizingChange={setSizing} />
            : <SizingPanel platform={platform} onPlatformChange={setPlatform} sizing={sizing} onSizingChange={setSizing} resolution={genSettings.resolution} targetLanguage={targetLanguage} onTargetLanguageChange={setTargetLanguage} />)}
          {activePanel === 'params' && <ParamsPanel mode={abilityRecipeId === 'anything_tryon' ? 'tryon' : 'product'} params={productParams} onChange={setProductParams} available={panelPos.textareaAvailable} />}
          {activePanel === 'sku' && <SkuPanel skus={skus} onChange={setSkus} sizing={sizing} onSizingChange={setSizing} available={panelPos.textareaAvailable} />}
          {/* 「内容规范」= 正向要什么（CopyPanel）+ 反向不要什么（GenerationConstraintsPanel）。
              用户批注①（子项 2）：「避免出现的元素」不属于「生成设置」（那是设备/输出参数），
              它是一条画面内容约束，语义归属就是描述内容的标准面板。
              数据链路不变（genSettings.negativePrompt），画布侧同步不受影响。 */}
          {activePanel === 'copy' && (
            <>
              <CopyPanel copywriting={copywriting} onChange={setCopywriting} available={panelPos.textareaAvailable} />
              <CopyPanelDivider />
              <GenerationConstraintsPanel negativePrompt={genSettings.negativePrompt} onChange={next => setGenSettings(current => ({ ...current, negativePrompt: next }))} available={panelPos.textareaAvailable} />
            </>
          )}
          {activePanel === 'settings' && <GenSettingsPanel value={genSettings} onChange={setGenSettings} brandColors={customColors} onBrandColorsChange={setCustomColors} />}
        </div>
      </div>,
      document.body
    );
  };

  /* 2026-09-15 V3：删除 StepIndicator —— 它是一个 95 行的**死组件**
（全仓搜索零引用，EcMode 从未渲染它）。它内含最后一批未 token 化的
硬编码色值（紫渐变/纯黑字/灰阶三态），保留即为「随时可能被误用回线上」的
负债。已确认无引用后整体移除。 */

  return (
    <div>
      {/* ═══ 暖黄色背景卡片（与小红书图文一致）═══ */}
      {/* 工作台主卡：是「可点的大块」→ L2 --sb-surface-card，
          圆角 --sb-radius-panel(20)，内边距走间距阶梯（原则 3.1 / 3.4）。 */}
      <div
        ref={cardRef}
        className="ec-main-card"
        style={{
          borderRadius: 'var(--sb-radius-panel)',
          background: 'var(--sb-surface-card)',
          padding: 'var(--sb-space-4) var(--sb-panel-padding)',
          position: 'relative'
        }}
      >
        <EcProfileRail
          open={productProfilesOpen}
          tab={profileRailTab}
          profiles={productProfiles}
          loading={productProfilesLoading}
          saving={productProfileSaving}
          applying={productProfileApplying}
          error={productProfileError}
          activeProfileId={activeProfileId}
          detailProfileId={detailProfileId}
          detailMedia={detailMedia}
          detailLoading={detailLoading}
          onToggle={() => {
            setProductProfilesOpen(open => !open);
            if (!productProfilesOpen) refreshProductProfiles();
          }}
          onTabChange={setProfileRailTab}
          onRefresh={refreshProductProfiles}
          onSave={saveCurrentProductProfile}
          onSelect={selectActiveProductProfile}
          onOpenDetail={openProfileDetail}
          onArchive={archiveSavedProductProfile}
        />
        <div className="ec-mode-main">
        <EcommerceWorkbench
          productImages={productImages}
          refImages={refImages}
          roleImages={roleImages}
          unmappedImages={unmappedImages}
          abilityRecipeId={abilityRecipeId}
          personMode={personMode}
          onPersonModeChange={handlePersonModeChange}
          onAbilityRecipeChange={handleRecipeChange}
          onRoleUpload={handleRoleUpload}
          onRoleRemove={removeRoleImage}
          description={description}
          onDescriptionChange={setDescription}
                userSkills={userSkills}
                onUserSkillsChange={setUserSkills}
          onProductUpload={handleProdUpload}
          onReferenceUpload={handleRefUpload}
          onRemoveProduct={removeProdImg}
          onRemoveReference={removeRefImg}
        />
        <SkillLibraryModal open={skillOpen} onClose={() => setSkillOpen(false)} initialKind="image" onPick={applySkill} />
        {/* ═══ 上下布局：上方双列上传区 + 下方文字输入 ═══ */}
        {false && (
          <div style={{ display: 'none' }}>
            {/* ── 上方：双列上传区（产品图 × 参考图，小红书同款样式）── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              {/* 产品图上传区 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  transform: 'rotate(-1.25deg)'
                }}
              >
                <div
                  /* 原则 6.2：语义色（红=危险）不得当作「产品图」这个身份标识。
                     两卡统一中性规格，靠标题与图标区分。 */
                  style={{
                    background: 'var(--sb-surface-card)',
                    borderRadius: 'var(--sb-radius-card)',
                    border: '2px solid var(--sb-border-default)',
                    boxShadow: 'var(--sb-shadow-md)',
                    padding: 'var(--sb-space-3)',
                    minHeight: 110,
                    transition: 'border-color var(--sb-duration-normal) var(--sb-ease-out), box-shadow var(--sb-duration-normal) var(--sb-ease-out)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--sb-border-strong)';
                    e.currentTarget.style.boxShadow = 'var(--sb-shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--sb-border-default)';
                    e.currentTarget.style.boxShadow = 'var(--sb-shadow-md)';
                  }}
                >
                  {/* 标题行 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10
                    }}
                  >
                    <span style={{ fontSize: 12 }}>📸</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--sb-ink-1)'
                      }}
                    >
                      产品图
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--sb-text-2xs)',
                        color: 'var(--sb-brand-ink)',
                        background: 'var(--sb-brand)',
                        padding: '2px var(--sb-space-2)',
                        borderRadius: 'var(--sb-radius-pill)',
                        marginLeft: 'auto',
                        fontWeight: 600
                      }}
                    >
                      必须
                    </span>
                  </div>

                  {/* 横向滚动的图片行 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 7,
                      scrollbarWidth: 'thin'
                    }}
                  >
                    {productImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '2px solid var(--sb-neutral-150)',
                          flex: '0 0 auto'
                        }}
                      >
                        <img
                          src={img.url}
                          width="92"
                          height="92"
                          loading="lazy"
                          decoding="async"
                          fetchpriority="auto"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: '3px 4px',
                            background: 'linear-gradient(transparent, rgba(12,10,9,0.72))',
                            color: 'var(--sb-neutral-0)',
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {PRODUCT_SHOT_PLAN[Math.min(idx, PRODUCT_SHOT_PLAN.length - 1)].short}
                        </div>
                        <div
                          onClick={() => removeProdImg(idx)}
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: 'var(--sb-danger)',
                            color: 'var(--sb-neutral-0)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            cursor: 'pointer',
                            border: '2px solid var(--sb-neutral-0)',
                            fontWeight: 700
                          }}
                        >
                          ×
                        </div>
                      </div>
                    ))}

                    {/* 添加按钮 */}
                    <div
                      onClick={() => prodFileRef.current?.click()}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        border: '2px dashed var(--sb-neutral-300)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: 'var(--sb-neutral-0)',
                        flex: '0 0 auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--sb-border-strong)';
                        e.currentTarget.style.color = 'var(--sb-text-primary)';
                        e.currentTarget.style.background = 'var(--sb-surface-tint)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--sb-neutral-300)';
                        e.currentTarget.style.color = 'var(--sb-ink-4)';
                        e.currentTarget.style.background = 'var(--sb-neutral-0)';
                      }}
                    >
                      <ImagePlus size={16} color="#999" />
                      <span style={{ fontSize: 10, color: 'var(--sb-ink-4)', fontWeight: 600 }}>+ {getNextProductShot(productImages.length).short}</span>
                    </div>
                  </div>

                  {/* 提示文字 */}
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--sb-ink-4)',
                      marginTop: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {getProdHint(productImages.length)}
                  </div>
                </div>

                <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
              </div>

              {/* 乘号分隔 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  padding: '0 4px',
                  alignSelf: 'center'
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--sb-brand-600), #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--sb-neutral-0)',
                    fontSize: 14,
                    fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(124,58,237,0.3)'
                  }}
                >
                  ×
                </div>
              </div>

              {/* 参考图上传区 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  transform: 'rotate(1.25deg)'
                }}
              >
                <div
                  /* 同规格：参考图不再用「信息蓝」，与产品卡完全一致（原则 6.2） */
                  style={{
                    background: 'var(--sb-surface-card)',
                    borderRadius: 'var(--sb-radius-card)',
                    border: '2px solid var(--sb-border-default)',
                    boxShadow: 'var(--sb-shadow-md)',
                    padding: 'var(--sb-space-3)',
                    minHeight: 110,
                    transition: 'border-color var(--sb-duration-normal) var(--sb-ease-out), box-shadow var(--sb-duration-normal) var(--sb-ease-out)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--sb-border-strong)';
                    e.currentTarget.style.boxShadow = 'var(--sb-shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--sb-border-default)';
                    e.currentTarget.style.boxShadow = 'var(--sb-shadow-md)';
                  }}
                >
                  {/* 标题行 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10
                    }}
                  >
                    <span style={{ fontSize: 12 }}>🎨</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--sb-ink-1)'
                      }}
                    >
                      参考图
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--sb-ink-3)',
                        background: 'rgba(12,10,9,0.04)',
                        padding: '2px 8px',
                        borderRadius: 8,
                        marginLeft: 'auto',
                        fontWeight: 500
                      }}
                    >
                      可选
                    </span>
                  </div>

                  {/* 横向滚动的图片行 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 7,
                      scrollbarWidth: 'thin'
                    }}
                  >
                    {refImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '2px solid var(--sb-neutral-150)',
                          flex: '0 0 auto'
                        }}
                      >
                        <img
                          src={img.url}
                          width="92"
                          height="92"
                          loading="lazy"
                          decoding="async"
                          fetchpriority="auto"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div
                          onClick={() => removeRefImg(idx)}
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: 'var(--sb-danger)',
                            color: 'var(--sb-neutral-0)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            cursor: 'pointer',
                            border: '2px solid var(--sb-neutral-0)',
                            fontWeight: 700
                          }}
                        >
                          ×
                        </div>
                      </div>
                    ))}

                    {/* 添加按钮 */}
                    <div
                      onClick={() => refFileRef.current?.click()}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        border: '2px dashed var(--sb-neutral-300)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: 'var(--sb-neutral-0)',
                        flex: '0 0 auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--sb-border-strong)';
                        e.currentTarget.style.color = 'var(--sb-text-primary)';
                        e.currentTarget.style.background = 'var(--sb-surface-tint)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--sb-neutral-300)';
                        e.currentTarget.style.color = 'var(--sb-ink-4)';
                        e.currentTarget.style.background = 'var(--sb-neutral-0)';
                      }}
                    >
                      <ImagePlus size={16} color="#999" />
                      <span style={{ fontSize: 10, color: 'var(--sb-ink-4)', fontWeight: 600 }}>{refImages.length === 0 ? '上传参考' : '+ 继续添加'}</span>
                    </div>
                  </div>

                  {/* 提示文字 */}
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--sb-ink-4)',
                      marginTop: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {getRefHint(refImages.length)}
                  </div>
                </div>

                <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
              </div>
            </div>

            {/* ── 下方：产品描述输入区（小红书同款 textarea）── */}
            <div className="hero-textarea-wrap" style={{ margin: 0 }}>
              <textarea className="hero-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder=" " />
              <div className="custom-placeholder">
                <div className="ph-main">描述你的产品名称、特点、材质、用途…</div>
                <div className="ph-sub">例如：白色陶瓷马克杯，简约北欧风，容量350ml，带木质把手，适合办公家用</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 配置按钮行（相对定位容器，面板在此内部绝对定位）═══ */}
        <div
          ref={btnRowRef}
          className="ec-workbench-actions ec-commerce-workbench-actions"
          style={{
            padding: '12px 2px 14px',
            position: 'relative',
            zIndex: 10,
            borderTop: '1px solid rgba(28,25,23,0.08)',
            background: 'var(--sb-neutral-0)'
          }}
        >
          <div className="ec-workbench-primary-row">
            <div className="ec-workbench-tools">
              {/* 9-13 用户批注：底部这排里的「商品档案」入口删掉 ——
                  「现在其实我们自己有个资产库了，这个所谓的商品档案其实也是类似资产库的东西，
                    我觉得是没有必要的，你可以把它给删掉了。」
                  底层档案能力保留（小红书/Plog 跨模式仍可复用），只是不再在电商工作台底部占一个入口。 */}
              {/* ═══ 面板渲染（Portal 到 body）═══ */}
              {renderPanel()}
              {/* ── 6 个功能按钮（带配置回显 - 类似椒图AI）── */}
              {BUTTONS.map((btn) => {
                const isOpen = activePanel === btn.key;
                const isAdjusted = adjustedPanels[btn.key];
                // 计算配置摘要（始终显示，类似椒图AI）
                const getConfigSummary = () => {
                  switch (btn.key) {
                    case 'sizing': {
                      const images = resolveSizingImages(platform, {
                        ...sizing,
                        resolution: genSettings.resolution
                      });
                      return {
                        text: summarizeCommerceConfiguration('sizing', {
                          images
                        }),
                        isSmart: false
                      };
                    }
                    case 'style': {
                      const styleMap = {
                        smart: '智能风格',
                        premium_minimal: '高级极简',
                        lifestyle_scene: '生活场景',
                        fashion_editorial: '时尚杂志',
                        warm_natural: '自然暖调',
                        tech_precision: '科技精工'
                      };
                      const base = styleMap[styleSkill] || styleSkill;
                      const hasColor = customColors && customColors.length > 0;
                      return {
                        text: hasColor ? `${base}+品牌色` : base,
                        isSmart: false
                      };
                    }
                    case 'params': {
                      return {
                        text: summarizeCommerceConfiguration('params', {
                          productParams
                        }),
                        isSmart: false
                      };
                    }
                    case 'sku': {
                      return {
                        text: summarizeCommerceConfiguration('sku', { skus }),
                        isSmart: false
                      };
                    }
                    case 'copy': {
                      /* 「内容规范」现在同时承载正向文案与反向约束（避免出现的元素），
                         摘要把两者都带上，否则用户看不到约束已生效。 */
                      const fields = ['plan', 'sellingPoints', 'qc', 'details', 'maintenance'];
                      const filled = fields.filter((k) => copywriting?.[k]?.trim?.()).length;
                      const hasNegative = Boolean(genSettings.negativePrompt?.trim?.());
                      if (filled > 0 && hasNegative) return { text: `${filled}项文案+约束`, isSmart: false };
                      if (filled > 0) return { text: `${filled}项文案`, isSmart: false };
                      if (hasNegative) return { text: '已设生成约束', isSmart: false };
                      return { text: '文案策划', isSmart: false };
                    }
                    case 'settings': {
                      const { resolution = '2K', imageModel = 'image2' } = genSettings;
                      const modelLabel = imageModel === 'nano-banana-pro' ? 'Nano Pro' : imageModel === 'nano-banana-2' ? 'Nano 2' : 'Image 2';
                      return { text: `${modelLabel}·${resolution}`, isSmart: false };
                    }
                    default:
                      return { text: null, isSmart: false };
                  }
                };
                const summary = getConfigSummary();
                return (
                  <button
                    type="button"
                    key={btn.key}
                    ref={(el) => {
                      if (el) btnRefs.current[btn.key] = el;
                    }}
                    onClick={() => openPanel(btn.key)}
                    aria-label={`${btn.label}：${summary.text || btn.label}`}
                    aria-expanded={btn.opensSkillLibrary ? skillOpen : isOpen}
                    className={`ec-config-trigger${isOpen ? ' is-open' : ''}${isAdjusted ? ' is-adjusted' : ''}`}
                    style={{
                      ...BTN_BASE,
                      appearance: 'none',
                      border: `1.5px solid ${activePanel === btn.key ? 'var(--sb-ink-1)' : 'rgba(28,25,23,.28)'}`,
                      borderColor: isOpen ? 'var(--sb-brand-500)' : isAdjusted ? 'rgba(139,92,246,0.55)' : 'rgba(28,25,23,0.10)',
                      background: isOpen ? '#f1e9ff' : isAdjusted ? '#fbf8ff' : 'var(--sb-neutral-0)',
                      position: 'relative',
                      boxShadow: isOpen ? '0 4px 14px rgba(124,58,237,0.15)' : isAdjusted ? '0 3px 10px rgba(124,58,237,0.10)' : BTN_BASE.boxShadow
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        e.currentTarget.style.background = '#faf7ff';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(62,43,26,0.10)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOpen) {
                        e.currentTarget.style.background = isAdjusted ? '#fbf8ff' : 'var(--sb-neutral-0)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = isAdjusted ? '0 3px 10px rgba(124,58,237,0.10)' : BTN_BASE.boxShadow;
                      }
                    }}
                  >
                    <span
                      style={{
                        color: isAdjusted ? 'var(--sb-brand-600)' : 'var(--text-muted)',
                        flexShrink: 0,
                        filter: isAdjusted ? 'drop-shadow(0 1px 2px rgba(124,58,237,0.2))' : 'none'
                      }}
                    >
                      {btn.icon}
                    </span>
                    {/* 焦图AI风格：直接显示配置内容，替代原有标签 */}
                    <span className="ec-config-trigger-copy">
                      <span>{btn.label}</span>
                      <strong>{summary.text || btn.label}</strong>
                    </span>
                    {isAdjusted && <span className="ec-config-adjusted-badge">已调整</span>}
                    <ChevronDown
                      size={13}
                      style={{
                        opacity: isOpen ? 0.8 : 0.4,
                        color: isAdjusted ? 'var(--sb-brand-600)' : 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.22s ease, opacity 0.2s'
                      }}
                    />
                  </button>
                );
              })}
            </div>


            {/* ── 下一步按钮 ── */}
            {assetUploadError && (
              <div role="alert" style={{ color: 'var(--sb-ink-danger-strong)', fontSize: 12, marginRight: 8 }}>
                {assetUploadError}
              </div>
            )}
            {/* 9-14 用户决策: 电商生图 + 万物上身统一默认走设计方案流程 ——
                「下一步」不再弹浮层, 点击即走「生成设计方案 → 进画布」。
                按钮文案诚实反映链路; 积分仍按既有口径动态显示 (每张积分 × 张数)。 */}
            <div className="ec-workbench-submit-actions" style={{ position: 'relative' }}>
              {/* ═══ 主 CTA（全站唯一 primary · 原则 1.1）═══
                  2026-09-15 V3：本按钮由 inline 硬编码色改为 class + --sb-* token。
                  高度统一 --sb-control-lg(40)（与同一行 6 个配置按钮一致，消除 38/40 混用）；
                  圆角 --sb-radius-control(8)；
                  底色改**品牌紫纯色** --sb-brand（停用紫→粉→橙三色渐变 ——
                  按 V3 规则，渐变只留给「品牌时刻」，功能按钮一律纯色）；
                  hover --sb-brand-hover；active 压深一档；
                  focus 用 --sb-focus-ring；disabled 用 --sb-state-disabled-*。 */}
              <button
                type="button"
                className="ec-workbench-next ec-workbench-cta"
                disabled={!canGen || uploadingAssets}
                title="生成设计方案并进入画布 · 方案分析 1 积分"
                onClick={() => handleNext()}
              >
                {/* 9-12 用户批注：预计积分要放进按钮里（与生视频统一），不再单独挂一个小字条 */}
                {uploadingAssets ? '正在上传原图…' : <>下一步<span className="ec-workbench-cta-points">{planPoints.points} 积分</span></>}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
