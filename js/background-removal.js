/* ============================================================
   证件照制作网站 - AI 背景移除模块
   使用 @imgly/background-removal 浏览器端 AI 抠图
   ============================================================ */

const BackgroundRemover = {
  _module: null,
  _loading: null,

  // CDN 源列表（按优先级尝试，包含国内可用的镜像）
  _cdnSources: [
    'https://cdn.jsdelivr.cn/npm/@imgly/background-removal@1.6.0/+esm',
    'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/+esm',
    'https://unpkg.com/@imgly/background-removal@1.6.0/dist/index.mjs',
    'https://esm.sh/@imgly/background-removal@1.5.7',
    'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.7/+esm',
  ],

  /**
   * 动态加载 @imgly/background-removal ESM 模块
   * 依次尝试多个 CDN 源
   */
  async load() {
    if (this._module) return this._module;
    if (this._loading) return this._loading;

    this._loading = (async () => {
      let lastErr;
      for (const url of this._cdnSources) {
        try {
          const mod = await import(url);
          this._module = mod;
          return mod;
        } catch (e) {
          console.warn(`CDN 加载失败 (${url}):`, e.message);
          lastErr = e;
        }
      }
      throw new Error('所有 CDN 源均加载失败：' + (lastErr ? lastErr.message : '未知错误'));
    })();

    return this._loading;
  },

  /**
   * 执行抠图
   * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} input 输入图像
   * @param {(progress:number)=>void} onProgress 进度回调 0-1
   * @param {string} modelType 模型类型: 'isnet'（高精度80MB）, 'isnet_fp16'（中等40MB）, 'isnet_quint8'（快速20MB）
   * @returns {Promise<HTMLCanvasElement>} 透明背景的 Canvas
   */
  async remove(input, onProgress, modelType = 'isnet') {
    const mod = await this.load();

    // 获取 removeBackground 函数（兼容 default 和 named export）
    const removeBackground = mod.removeBackground || (mod.default && mod.default.removeBackground) || mod.default;

    if (typeof removeBackground !== 'function') {
      throw new Error('抠图函数未找到，模块加载异常');
    }

    // 将输入转换为 Blob
    let blob;
    if (input instanceof Blob) {
      blob = input;
    } else if (input instanceof HTMLCanvasElement) {
      blob = await new Promise(res => input.toBlob(res, 'image/png'));
    } else if (input instanceof HTMLImageElement) {
      const c = document.createElement('canvas');
      c.width = input.naturalWidth;
      c.height = input.naturalHeight;
      c.getContext('2d').drawImage(input, 0, 0);
      blob = await new Promise(res => c.toBlob(res, 'image/png'));
    } else if (typeof input === 'string') {
      const resp = await fetch(input);
      blob = await resp.blob();
    } else {
      throw new Error('不支持的输入类型');
    }

    const config = {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          onProgress(current / total);
        }
      },
      model: modelType,
      output: {
        format: 'image/png',
        quality: 0.95,
      },
    };

    const resultBlob = await removeBackground(blob, config);

    // 将结果 Blob 转为 Canvas
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(resultBlob);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('结果图片加载失败')); };
      im.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
  },

  /**
   * 预加载模型（可选，提前下载模型文件）
   */
  async preload(onProgress) {
    const mod = await this.load();
    const preload = mod.preload || (mod.default && mod.default.preload);
    if (preload) {
      await preload({
        progress: (key, current, total) => {
          if (onProgress && total > 0) onProgress(current / total);
        },
      });
    }
  },
};

window.BackgroundRemover = BackgroundRemover;
