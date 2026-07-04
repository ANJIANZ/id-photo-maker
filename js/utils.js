/* ============================================================
   证件照制作网站 - 工具函数模块
   ============================================================ */

/**
 * 加载图片文件为 Image 对象
 */
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 将 Image 绘制到 Canvas
 */
function imageToCanvas(img, maxWidth = 0) {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (maxWidth > 0 && w > maxWidth) {
    h = Math.round(h * maxWidth / w);
    w = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Canvas 转 dataURL
 */
function canvasToDataURL(canvas, type = 'image/png', quality = 0.92) {
  return canvas.toDataURL(type, quality);
}

/**
 * 下载 dataURL
 */
function downloadDataURL(dataURL, filename) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * hex 颜色转 rgb 对象
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * 在 Canvas 上填充纯色背景（在已有图像下方）
 * 用于将抠图后的透明 PNG 合成到纯色背景上
 */
function compositeOnBackground(foregroundCanvas, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = foregroundCanvas.width;
  canvas.height = foregroundCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(foregroundCanvas, 0, 0);
  return canvas;
}

/**
 * 将图像缩放到目标宽高并居中绘制（cover 模式）
 */
function cropToSize(sourceCanvas, targetW, targetH, offsetX = 0.5, offsetY = 0.4) {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcRatio = srcW / srcH;
  const tgtRatio = targetW / targetH;

  let drawW, drawH, drawX, drawY;
  if (srcRatio > tgtRatio) {
    // 源图更宽，按高度铺满，宽度裁切
    drawH = targetH;
    drawW = Math.round(targetH * srcRatio);
  } else {
    drawW = targetW;
    drawH = Math.round(targetW / srcRatio);
  }
  drawX = Math.round((targetW - drawW) * offsetX);
  drawY = Math.round((targetH - drawH) * offsetY);

  ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);
  return canvas;
}

/**
 * 应用亮度/对比度/饱和度滤镜到 Canvas
 */
function applyFilters(canvas, { brightness = 0, contrast = 0, saturate = 0 } = {}) {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  const ctx = newCanvas.getContext('2d');
  const b = 100 + brightness;
  const c = 100 + contrast;
  const s = 100 + saturate;
  ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  ctx.drawImage(canvas, 0, 0);
  return newCanvas;
}

/**
 * 旋转 Canvas（90度倍数）
 */
function rotateCanvas(canvas, deg) {
  const times = ((deg % 360) + 360) % 360 / 90;
  let src = canvas;
  for (let i = 0; i < times; i++) {
    const c = document.createElement('canvas');
    c.width = src.height;
    c.height = src.width;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, 0, 0);
    src = c;
  }
  return src;
}

/**
 * 水平翻转 Canvas
 */
function flipCanvasHorizontal(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

/**
 * 基于颜色的背景移除（手动拾色抠图）
 * 移除与指定颜色相近的像素，生成透明背景
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{r:number,g:number,b:number}} targetColor - 要移除的颜色
 * @param {number} tolerance - 容差 0-255
 * @param {number} smoothness - 边缘羽化 0-5
 * @returns {HTMLCanvasElement}
 */
function removeColorBackground(sourceCanvas, targetColor, tolerance = 60, smoothness = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const { r: tr, g: tg, b: tb } = targetColor;

  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];

    const dist = Math.sqrt(
      (pr - tr) ** 2 + (pg - tg) ** 2 + (pb - tb) ** 2
    );

    let alpha = 255;
    if (dist <= tolerance) {
      // 在容差范围内：完全透明
      alpha = 0;
    } else if (smoothness > 0 && dist <= tolerance + smoothness * 10) {
      // 边缘区域：渐变透明
      const edgeDist = dist - tolerance;
      const edgeWidth = smoothness * 10;
      alpha = Math.round(255 * (edgeDist / edgeWidth));
    }

    data[i + 3] = alpha;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * 从 Canvas 上指定位置吸取颜色
 */
function pickColor(canvas, x, y) {
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return { r: pixel[0], g: pixel[1], b: pixel[2] };
}

/**
 * 边缘羽化后处理——改善 AI 抠图头发细节的锯齿状边缘
 * 通过对 alpha 通道做模糊+对比度调整，使边缘更平滑自然
 * @param {HTMLCanvasElement} canvas - 透明背景的抠图结果
 * @param {number} feather - 羽化程度 0-10 (0=不处理)
 * @returns {HTMLCanvasElement}
 */
function refineAlphaEdge(canvas, feather = 3) {
  if (feather <= 0) return canvas;

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  const w = out.width, h = out.height;

  // 提取 alpha 通道到独立数组
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  // 多次 box blur 模拟高斯模糊
  const radius = Math.round(feather);
  const blurred = boxBlurAlpha(alpha, w, h, radius);

  // 应用对比度曲线：保持核心区域不透明，边缘平滑过渡
  // 使用 smoothstep 函数让过渡更自然
  const threshold = 0.15; // 低于15%透明度的区域视为背景
  const smoothWidth = 0.3; // 过渡区宽度
  for (let i = 0; i < w * h; i++) {
    const a = blurred[i] / 255;
    let newA;
    if (a <= threshold) {
      newA = 0;
    } else if (a >= threshold + smoothWidth) {
      newA = 255;
    } else {
      // smoothstep: 3t^2 - 2t^3
      const t = (a - threshold) / smoothWidth;
      newA = Math.round(255 * (t * t * (3 - 2 * t)));
    }
    data[i * 4 + 3] = Math.max(0, Math.min(255, newA));
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/**
 * 对 alpha 通道执行 box blur（多次迭代模拟高斯）
 */
function boxBlurAlpha(alpha, w, h, radius) {
  if (radius <= 0) return alpha.slice();

  let result = new Float32Array(alpha);
  const iterations = 3;
  for (let iter = 0; iter < iterations; iter++) {
    const temp = new Float32Array(w * h);

    // 水平方向
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = x + dx;
          if (sx >= 0 && sx < w) {
            sum += result[y * w + sx];
            count++;
          }
        }
        temp[y * w + x] = sum / count;
      }
    }

    // 垂直方向
    result = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const sy = y + dy;
          if (sy >= 0 && sy < h) {
            sum += temp[sy * w + x];
            count++;
          }
        }
        result[y * w + x] = sum / count;
      }
    }
  }
  return result;
}

/**
 * Debounce 防抖
 */
function debounce(fn, delay = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * sessionStorage 简单封装（用于页面间传递图片数据）
 */
const Storage = {
  set(key, val) {
    try {
      sessionStorage.setItem(key, val);
    } catch (e) {
      console.warn('存储失败', e);
    }
  },
  get(key) {
    return sessionStorage.getItem(key);
  },
  remove(key) {
    sessionStorage.removeItem(key);
  },
};

// 暴露到全局
window.Utils = {
  loadImageFile,
  imageToCanvas,
  canvasToDataURL,
  downloadDataURL,
  hexToRgb,
  compositeOnBackground,
  cropToSize,
  applyFilters,
  rotateCanvas,
  flipCanvasHorizontal,
  removeColorBackground,
  pickColor,
  refineAlphaEdge,
  debounce,
  Storage,
};
