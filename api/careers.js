const { readJson, writeJson } = require('./_lib/github');
const { requireAuth } = require('./_lib/auth');

const PATH = 'data/careers.json';

async function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const { data: items } = await readJson(PATH, []);
      const { id } = req.query || {};
      if (id) {
        const item = items.find((p) => p.id === id);
        if (!item) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json(item);
      }
      return res.status(200).json(items);
    }

    if (!requireAuth(req, res)) return;

    const { data: items } = await readJson(PATH, []);

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body.title) return res.status(400).json({ error: 'Title is required' });
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        title: body.title,
        tag: body.tag || '',
        location: body.location || 'Ahmedabad',
        type: body.type || 'Full-time',
        description: body.description || '',
        applyEmail: body.applyEmail || 'careers@bluewingconstruction.com',
        date: body.date || new Date().toISOString().slice(0, 10),
        active: body.active !== false,
      };
      items.unshift(item);
      await writeJson(PATH, items, `admin: add career opening "${item.title}"`);
      return res.status(201).json(item);
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const idx = items.findIndex((p) => p.id === body.id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      items[idx] = { ...items[idx], ...body };
      await writeJson(PATH, items, `admin: update career opening "${items[idx].title}"`);
      return res.status(200).json(items[idx]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      const idx = items.findIndex((p) => p.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const [removed] = items.splice(idx, 1);
      await writeJson(PATH, items, `admin: delete career opening "${removed.title}"`);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
