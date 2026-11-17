// Download the exact woff2 files (latin subset) for the three families/weights
// used by the redesign, so the site has zero external dependencies.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const url = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap';
const css = execFileSync('curl', ['-s', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1 << 22 });

// Split into @font-face blocks; keep the latin subset for each family+weight.
const blocks = css.split('/*').map(b => b.trim()).filter(b => b.startsWith('latin */'));
const wanted = [];
for (const b of blocks) {
  const fam = (b.match(/font-family: '([^']+)'/) || [])[1];
  const weight = (b.match(/font-weight: (\d+)/) || [])[1];
  const src = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  if (!fam || !weight || !src) continue;
  const file = fam.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + weight + '.woff2';
  wanted.push({ fam, weight, src, file });
}
console.log('found', wanted.length, 'latin faces');
for (const w of wanted) {
  const dest = path.join(__dirname, '..', 'fonts', w.file);
  execFileSync('curl', ['-s', '-o', dest, w.src], { timeout: 60000 });
  const size = fs.statSync(dest).size;
  console.log(w.file, size, 'bytes');
  if (size < 1000) throw new Error('suspiciously small: ' + w.file);
}
