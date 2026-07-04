/* ============================================================
   证件照制作网站 - 选区裁剪模块
   左图显示原图+选区覆盖层，右图实时预览裁剪结果
   选区锁定目标宽高比，支持拖拽移动和滚轮缩放
   ============================================================ */

const CropSelector = {
  _sourceCanvas: null,
  _targetRatio: 1,
  _sel: null,
  _displayScale: 1,
  _isDragging: false,
  _dragStart: null,
  _lastCenter: null,
  _pinchStartDist: null,
  _pinchStartHalfW: null,
  _onConfirm: null,

  // DOM 元素（由 open 时传入）
  _container: null,
  _leftCanvas: null,
  _rightCanvas: null,

  /**
   * 打开选区裁剪模态框
   * @param {HTMLCanvasElement} sourceCanvas - 原始图像 Canvas
   * @param {number} targetRatio - 目标宽高比 width/height
   * @param {Function} onConfirm - 确认回调 (croppedCanvas) => void
   */
  open(sourceCanvas, targetRatio, onConfirm) {
    this._sourceCanvas = sourceCanvas;
    this._targetRatio = targetRatio;
    this._onConfirm = onConfirm || (() => {});

    // 初始化选区：取原图居中的最大适配区域
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    const srcRatio = sw / sh;

    let selW, selH;
    if (srcRatio > targetRatio) {
      selH = sh * 0.85;
      selW = selH * targetRatio;
    } else {
      selW = sw * 0.85;
      selH = selW / targetRatio;
    }
    this._sel = {
      cx: sw / 2,
      cy: sh / 2,
      halfW: selW / 2,
      halfH: selH / 2,
    };

    this._isDragging = false;

    // 显示模态框
    const modal = document.getElementById('cropModal');
    modal.classList.add('show');
    this._container = modal;

    this._leftCanvas = document.getElementById('cropLeftCanvas');
    this._rightCanvas = document.getElementById('cropRightCanvas');

    // 计算显示缩放
    const leftBox = this._leftCanvas.parentElement.getBoundingClientRect();
    const pad = 20;
    const availW = leftBox.width - pad * 2;
    const availH = leftBox.height - pad * 2;
    this._displayScale = Math.min(availW / sw, availH / sh, 2);

    this._leftCanvas.width = Math.round(sw * this._displayScale);
    this._leftCanvas.height = Math.round(sh * this._displayScale);

    // 绑定事件
    this._bindEvents();

    // 首次渲染
    this._render();
  },

  close() {
    document.getElementById('cropModal').classList.remove('show');
    this._unbindEvents();
  },

  _bindEvents() {
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this._leftCanvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this._leftCanvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    this._leftCanvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);
  },

  _unbindEvents() {
    if (this._leftCanvas) {
      this._leftCanvas.removeEventListener('mousedown', this._onMouseDown);
      this._leftCanvas.removeEventListener('wheel', this._onWheel);
      this._leftCanvas.removeEventListener('touchstart', this._onTouchStart);
    }
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
  },

  _onMouseDown(e) {
    const pos = this._getCanvasPos(e);
    if (!pos) return;

    const { x, y } = pos;
    const s = this._sel;
    const scale = this._displayScale;

    // 记录偏移，用于拖动
    this._isDragging = true;
    this._dragStart = { x, y };
    this._lastCenter = { cx: s.cx, cy: s.cy };
  },

  _onMouseMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();

    const pos = this._getCanvasPos(e);
    if (!pos) return;

    const dx = (pos.x - this._dragStart.x) / this._displayScale;
    const dy = (pos.y - this._dragStart.y) / this._displayScale;

    const sw = this._sourceCanvas.width;
    const sh = this._sourceCanvas.height;

    this._sel.cx = Math.max(this._sel.halfW, Math.min(sw - this._sel.halfW, this._lastCenter.cx + dx));
    this._sel.cy = Math.max(this._sel.halfH, Math.min(sh - this._sel.halfH, this._lastCenter.cy + dy));

    this._render();
  },

  _onMouseUp() {
    this._isDragging = false;
  },

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const s = this._sel;
    const newHalfW = Math.max(20, Math.min(this._sourceCanvas.width / 2, s.halfW * delta));
    const newHalfH = newHalfW / this._targetRatio;
    s.halfW = newHalfW;
    s.halfH = newHalfH;

    // 确保选区不超出边界
    const sw = this._sourceCanvas.width;
    const sh = this._sourceCanvas.height;
    s.cx = Math.max(s.halfW, Math.min(sw - s.halfW, s.cx));
    s.cy = Math.max(s.halfH, Math.min(sh - s.halfH, s.cy));

    this._render();
  },

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const pos = this._getTouchPos(e.touches[0]);
      if (!pos) return;
      this._isDragging = true;
      this._dragStart = { x: pos.x, y: pos.y };
      this._lastCenter = { cx: this._sel.cx, cy: this._sel.cy };
    } else if (e.touches.length === 2) {
      this._pinchStartDist = this._getTouchDist(e.touches);
      this._pinchStartHalfW = this._sel.halfW;
    }
  },

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this._isDragging) {
      const pos = this._getTouchPos(e.touches[0]);
      if (!pos) return;
      const dx = (pos.x - this._dragStart.x) / this._displayScale;
      const dy = (pos.y - this._dragStart.y) / this._displayScale;
      const sw = this._sourceCanvas.width;
      const sh = this._sourceCanvas.height;
      this._sel.cx = Math.max(this._sel.halfW, Math.min(sw - this._sel.halfW, this._lastCenter.cx + dx));
      this._sel.cy = Math.max(this._sel.halfH, Math.min(sh - this._sel.halfH, this._lastCenter.cy + dy));
      this._render();
    } else if (e.touches.length === 2 && this._pinchStartDist) {
      const curDist = this._getTouchDist(e.touches);
      const ratio = curDist / this._pinchStartDist;
      const s = this._sel;
      const newHalfW = Math.max(20, Math.min(this._sourceCanvas.width / 2, this._pinchStartHalfW * ratio));
      const newHalfH = newHalfW / this._targetRatio;
      s.halfW = newHalfW;
      s.halfH = newHalfH;
      const sw = this._sourceCanvas.width;
      const sh = this._sourceCanvas.height;
      s.cx = Math.max(s.halfW, Math.min(sw - s.halfW, s.cx));
      s.cy = Math.max(s.halfH, Math.min(sh - s.halfH, s.cy));
      this._render();
    }
  },

  _onTouchEnd() {
    this._isDragging = false;
    this._pinchStartDist = null;
  },

  _getTouchPos(touch) {
    const rect = this._leftCanvas.getBoundingClientRect();
    const cssX = touch.clientX - rect.left;
    const cssY = touch.clientY - rect.top;
    if (cssX < 0 || cssX > rect.width || cssY < 0 || cssY > rect.height) return null;
    return {
      x: cssX * (this._leftCanvas.width / rect.width),
      y: cssY * (this._leftCanvas.height / rect.height),
    };
  },

  _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  _onKeyDown(e) {
    if (e.key === 'Enter') this._confirm();
    if (e.key === 'Escape') this.close();
  },

  _zoom(factor) {
    const s = this._sel;
    const newHalfW = Math.max(20, Math.min(this._sourceCanvas.width / 2, s.halfW * factor));
    s.halfW = newHalfW;
    s.halfH = newHalfW / this._targetRatio;
    const sw = this._sourceCanvas.width;
    const sh = this._sourceCanvas.height;
    s.cx = Math.max(s.halfW, Math.min(sw - s.halfW, s.cx));
    s.cy = Math.max(s.halfH, Math.min(sh - s.halfH, s.cy));
    this._render();
  },

  _getCanvasPos(e) {
    const rect = this._leftCanvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    if (cssX < 0 || cssX > rect.width || cssY < 0 || cssY > rect.height) return null;
    // 将 CSS 坐标映射到 Canvas 属性坐标（处理 CSS 缩放）
    const x = cssX * (this._leftCanvas.width / rect.width);
    const y = cssY * (this._leftCanvas.height / rect.height);
    return { x, y };
  },

  _render() {
    this._renderLeft();
    this._renderRight();
    this._updateInfo();
  },

  _renderLeft() {
    const canvas = this._leftCanvas;
    const ctx = canvas.getContext('2d');
    const sw = this._sourceCanvas.width;
    const sh = this._sourceCanvas.height;
    const scale = this._displayScale;
    const s = this._sel;

    // 绘制原图
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this._sourceCanvas, 0, 0, canvas.width, canvas.height);

    // 半透明遮罩（覆盖选区之外）
    const lx = (s.cx - s.halfW) * scale;
    const ly = (s.cy - s.halfH) * scale;
    const lw = s.halfW * 2 * scale;
    const lh = s.halfH * 2 * scale;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    // 上
    ctx.fillRect(0, 0, canvas.width, ly);
    // 下
    ctx.fillRect(0, ly + lh, canvas.width, canvas.height - ly - lh);
    // 左
    ctx.fillRect(0, ly, lx, lh);
    // 右
    ctx.fillRect(lx + lw, ly, canvas.width - lx - lw, lh);

    // 选区边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(lx, ly, lw, lh);

    // 角落标记
    const dotSize = 8;
    ctx.fillStyle = '#2563eb';
    const corners = [
      [lx, ly], [lx + lw, ly],
      [lx, ly + lh], [lx + lw, ly + lh]
    ];
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 提示文字
    const isTouch = 'ontouchstart' in window;
    const hint = isTouch ? '单指拖动 · 双指缩放 · 确认按钮完成' : '拖拽移动 · 滚轮缩放 · Enter确认';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hint, canvas.width / 2, canvas.height - 12);
  },

  _renderRight() {
    const canvas = this._rightCanvas;
    const ctx = canvas.getContext('2d');
    const s = this._sel;
    const sw = s.halfW * 2;
    const sh = s.halfH * 2;

    // 用目标尺寸比例显示预览
    const targetW = Math.round(this._targetRatio * 300);
    const targetH = 300;
    canvas.width = targetW;
    canvas.height = targetH;

    const srcX = s.cx - s.halfW;
    const srcY = s.cy - s.halfH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this._sourceCanvas, srcX, srcY, sw, sh, 0, 0, targetW, targetH);

    // 网格参考线
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(targetW / 3 * i, 0);
      ctx.lineTo(targetW / 3 * i, targetH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, targetH / 3 * i);
      ctx.lineTo(targetW, targetH / 3 * i);
      ctx.stroke();
    }
  },

  _updateInfo() {
    const s = this._sel;
    const areaW = Math.round(s.halfW * 2);
    const areaH = Math.round(s.halfH * 2);
    document.getElementById('cropInfo').textContent = `选区: ${areaW}×${areaH}px  |  比例: ${this._targetRatio.toFixed(3)}`;
  },

  _confirm() {
    const s = this._sel;
    const srcX = Math.round(s.cx - s.halfW);
    const srcY = Math.round(s.cy - s.halfH);
    const srcW = Math.round(s.halfW * 2);
    const srcH = Math.round(s.halfH * 2);

    const out = document.createElement('canvas');
    out.width = srcW;
    out.height = srcH;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this._sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    this._onConfirm(out);
    this.close();
  },
};

// 绑定模态框按钮
document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('cropConfirmBtn');
  const cancelBtn = document.getElementById('cropCancelBtn');
  const zoomIn = document.getElementById('cropZoomIn');
  const zoomOut = document.getElementById('cropZoomOut');
  if (confirmBtn) confirmBtn.addEventListener('click', () => CropSelector._confirm());
  if (cancelBtn) cancelBtn.addEventListener('click', () => CropSelector.close());
  if (zoomIn) zoomIn.addEventListener('click', () => CropSelector._zoom(1.15));
  if (zoomOut) zoomOut.addEventListener('click', () => CropSelector._zoom(0.87));
});