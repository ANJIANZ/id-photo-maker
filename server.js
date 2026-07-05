/**
 * 证件照制作网站 - 本地 HTTP 服务器
 * 设置必要的 COOP/COEP 头以支持 SharedArrayBuffer（AI 抠图需要）
 * 
 * 使用方法：
 *   node server.js
 * 
 * 然后访问 http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const HOST = '0.0.0.0';

// 读取配置（优先环境变量，其次 config.json）
let CONFIG = {
  baiduApiKey: process.env.BAIDU_API_KEY || '',
  baiduSecretKey: process.env.BAIDU_SECRET_KEY || '',
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 1600
};
try {
  const configRaw = fs.readFileSync(path.join(ROOT, 'config.json'), 'utf-8');
  const fileConfig = JSON.parse(configRaw);
  // 仅当环境变量未设置时，使用 config.json 中的值
  if (!process.env.BAIDU_API_KEY && fileConfig.baiduApiKey) CONFIG.baiduApiKey = fileConfig.baiduApiKey;
  if (!process.env.BAIDU_SECRET_KEY && fileConfig.baiduSecretKey) CONFIG.baiduSecretKey = fileConfig.baiduSecretKey;
  if (fileConfig.maxImageSize) CONFIG.maxImageSize = fileConfig.maxImageSize;
} catch (e) {
  if (!CONFIG.baiduApiKey || !CONFIG.baiduSecretKey) {
    console.warn('未找到 config.json，使用环境变量配置');
  }
}

// ===== 百度 AI 抠图 API =====
const BaiduAI = {
  _token: null,
  _tokenTime: 0,

  // 获取 access_token（带缓存，30天有效）
  async getAccessToken() {
    // 每25天刷新一次
    if (this._token && Date.now() - this._tokenTime < 25 * 24 * 60 * 60 * 1000) {
      return this._token;
    }

    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${CONFIG.baiduApiKey}&client_secret=${CONFIG.baiduSecretKey}`;
    const resp = await fetch(tokenUrl);
    const data = await resp.json();
    if (data.access_token) {
      this._token = data.access_token;
      this._tokenTime = Date.now();
      return this._token;
    }
    throw new Error(`获取 access_token 失败: ${JSON.stringify(data)}`);
  },

  // 智能抠图
  async removeBackground(base64Data, onProgress) {
    if (!CONFIG.baiduApiKey || !CONFIG.baiduSecretKey) {
      throw new Error('请在环境变量 BAIDU_API_KEY / BAIDU_SECRET_KEY 或 config.json 中配置百度API密钥');
    }

    if (onProgress) onProgress(0.2);

    const accessToken = await this.getAccessToken();

    if (onProgress) onProgress(0.5);

    const requestBody = {
      image: base64Data,
      method: 'auto',
      refine_mask: 'true',
      return_form: 'rgba',
    };

    const apiUrl = 'https://aip.baidubce.com/rest/2.0/image-process/v1/segment?access_token=' + accessToken;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(requestBody),
    });

    if (onProgress) onProgress(0.8);

    const result = await response.json();
    if (result.error_code) {
      throw new Error(`百度API错误(${result.error_code}): ${result.error_msg || JSON.stringify(result)}`);
    }

    if (onProgress) onProgress(1.0);

    // 返回 base64 图像数据
    return result.image;
  },
};

// API 路由
async function handleApiCutout(req, res) {
  try {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        if (!image) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '缺少 image 字段' }));
          return;
        }

        // 前端传过来的是完整 data URL，提取 base64 部分
        const base64 = image.replace(/^data:image\/\w+;base64,/, '');

        const result = await BaiduAI.removeBackground(base64, (p) => {
          // 进度可以通过 SSE 发送，这里简化为同步
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ data: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '请求解析失败' }));
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const urlPath = parsed.pathname;

  // 设置跨域隔离头
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API 路由
  if (urlPath === '/api/cutout' && req.method === 'POST') {
    return handleApiCutout(req, res);
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // 静态文件
  let filePath = urlPath.split('?')[0];
  if (filePath === '/') filePath = '/index.html';
  const fullPath = path.join(ROOT, filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + filePath);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('  证件照制作网站 - 本地服务器已启动');
  console.log('  COOP/COEP 头已设置 (AI 抠图所需)');
  console.log('  百度 AI 接口已启用: /api/cutout');
  console.log('========================================');
  console.log(`  本机访问: http://localhost:${PORT}`);
  console.log(`  退出: Ctrl+C`);
  console.log('========================================');
});