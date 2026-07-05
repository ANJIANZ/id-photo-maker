/* ============================================================
   证件照制作网站 - 编辑器核心逻辑
   ============================================================ */

(function () {
  // ===== DOM 引用 =====
  const previewCanvas = document.getElementById('previewCanvas');
  const ctx = previewCanvas.getContext('2d');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const progressFill = document.getElementById('progressFill');
  const cutoutBtn = document.getElementById('cutoutBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const toPrintBtn = document.getElementById('toPrintBtn');
  const reuploadBtn = document.getElementById('reuploadBtn');
  const smartCropBtn = document.getElementById('smartCropBtn');
  const cropSelectBtn2 = document.getElementById('cropSelectBtn2');
  const resetOriginalBtn = document.getElementById('resetOriginalBtn');

  // ===== 状态 =====
  const state = {
    originalImage: null,
    cutoutImage: null,
    bgColor: '#FFFFFF',
    bgName: '白色',
    bgApplied: false,
    sizeId: 'one',
    rotation: 0,
    flipH: false,
    brightness: 0,
    contrast: 0,
    saturate: 0,
    offsetX: 0.5,
    offsetY: 0.4,
    scale: 1.0,
    feather: 3,
    smooth: 0,
    whiten: 0,
    sharpen: 0,
    hasCutout: false,
  };

  // 移动端面板折叠：点击标题切换展开/折叠，初始折叠编辑面板
  function enableMobileCollapse() {
    const isMobile = window.innerWidth <= 900;
    document.querySelectorAll('.panel h3').forEach(h3 => {
      const panel = h3.closest('.panel');
      if (!panel) return;
      // 初始状态：移动端编辑面板折叠，信息面板展开
      if (isMobile && panel.id === 'leftPanel') panel.classList.add('collapsed');
      h3.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
      });
    });
  }

  // ===== 初始化 =====
  function init() {
    enableMobileCollapse();
    renderBgColors();
    renderSizes();
    bindControls();

    // 检查是否从首页"试用示例照片"跳转过来
    const urlParams = new URLSearchParams(window.location.search);
    const isDemo = urlParams.get('demo') === '1';

    const dataURL = Utils.Storage.get('originalImage');
    if (dataURL) {
      // 有上传的照片
      const img = new Image();
      img.onload = () => {
        state.originalImage = Utils.imageToCanvas(img, 1600);
        cutoutBtn.disabled = false;
        render();
      };
      img.src = dataURL;
    } else if (isDemo) {
      // 来自首页"试用示例照片"按钮 - 使用内嵌 base64（兼容所有协议）
      useEmbeddedDemoImage();
    } else {
      // 没有上传照片时，自动加载默认示例照片
      loadDemoImage();
    }
  }

  function showEmpty() {
    const wrapper = document.getElementById('canvasWrapper');
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🖼️</div>
        <p>还没有上传照片</p>
        <p style="margin-top:8px;"><a href="index.html">去上传照片 →</a></p>
      </div>
    `;
  }

  function loadDemoImage() {
    const img = new Image();
    img.onload = () => {
      state.originalImage = Utils.imageToCanvas(img, 1600);
      state.bgApplied = true;
      cutoutBtn.disabled = false;
      render();
    };
    img.onerror = () => {
      showEmpty();
    };
    img.src = 'people_demo.png';
  }

  // 使用内嵌 base64 数据加载示例照片（兼容 file:// 协议，无 Canvas 污染问题）
  function useEmbeddedDemoImage() {
    if (typeof DEMO_IMAGE_DATA_URL === 'undefined') {
      showEmpty();
      return;
    }
    const img = new Image();
    img.onload = () => {
      state.originalImage = Utils.imageToCanvas(img, 1600);
      state.bgApplied = true;
      cutoutBtn.disabled = false;
      render();
    };
    img.onerror = () => {
      showEmpty();
    };
    img.src = DEMO_IMAGE_DATA_URL;
  }

  // ===== 提示弹窗 =====
  function showToast(msg, duration) {
    duration = duration || 3000;
    let el = document.getElementById('toastMsg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastMsg';
      el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:8px;font-size:15px;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, duration);
  }

  // ===== 渲染背景色选项 =====
  function renderBgColors() {
    const container = document.getElementById('bgColorOptions');
    container.innerHTML = '';
    BG_COLORS.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'color-option';
      div.style.background = c.color;
      div.title = c.name;
      div.innerHTML = '<span class="check">✓</span>';
      div.addEventListener('click', () => {
        if (!state.hasCutout) {
          showToast('请先使用 AI 抠图，再更换背景颜色');
          return;
        }
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        state.bgColor = c.color;
        state.bgName = c.name;
        state.bgApplied = true;
        document.getElementById('infoBg').textContent = c.name;
        render();
      });
      container.appendChild(div);
    });
  }

  document.getElementById('customColor').addEventListener('input', (e) => {
    if (!state.hasCutout) {
      showToast('请先使用 AI 抠图，再更换背景颜色');
      return;
    }
    state.bgColor = e.target.value;
    state.bgName = '自定义';
    state.bgApplied = true;
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
    document.getElementById('infoBg').textContent = '自定义';
    render();
  });

  // ===== 渲染尺寸选项 =====
  function renderSizes() {
    const container = document.getElementById('sizeOptions');
    container.innerHTML = '';
    ID_SIZES.forEach(s => {
      const div = document.createElement('div');
      div.className = 'size-option' + (s.id === state.sizeId ? ' active' : '');
      div.innerHTML = `
        <span>${s.name}</span>
        <span class="dim">${s.width}×${s.height}mm</span>
      `;
      div.addEventListener('click', () => {
        document.querySelectorAll('.size-option').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        state.sizeId = s.id;
        updateInfo();
        render();
      });
      container.appendChild(div);
    });
  }

  // ===== 更新信息面板 =====
  function updateInfo() {
    const s = getSizeById(state.sizeId);
    const pxW = mmToPixel(s.width);
    const pxH = mmToPixel(s.height);
    document.getElementById('infoSize').textContent = s.name;
    document.getElementById('infoDim').textContent = `${s.width}×${s.height}mm`;
    document.getElementById('infoPx').textContent = `${pxW}×${pxH}px`;
  }

  const DEFAULTS = {
    bgColor: '#FFFFFF',
    bgName: '白色',
    sizeId: 'one',
    rotation: 0,
    flipH: false,
    brightness: 0,
    contrast: 0,
    saturate: 0,
    offsetX: 0.5,
    offsetY: 0.4,
    scale: 1.0,
    feather: 3,
    smooth: 0,
    whiten: 0,
    sharpen: 0,
    hasCutout: false,
  };

  function resetToOriginal() {
    if (!state.originalImage) return;

    state.cutoutImage = null;
    Object.assign(state, DEFAULTS);
    state.bgApplied = false;
    state.finalCanvas = null;

    updateInfo();
    renderBgColors();
    renderSizes();

    document.getElementById('brightness').value = 0;
    document.getElementById('brightnessVal').textContent = '0';
    document.getElementById('contrast').value = 0;
    document.getElementById('contrastVal').textContent = '0';
    document.getElementById('saturate').value = 0;
    document.getElementById('saturateVal').textContent = '0';
    document.getElementById('feather').value = 3;
    document.getElementById('featherVal').textContent = '3';
    document.getElementById('smooth').value = 0;
    document.getElementById('smoothVal').textContent = '0';
    document.getElementById('whiten').value = 0;
    document.getElementById('whitenVal').textContent = '0';
    document.getElementById('sharpen').value = 0;
    document.getElementById('sharpenVal').textContent = '0';
    document.getElementById('offsetX').value = 50;
    document.getElementById('offsetXVal').textContent = '50%';
    document.getElementById('offsetY').value = 40;
    document.getElementById('offsetYVal').textContent = '40%';
    document.getElementById('scale').value = 100;
    document.getElementById('scaleVal').textContent = '100%';

    document.getElementById('infoCutout').textContent = '未抠图';

    render();
  }

  // ===== 绑定控件 =====
  function bindControls() {
    const sliders = [
      { id: 'brightness', valId: 'brightnessVal', key: 'brightness', fmt: v => v },
      { id: 'contrast', valId: 'contrastVal', key: 'contrast', fmt: v => v },
      { id: 'saturate', valId: 'saturateVal', key: 'saturate', fmt: v => v },
      { id: 'feather', valId: 'featherVal', key: 'feather', fmt: v => v },
      { id: 'smooth', valId: 'smoothVal', key: 'smooth', fmt: v => v },
      { id: 'whiten', valId: 'whitenVal', key: 'whiten', fmt: v => v },
      { id: 'sharpen', valId: 'sharpenVal', key: 'sharpen', fmt: v => v },
      { id: 'offsetX', valId: 'offsetXVal', key: 'offsetX', fmt: v => v + '%', map: v => v / 100 },
      { id: 'offsetY', valId: 'offsetYVal', key: 'offsetY', fmt: v => v + '%', map: v => v / 100 },
      { id: 'scale', valId: 'scaleVal', key: 'scale', fmt: v => v + '%', map: v => v / 100 },
    ];

    sliders.forEach(s => {
      const el = document.getElementById(s.id);
      const valEl = document.getElementById(s.valId);
      el.addEventListener('input', Utils.debounce(() => {
        const raw = parseInt(el.value);
        valEl.textContent = s.fmt(raw);
        state[s.key] = s.map ? s.map(raw) : raw;
        render();
      }, 100));
    });

    document.getElementById('rotateLeftBtn').addEventListener('click', () => {
      state.rotation = (state.rotation - 90 + 360) % 360;
      render();
    });
    document.getElementById('rotateRightBtn').addEventListener('click', () => {
      state.rotation = (state.rotation + 90) % 360;
      render();
    });
    document.getElementById('flipHBtn').addEventListener('click', () => {
      state.flipH = !state.flipH;
      render();
    });

    cutoutBtn.addEventListener('click', doCutout);
    smartCropBtn.addEventListener('click', doSmartCrop);
    if (cropSelectBtn2) cropSelectBtn2.addEventListener('click', doCropSelect);
    downloadBtn.addEventListener('click', downloadPhoto);
    toPrintBtn.addEventListener('click', goToPrint);
    reuploadBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    if (resetOriginalBtn) {
      resetOriginalBtn.addEventListener('click', () => {
        resetToOriginal();
      });
    }
  }

  // ===== AI 抠图（仅百度AI） =====
  async function doCutout() {
    if (!state.originalImage) return;
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = '正在使用百度AI抠图...';
    progressFill.style.width = '30%';

    try {
      const dataURL = state.originalImage.toDataURL('image/png');

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 30000);
      const resp = await fetch('/api/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataURL }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      const apiResult = await resp.json();
      if (resp.ok && apiResult.data) {
        const resultCanvas = await blobFromBase64(apiResult.data);
        state.cutoutImage = resultCanvas;
        state.hasCutout = true;
        document.getElementById('infoCutout').textContent = '已抠图（百度AI）';
        loadingOverlay.style.display = 'none';
        doAutoFit();
        return;
      }
      throw new Error(apiResult.error || '返回数据异常');
    } catch (err) {
      const msg = err.name === 'AbortError' ? '请求超时' : err.message;
      loadingOverlay.style.display = 'none';
      alert('百度AI抠图失败：' + msg + '\n\n请确保服务器已启动（node server.js）');
    }
  }

  // 将 base64 字符串转为 canvas
  async function blobFromBase64(base64Str) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('base64 图片加载失败'));
      img.src = 'data:image/png;base64,' + base64Str;
    });
  }

  // ===== 智能裁剪——以原图中心为优先，裁剪到目标尺寸比例 =====
  function doSmartCrop() {
    if (!state.originalImage) return;
    const size = getSizeById(state.sizeId);
    const targetRatio = size.width / size.height;

    // 裁剪原图
    state.originalImage = Utils.smartCropToRatio(state.originalImage, targetRatio);
    // 如果已抠图，同步裁剪抠图结果
    if (state.cutoutImage) {
      state.cutoutImage = Utils.smartCropToRatio(state.cutoutImage, targetRatio);
    }
    // 重置偏移和缩放
    state.offsetX = 0.5;
    state.offsetY = 0.4;
    state.scale = 1.0;
    document.getElementById('offsetX').value = 50;
    document.getElementById('offsetXVal').textContent = '50%';
    document.getElementById('offsetY').value = 40;
    document.getElementById('offsetYVal').textContent = '40%';
    document.getElementById('scale').value = 100;
    document.getElementById('scaleVal').textContent = '100%';

    render();
  }

  // ===== 选区裁剪——手动拖拽选区的交互式裁剪 =====
  function doCropSelect() {
    if (!state.originalImage) return;
    const size = getSizeById(state.sizeId);
    const targetRatio = size.width / size.height;

    CropSelector.open(state.originalImage, targetRatio, (croppedCanvas, cropRect) => {
      state.originalImage = croppedCanvas;
      if (state.cutoutImage) {
        const c = document.createElement('canvas');
        c.width = cropRect.w;
        c.height = cropRect.h;
        c.getContext('2d').drawImage(state.cutoutImage, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);
        state.cutoutImage = c;
      }
      state.offsetX = 0.5;
      state.offsetY = 0.4;
      state.scale = 1.0;
      document.getElementById('offsetX').value = 50;
      document.getElementById('offsetXVal').textContent = '50%';
      document.getElementById('offsetY').value = 40;
      document.getElementById('offsetYVal').textContent = '40%';
      document.getElementById('scale').value = 100;
      document.getElementById('scaleVal').textContent = '100%';
      render();
    });
  }

  // ===== 自动适配——检测人物位置，按证件照标准比例调整缩放和偏移 =====
  function doAutoFit() {
    if (!state.cutoutImage) return;
    const size = getSizeById(state.sizeId);
    const pxW = mmToPixel(size.width);
    const pxH = mmToPixel(size.height);

    const box = Utils.detectPersonBox(state.cutoutImage);
    if (!box) {
      render();
      return;
    }

    const fit = Utils.calcAutoFit(box, pxW, pxH);
    state.scale = fit.scale;
    state.offsetX = fit.offsetX;
    state.offsetY = fit.offsetY;

    // 更新滑块显示
    document.getElementById('scale').value = Math.round(fit.scale * 100);
    document.getElementById('scaleVal').textContent = Math.round(fit.scale * 100) + '%';
    document.getElementById('offsetX').value = 50;
    document.getElementById('offsetXVal').textContent = '50%';
    document.getElementById('offsetY').value = Math.round(fit.offsetY * 100);
    document.getElementById('offsetYVal').textContent = Math.round(fit.offsetY * 100) + '%';

    render();
  }

  // ===== 渲染预览 =====
  function render() {
    if (!state.originalImage) return;

    const size = getSizeById(state.sizeId);
    const pxW = mmToPixel(size.width);
    const pxH = mmToPixel(size.height);

    let source = state.hasCutout ? state.cutoutImage : state.originalImage;

    if (state.rotation !== 0) {
      source = Utils.rotateCanvas(source, state.rotation);
    }
    if (state.flipH) {
      source = Utils.flipCanvasHorizontal(source);
    }
    if (state.smooth > 0 || state.whiten > 0 || state.sharpen > 0) {
      const bCtx = document.createElement('canvas').getContext('2d');
      bCtx.canvas.width = source.width;
      bCtx.canvas.height = source.height;
      let origAlpha = null;
      if (state.hasCutout) {
        const od = source.getContext('2d').getImageData(0, 0, source.width, source.height);
        origAlpha = new Uint8ClampedArray(source.width * source.height);
        for (let i = 0; i < origAlpha.length; i++) origAlpha[i] = od.data[i * 4 + 3];
        bCtx.fillStyle = '#FFFFFF';
        bCtx.fillRect(0, 0, source.width, source.height);
      }
      bCtx.drawImage(source, 0, 0);
      const imageData = bCtx.getImageData(0, 0, source.width, source.height);
      if (state.smooth > 0) Utils.skinSmooth(imageData, state.smooth);
      if (state.whiten > 0) Utils.skinWhiten(imageData, state.whiten);
      if (state.sharpen > 0) Utils.sharpen(imageData, state.sharpen);
      if (origAlpha) {
        for (let i = 0; i < origAlpha.length; i++) imageData.data[i * 4 + 3] = origAlpha[i];
      }
      bCtx.putImageData(imageData, 0, 0);
      source = bCtx.canvas;
    }
    if (state.brightness !== 0 || state.contrast !== 0 || state.saturate !== 0) {
      source = Utils.applyFilters(source, {
        brightness: state.brightness,
        contrast: state.contrast,
        saturate: state.saturate,
      });
    }

    if (state.hasCutout && state.feather > 0) {
      source = Utils.refineAlphaEdge(source, state.feather);
    }

    previewCanvas.width = pxW;
    previewCanvas.height = pxH;

    if (state.bgApplied) {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, pxW, pxH);
    } else {
      ctx.clearRect(0, 0, pxW, pxH);
    }

    const srcW = source.width;
    const srcH = source.height;
    const srcRatio = srcW / srcH;
    const tgtRatio = pxW / pxH;

    let drawW, drawH;
    if (srcRatio > tgtRatio) {
      drawH = pxH * state.scale;
      drawW = drawH * srcRatio;
    } else {
      drawW = pxW * state.scale;
      drawH = drawW / srcRatio;
    }
    const drawX = (pxW - drawW) * state.offsetX;
    const drawY = (pxH - drawH) * state.offsetY;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, drawX, drawY, drawW, drawH);

    state.finalCanvas = previewCanvas;
  }

  // ===== 下载 =====
  function downloadPhoto() {
    if (!state.finalCanvas) {
      alert('请先上传照片');
      return;
    }
    const size = getSizeById(state.sizeId);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = previewCanvas.width;
    exportCanvas.height = previewCanvas.height;
    exportCanvas.getContext('2d').drawImage(previewCanvas, 0, 0);

    const dataURL = exportCanvas.toDataURL('image/jpeg', 0.95);
    const filename = `证件照_${size.name}_${state.bgName}.jpg`;
    Utils.downloadDataURL(dataURL, filename);

    Utils.Storage.set('finalPhoto', exportCanvas.toDataURL('image/png'));
  }

  // ===== 跳转排版页 =====
  function goToPrint() {
    if (!state.finalCanvas) {
      alert('请先上传照片');
      return;
    }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = previewCanvas.width;
    exportCanvas.height = previewCanvas.height;
    exportCanvas.getContext('2d').drawImage(previewCanvas, 0, 0);
    Utils.Storage.set('finalPhoto', exportCanvas.toDataURL('image/png'));
    Utils.Storage.set('printSizeId', state.sizeId);
    window.location.href = 'print.html';
  }

  init();
})();
