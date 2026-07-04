/* ============================================================
   证件照制作网站 - 上传 & 摄像头模块
   ============================================================ */

(function () {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const cameraBtn = document.getElementById('cameraBtn');
  const startEditorBtn = document.getElementById('startEditorBtn');
  const cameraModal = document.getElementById('cameraModal');
  const cameraVideo = document.getElementById('cameraVideo');
  const captureBtn = document.getElementById('captureBtn');
  const closeCameraBtn = document.getElementById('closeCameraBtn');

  let cameraStream = null;

  // 上传区域点击
  if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    });
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  async function processFile(file) {
    try {
      const img = await Utils.loadImageFile(file);
      // 缩放到合理尺寸后存入 sessionStorage
      const canvas = Utils.imageToCanvas(img, 1600);
      const dataURL = Utils.canvasToDataURL(canvas, 'image/png');
      Utils.Storage.set('originalImage', dataURL);
      // 跳转到编辑器
      window.location.href = 'editor.html';
    } catch (err) {
      alert('图片加载失败：' + err.message);
    }
  }

  // 摄像头
  if (cameraBtn) {
    cameraBtn.addEventListener('click', openCamera);
    closeCameraBtn.addEventListener('click', closeCamera);
    captureBtn.addEventListener('click', capturePhoto);
  }

  async function openCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      cameraVideo.srcObject = cameraStream;
      cameraModal.classList.add('show');
    } catch (err) {
      alert('无法访问摄像头：' + err.message);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    cameraModal.classList.remove('show');
  }

  function capturePhoto() {
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    // 镜像翻转（自拍体验）
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraVideo, 0, 0);
    const dataURL = canvas.toDataURL('image/png');
    Utils.Storage.set('originalImage', dataURL);
    closeCamera();
    window.location.href = 'editor.html';
  }

  // 前往编辑器
  if (startEditorBtn) {
    startEditorBtn.addEventListener('click', () => {
      window.location.href = 'editor.html';
    });
  }
})();
