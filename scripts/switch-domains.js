// Rewrites the cross-site links (Bluewing <-> Bhaarat <-> Sygnific) in every page
// from the "current" domains in domains.json to the "production" ones, then
// records production as current. Run once the custom domains are live:
//   node scripts/switch-domains.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'domains.json');
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const SITES = ['bluewing', 'bhaaratprecast', 'sygnificinfra'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return d.name.endsWith('.html') ? [p] : [];
  });
}

let total = 0;
for (const file of SITES.flatMap((s) => walk(path.join(ROOT, s)))) {
  let html = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const site of SITES) {
    const from = `href="${config.current[site]}/`;
    const to = `href="${config.production[site]}/`;
    if (from === to) continue;
    const parts = html.split(from);
    count += parts.length - 1;
    html = parts.join(to);
  }
  if (count) {
    fs.writeFileSync(file, html);
    console.log(String(count).padStart(3), path.relative(ROOT, file));
    total += count;
  }
}

config.current = { ...config.production };
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
console.log(`${total} links updated. domains.json "current" now points to production.`);
