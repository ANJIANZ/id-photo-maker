/* ============================================================
   证件照制作网站 - 排版打印模块
   ============================================================ */

(function () {
  const printCanvas = document.getElementById('printCanvas');
  const printCtx = printCanvas.getContext('2d');
  const emptyState = document.getElementById('emptyState');
  const printContent = document.getElementById('printContent');
  const downloadPrintBtn = document.getElementById('downloadPrintBtn');

  const state = {
    photoImg: null,
    sizeId: 'one',
    paperId: 'a4',
  };

  function init() {
    const dataURL = Utils.Storage.get('finalPhoto');
    state.sizeId = Utils.Storage.get('printSizeId') || 'one';

    if (!dataURL) {
      emptyState.style.display = 'block';
      return;
    }

    const img = new Image();
    img.onload = () => {
      state.photoImg = img;
      printContent.style.display = 'block';
      renderPaperOptions();
      renderPrint();
    };
    img.src = dataURL;
  }

  function renderPaperOptions() {
    const container = document.getElementById('paperSelect');
    container.innerHTML = '';
    PAPER_SIZES.forEach(p => {
      const div = document.createElement('div');
      div.className = 'paper-option' + (p.id === state.paperId ? ' active' : '');
      div.innerHTML = `
        <h4>${p.name}</h4>
        <div class="paper-dim">${p.width}×${p.height}mm</div>
      `;
      div.addEventListener('click', () => {
        document.querySelectorAll('.paper-option').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        state.paperId = p.id;
        renderPrint();
      });
      container.appendChild(div);
    });
  }

  /**
   * 计算排版：在纸张上排列证件照
   * 留 5mm 边距，照片间距 2mm
   */
  function renderPrint() {
    if (!state.photoImg) return;

    const paper = getPaperById(state.paperId);
    const size = getSizeById(state.sizeId);
    const dpi = paper.dpi;

    const paperPxW = mmToPixel(paper.width, dpi);
    const paperPxH = mmToPixel(paper.height, dpi);
    const photoPxW = mmToPixel(size.width, dpi);
    const photoPxH = mmToPixel(size.height, dpi);
    const margin = mmToPixel(5, dpi);     // 5mm 边距
    const gap = mmToPixel(2, dpi);        // 2mm 间距

    // 计算可排列数量
    const availW = paperPxW - margin * 2;
    const availH = paperPxH - margin * 2;
    const cols = Math.floor((availW + gap) / (photoPxW + gap));
    const rows = Math.floor((availH + gap) / (photoPxH + gap));
    const total = cols * rows;

    // 设置 canvas 尺寸
    printCanvas.width = paperPxW;
    printCanvas.height = paperPxH;

    // 白色背景
    printCtx.fillStyle = '#FFFFFF';
    printCtx.fillRect(0, 0, paperPxW, paperPxH);

    // 居中排列
    const totalBlockW = cols * photoPxW + (cols - 1) * gap;
    const totalBlockH = rows * photoPxH + (rows - 1) * gap;
    const startX = (paperPxW - totalBlockW) / 2;
    const startY = (paperPxH - totalBlockH) / 2;

    printCtx.imageSmoothingEnabled = true;
    printCtx.imageSmoothingQuality = 'high';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (photoPxW + gap);
        const y = startY + r * (photoPxH + gap);
        printCtx.drawImage(state.photoImg, x, y, photoPxW, photoPxH);
      }
    }

    // 更新信息
    document.getElementById('photoCount').textContent = total;
    document.getElementById('photoSize').textContent = size.name;
    document.getElementById('paperName').textContent = paper.name;
  }

  // 下载排版图
  downloadPrintBtn.addEventListener('click', () => {
    const paper = getPaperById(state.paperId);
    const dataURL = printCanvas.toDataURL('image/jpeg', 0.95);
    const filename = `证件照排版_${paper.name}.jpg`;
    Utils.downloadDataURL(dataURL, filename);
  });

  init();
})();
