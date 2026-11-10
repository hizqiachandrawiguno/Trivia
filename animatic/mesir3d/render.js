// Render adegan 3D ke MP4 (tanpa suara). Pakai: node render.js out.mp4 [fps]
//   uji frame: node render.js out_prefix 24 t1,t2,...  (simpan PNG saja)
// Env: PAGE=mesir01.html (default). Butuh server lokal karena modul ES tidak bisa dimuat via file://.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const [out, fpsArg, probe] = process.argv.slice(2);
const fps = +(fpsArg || 24), page_ = process.env.PAGE || 'mesir01.html';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const f = path.join(__dirname, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(__dirname) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(`http://localhost:${port}/${page_}`); await p.waitForFunction('window.READY', { timeout: 60000 });
  const total = await p.evaluate(() => window.TOTAL);
  if (probe) {
    for (const t of probe.split(',')) { await p.evaluate(t => seek(+t), t); await p.screenshot({ path: `${out}_${t}.png` }); }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(total * fps), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await p.evaluate(t => seek(t), i / fps);
      const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 200 === 0) console.log(`frame ${i}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('frames', n);
  }
  await b.close(); srv.close();
})();
