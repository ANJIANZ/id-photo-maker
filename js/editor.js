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
  const manualSection = document.getElementById('manualCutoutSection');
  const pickColorBtn = document.getElementById('pickColorBtn');
  const manualCutoutBtn = document.getElementById('manualCutoutBtn');

  // ===== 状态 =====
  const state = {
    originalImage: null,
    cutoutImage: null,
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
    hasCutout: false,
    pickingColor: false,
    pickedColor: { r: 200, g: 200, b: 200 },
    tolerance: 60,
    smoothness: 2,
  };

  // ===== 初始化 =====
  function init() {
    renderBgColors();
    renderSizes();
    bindControls();
    bindManualCutout();

    const dataURL = Utils.Storage.get('originalImage');
    if (dataURL) {
      const img = new Image();
      img.onload = () => {
        state.originalImage = Utils.imageToCanvas(img, 1600);
        cutoutBtn.disabled = false;
        render();
      };
      img.src = dataURL;
    } else {
      showEmpty();
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

  // ===== 渲染背景色选项 =====
  function renderBgColors() {
    const container = document.getElementById('bgColorOptions');
    container.innerHTML = '';
    BG_COLORS.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'color-option' + (i === 0 ? ' active' : '');
      div.style.background = c.color;
      div.title = c.name;
      div.innerHTML = '<span class="check">✓</span>';
      div.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        state.bgColor = c.color;
        state.bgName = c.name;
        document.getElementById('infoBg').textContent = c.name;
        if (!state.hasCutout && state.originalImage) {
          autoCutoutByBgColor();
        } else {
          render();
        }
      });
      container.appendChild(div);
    });
  }

  document.getElementById('customColor').addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    state.bgName = '自定义';
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
    document.getElementById('infoBg').textContent = '自定义';
    if (!state.hasCutout && state.originalImage) {
      autoCutoutByBgColor();
    } else {
      render();
    }
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

  // ===== 绑定控件 =====
  function bindControls() {
    const sliders = [
      { id: 'brightness', valId: 'brightnessVal', key: 'brightness', fmt: v => v },
      { id: 'contrast', valId: 'contrastVal', key: 'contrast', fmt: v => v },
      { id: 'saturate', valId: 'saturateVal', key: 'saturate', fmt: v => v },
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
    downloadBtn.addEventListener('click', downloadPhoto);
    toPrintBtn.addEventListener('click', goToPrint);
    reuploadBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // ===== 手动抠图绑定 =====
  function bindManualCutout() {
    pickColorBtn.addEventListener('click', () => {
      state.pickingColor = !state.pickingColor;
      pickColorBtn.style.borderColor = state.pickingColor ? '#dc2626' : 'var(--danger)';
      pickColorBtn.textContent = state.pickingColor ? '🔄 点击预览图取色...' : '🎯 吸取背景色';
      previewCanvas.style.cursor = state.pickingColor ? 'crosshair' : 'default';
    });

    document.getElementById('tolerance').addEventListener('input', (e) => {
      state.tolerance = parseInt(e.target.value);
      document.getElementById('toleranceVal').textContent = state.tolerance;
    });

    document.getElementById('smoothness').addEventListener('input', (e) => {
      state.smoothness = parseInt(e.target.value);
      document.getElementById('smoothnessVal').textContent = state.smoothness;
    });

    manualCutoutBtn.addEventListener('click', doManualCutout);

    // 点击/触摸预览图取色（移动端支持）
    function handleCanvasPick(e) {
      if (!state.pickingColor || !state.originalImage) return;
      e.preventDefault();
      const rect = previewCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = previewCanvas.width / rect.width;
      const scaleY = previewCanvas.height / rect.height;
      const x = Math.round((clientX - rect.left) * scaleX);
      const y = Math.round((clientY - rect.top) * scaleY);
      if (x < 0 || x >= previewCanvas.width || y < 0 || y >= previewCanvas.height) return;

      const color = Utils.pickColor(previewCanvas, x, y);
      state.pickedColor = color;
      document.getElementById('pickedColorDisplay').style.background = `rgb(${color.r},${color.g},${color.b})`;

      state.pickingColor = false;
      pickColorBtn.textContent = '🎯 吸取背景色';
      pickColorBtn.style.borderColor = 'var(--danger)';
      previewCanvas.style.cursor = 'default';
    }
    previewCanvas.addEventListener('click', handleCanvasPick);
    previewCanvas.addEventListener('touchend', handleCanvasPick);
  }

  // ===== 自动背景抠图（基于图像边缘采样） =====
  function autoCutoutByBgColor() {
    const canvas = state.originalImage;
    const w = canvas.width, h = canvas.height;

    // 从四角和边缘采样，找到最可能的主背景色
    const samples = [];
    const step = 10;
    // 四角
    const corners = [
      { x: 5, y: 5 }, { x: w - 5, y: 5 },
      { x: 5, y: h - 5 }, { x: w - 5, y: h - 5 },
    ];
    corners.forEach(p => samples.push(Utils.pickColor(canvas, p.x, p.y)));
    // 顶部边缘
    for (let x = 0; x < w; x += step) samples.push(Utils.pickColor(canvas, x, 3));
    // 底部边缘
    for (let x = 0; x < w; x += step) samples.push(Utils.pickColor(canvas, x, h - 3));
    // 左侧边缘
    for (let y = 0; y < h; y += step) samples.push(Utils.pickColor(canvas, 3, y));
    // 右侧边缘
    for (let y = 0; y < h; y += step) samples.push(Utils.pickColor(canvas, w - 3, y));

    // 统计最频繁的颜色
    const colorCounts = {};
    samples.forEach(c => {
      const key = `${Math.round(c.r / 20) * 20},${Math.round(c.g / 20) * 20},${Math.round(c.b / 20) * 20}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    });
    const dominantKey = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0];
    const [dr, dg, db] = dominantKey.split(',').map(Number);

    try {
      const result = Utils.removeColorBackground(canvas, { r: dr, g: dg, b: db }, 50, 3);
      state.cutoutImage = result;
      state.hasCutout = true;
      document.getElementById('infoCutout').textContent = '已自动抠图';
      document.querySelector('.color-option:first-child')?.classList.remove('active');
    } catch (e) {
      console.warn('自动抠图失败', e);
    }
    render();
  }

  // ===== AI 抠图 =====
  async function doCutout() {
    if (!state.originalImage) return;
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = '正在连接 CDN 加载抠图模型...';
    progressFill.style.width = '0%';

    try {
      const result = await BackgroundRemover.remove(state.originalImage, (progress) => {
        if (progress < 0.5) {
          loadingText.textContent = '正在下载 AI 模型文件（约 40MB）...';
        } else {
          loadingText.textContent = '正在处理抠图...';
        }
        progressFill.style.width = Math.round(progress * 100) + '%';
      });
      state.cutoutImage = result;
      state.hasCutout = true;
      document.getElementById('infoCutout').textContent = '已抠图';
      render();
    } catch (err) {
      console.error('AI 抠图失败:', err);
      manualSection.style.display = 'block';
      if (err.message.includes('CDN') || err.message.includes('加载') || err.message.includes('网络')) {
        alert('AI 抠图模型加载失败。已显示"手动抠图"备选方案。\n\n请点击"吸取背景色"按钮，然后在预览图中点击背景区域，再点击"执行手动抠图"。\n\n可能原因：网络环境限制，请尝试使用 VPN 或切换网络。\n\n错误：' + err.message);
      } else {
        alert('AI 抠图失败，已启用手动抠图备选方案。\n\n错误：' + err.message);
      }
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  // ===== 手动抠图（基于颜色） =====
  function doManualCutout() {
    if (!state.originalImage) return;
    try {
      const color = state.pickedColor;
      const result = Utils.removeColorBackground(
        state.originalImage,
        color,
        state.tolerance,
        state.smoothness
      );
      state.cutoutImage = result;
      state.hasCutout = true;
      document.getElementById('infoCutout').textContent = '已抠图（手动）';
      render();
    } catch (err) {
      alert('手动抠图失败：' + err.message);
    }
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
    if (state.brightness !== 0 || state.contrast !== 0 || state.saturate !== 0) {
      source = Utils.applyFilters(source, {
        brightness: state.brightness,
        contrast: state.contrast,
        saturate: state.saturate,
      });
    }

    previewCanvas.width = pxW;
    previewCanvas.height = pxH;

    // 始终用选中背景色填充
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, pxW, pxH);

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