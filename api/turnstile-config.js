module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) return res.status(503).json({ error: 'Contact verification is unavailable.' });
  return res.status(200).json({ siteKey });
};
