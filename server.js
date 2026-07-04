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

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const HOST = '0.0.0.0'; // 监听所有网络接口，允许手机访问

// 获取本机局域网 IP
function getLocalIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
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
  // 设置跨域隔离头（AI 抠图需要 SharedArrayBuffer）
  // 使用 credentialless 替代 require-corp，兼容 CDN 跨域资源加载
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');

  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(ROOT, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + url);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('========================================');
  console.log('  证件照制作网站 - 本地服务器已启动');
  console.log('  COOP/COEP 头已设置 (AI 抠图所需)');
  console.log('========================================');
  console.log(`  本机访问: http://localhost:${PORT}`);
  console.log(`  手机访问: http://${localIP}:${PORT}`);
  console.log(`  退出: Ctrl+C`);
  console.log('========================================');
});