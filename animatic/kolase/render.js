// Render index.html ke MP4: node render.js out.mp4 [fps] [t1,t2,...  (opsional: hanya simpan frame uji PNG)]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const [out, fpsArg, probe] = process.argv.slice(2);
const fps = +(fpsArg || 24);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  await p.goto('file://' + path.join(__dirname, 'index.html'));
  await p.waitForTimeout(500);
  const total = await p.evaluate(() => window.TOTAL);
  if (probe) {
    for (const t of probe.split(',')) {
      await p.evaluate(t => seek(+t), t);
      await p.screenshot({ path: `${out}_${t}.png` });
    }
    await b.close(); return;
  }
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(total * fps);
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => seek(t), i / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log('frames', n);
})();
