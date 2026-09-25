const { readJson, writeJson } = require('./_lib/github');
const { requireAuth } = require('./_lib/auth');

const PATH = 'data/authors.json';

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

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
      const { data: authors } = await readJson(PATH, []);
      const { id } = req.query || {};
      if (id) {
        const author = authors.find((a) => a.id === id);
        if (!author) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json(author);
      }
      return res.status(200).json(authors);
    }

    if (!requireAuth(req, res)) return;

    const { data: authors } = await readJson(PATH, []);

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body.name) return res.status(400).json({ error: 'Name is required' });
      let baseId = slugify(body.name);
      let id = baseId;
      let n = 2;
      while (authors.some((a) => a.id === id)) {
        id = `${baseId}-${n++}`;
      }
      const author = {
        id,
        name: body.name,
        designation: body.designation || '',
        image: body.image || '',
      };
      authors.push(author);
      await writeJson(PATH, authors, `admin: add author "${author.name}"`);
      return res.status(201).json(author);
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const idx = authors.findIndex((a) => a.id === body.id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      authors[idx] = { ...authors[idx], ...body };
      await writeJson(PATH, authors, `admin: update author "${authors[idx].name}"`);
      return res.status(200).json(authors[idx]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      const idx = authors.findIndex((a) => a.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const [removed] = authors.splice(idx, 1);
      await writeJson(PATH, authors, `admin: delete author "${removed.name}"`);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
