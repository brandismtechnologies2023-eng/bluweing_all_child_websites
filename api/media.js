const { list, del } = require('@vercel/blob');
const { readJson } = require('./_lib/github');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
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
