const { list, del } = require('@vercel/blob');
const { readJson, writeJson } = require('./_lib/github');
const { requireAuth } = require('./_lib/auth');

// Company logos set from the admin panel (/api/media?logos). The websites read
// them publicly; an empty value means "use the logo built into the page".
const LOGOS_PATH = 'data/logos.json';
const COMPANIES = ['bluewing', 'sygnificinfra', 'bhaaratprecast'];

function pickLogos(data) {
  const out = {};
  COMPANIES.forEach((c) => { out[c] = data && typeof data[c] === 'string' ? data[c] : ''; });
  return out;
}

async function logos(req, res) {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const { data } = await readJson(LOGOS_PATH, {});
      return res.status(200).json(pickLogos(data));
    }
    if (!requireAuth(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};
    const company = (req.query || {}).company || body.company;
    if (!COMPANIES.includes(company)) return res.status(400).json({ error: 'Unknown company' });

    const { data } = await readJson(LOGOS_PATH, {}, false);
    const current = pickLogos(data);

    if (req.method === 'PUT') {
      const url = String(body.url || '').trim();
      if (!url.startsWith('https://')) return res.status(400).json({ error: 'A valid https logo URL is required' });
      current[company] = url;
      await writeJson(LOGOS_PATH, current, `admin: update ${company} logo`);
      return res.status(200).json(current);
    }
    if (req.method === 'DELETE') {
      current[company] = '';
      await writeJson(LOGOS_PATH, current, `admin: remove ${company} logo`);
      return res.status(200).json(current);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

module.exports = async (req, res) => {
  if ((req.query || {}).logos !== undefined) return logos(req, res);
  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const { data: siteImages } = await readJson('data/media-index.json', []);
      const media = siteImages.map((m) => ({ url: m.url, source: 'site' }));

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const items = [];
        let cursor;
        do {
          const page = await list({ prefix: 'uploads/', cursor, limit: 100 });
          items.push(...page.blobs);
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const seen = new Set(media.map((m) => m.url));
        items.forEach((b) => {
          if (!seen.has(b.url)) {
            media.unshift({ url: b.url, source: 'upload', uploadedAt: b.uploadedAt });
            seen.add(b.url);
          }
        });
      }

      return res.status(200).json(media);
    }

    if (req.method === 'DELETE') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({ error: 'Image storage is not configured yet.' });
      }
      const { url } = req.query || {};
      if (!url) return res.status(400).json({ error: 'url is required' });
      if (!url.includes('blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'Only uploaded images can be deleted, not images used elsewhere on the site.' });
      }
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
