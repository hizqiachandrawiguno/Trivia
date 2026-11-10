// Render thumbnail 1080x1920: node cover.js out.png
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const out = process.argv[2] || 'cover.png', page_ = process.env.PAGE || 'mesir01.html';
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(__dirname, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, r));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(`http://localhost:${srv.address().port}/${page_}?cover=1`); await p.waitForFunction('window.COVER_READY', { timeout: 60000 });
  await p.waitForTimeout(300); await p.screenshot({ path: out }); await b.close(); srv.close();
})();
