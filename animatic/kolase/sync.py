#!/usr/bin/env python3
"""Sinkronkan adegan dengan voiceover.
Pakai: python3 sync.py audio.mp3 naskah.vo.txt timing.js
- naskah.vo.txt : satu baris = voiceover satu adegan (urutan sama dengan array S di HTML)
- timing.js     : keluaran (window.CFG) yang dimuat oleh HTML
Batas adegan = jeda napas terdeteksi yang paling dekat dengan perkiraan berdasarkan panjang teks.
Cek tabel yang dicetak: tiap batas harus jatuh di akhir kalimat terakhir adegan."""
import re, subprocess, sys, json
audio, vo_path, out = sys.argv[1:4]
vo = [l.strip() for l in open(vo_path, encoding='utf-8') if l.strip()]
dur = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',audio]))
log = subprocess.run(['ffmpeg','-hide_banner','-i',audio,'-af','silencedetect=noise=-35dB:d=0.35','-f','null','-'],capture_output=True,text=True).stderr
st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
sil = list(zip(st, en))
if len(st) > len(en): sil.append((st[-1], dur + 15))
elif sil and sil[-1][1] < dur - 0.2: pass
sil_mid = [s for s in sil if s[1] < 999]
lead = en[0] if st and st[0] < 0.05 else 0.0     # hening di awal rekaman
n = [len(re.sub(r'\W', '', v)) for v in vo]; tot = sum(n)
speech_end = st[-1] if (st and en and st[-1] > en[-1]) or (st and len(st) > len(en)) else dur
speech_end = max([s for s, e in sil if e >= dur - 0.15] + [dur]) if any(e >= dur - 0.15 for s, e in sil) else dur
bounds = [0.0]; c = 0
for i in range(len(vo) - 1):
    c += n[i]; pred = lead + c / tot * (speech_end - lead)
    cand = [s for s in sil if s[0] > bounds[-1] + 1.5 and s[1] < speech_end - 0.5]
    best = min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - pred))
    bounds.append(round((best[0] + best[1]) / 2, 2))
bounds.append(round(dur + 0.5, 2))
sil_out = [[round(a, 3), round(b, 3)] for a, b in sil] + ([[round(dur, 3), 99]] if not any(e > dur for s, e in sil) else [])
open(out, 'w', encoding='utf-8').write('window.CFG=' + json.dumps({'bounds': bounds, 'sil': sil_out}) + ';\n')
print(f'audio {dur:.1f}s, {len(sil)} jeda napas')
for i, v in enumerate(vo):
    print(f'adegan {i+1}: {bounds[i]:6.2f} - {bounds[i+1]:6.2f}  ({bounds[i+1]-bounds[i]:5.1f}s)  ...{v[-40:]}')
