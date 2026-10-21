'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Store } = require('./store');
const B = require('./booking');
const { handleVoice } = require('./voice');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const store = new Store(DATA_FILE);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

function isAdmin(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  return safeEqual(pass, ADMIN_PASSWORD);
}

function validTwilioSignature(req, params) {
  if (!TWILIO_AUTH_TOKEN) return true;
  const url = (PUBLIC_URL || `https://${req.headers.host}`) + req.url;
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN).update(data).digest('base64');
  return safeEqual(req.headers['x-twilio-signature'] || '', expected);
}

function notify(event, payload) {
  if (!WEBHOOK_URL) return;
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, shop: store.data.settings.name, ...payload }),
  }).catch((e) => console.error('webhook:', e.message));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new Error('too big')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const publicInfo = () => {
  const { name, phone, open, close, slotMinutes, closedDays, prepMinutes } = store.data.settings;
  return {
    settings: { name, phone, open, close, slotMinutes, closedDays, prepMinutes },
    maxParty: B.maxSeats(store.data),
    today: B.now(store.data.settings.timezone).date,
    menu: store.data.menu.filter((m) => m.available),
  };
};

const cleanSettings = (o, cur) => {
  const out = { ...cur };
  for (const k of ['name', 'phone', 'welcome', 'timezone']) if (typeof o[k] === 'string') out[k] = o[k].slice(0, 200);
  for (const k of ['open', 'close']) if (B.isTime(o[k])) out[k] = o[k];
  for (const k of ['slotMinutes', 'durationMinutes', 'prepMinutes']) {
    const n = Number(o[k]);
    if (Number.isInteger(n) && n >= 5 && n <= 480) out[k] = n;
  }
  if (Array.isArray(o.closedDays)) out.closedDays = o.closedDays.map(Number).filter((n) => n >= 0 && n <= 6);
  return out;
};

async function api(req, res, url, params) {
  const { pathname } = url;
  const method = req.method;
  const db = store.data;
  const json = () => { try { return JSON.parse(params.__raw || '{}'); } catch { return {}; } };

  if (method === 'GET' && pathname === '/api/info') return send(res, 200, publicInfo());

  if (method === 'GET' && pathname === '/api/availability') {
    const party = Number(url.searchParams.get('party'));
    const date = url.searchParams.get('date');
    if (!B.isDate(date) || !party) return send(res, 400, { error: 'Paramètres invalides.' });
    return send(res, 200, { slots: B.availableSlots(db, date, party) });
  }

  if (method === 'POST' && pathname === '/api/reservations') {
    const r = B.createReservation(store, { ...json(), source: 'web' });
    if (!r.ok) return send(res, 400, { error: r.error });
    notify('reservation', { reservation: r.reservation });
    return send(res, 201, { reservation: r.reservation });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const r = B.createOrder(store, { ...json(), source: 'web' });
    if (!r.ok) return send(res, 400, { error: r.error });
    notify('order', { order: r.order });
    return send(res, 201, { order: r.order });
  }

  if (!pathname.startsWith('/api/admin/')) return send(res, 404, { error: 'Introuvable.' });
  if (!isAdmin(req)) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="Espace commerçant"' });
    return res.end();
  }

  if (method === 'GET' && pathname === '/api/admin/state') {
    const today = B.now(db.settings.timezone).date;
    return send(res, 200, {
      settings: db.settings, tables: db.tables, menu: db.menu, today,
      reservations: db.reservations.filter((r) => r.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
      orders: db.orders.slice(-100).reverse(),
      calls: db.calls.slice(-50).reverse(),
    });
  }

  let m;
  if (method === 'POST' && (m = pathname.match(/^\/api\/admin\/(reservations|orders)\/(\d+)$/))) {
    const list = m[1] === 'reservations' ? db.reservations : db.orders;
    const allowed = m[1] === 'reservations'
      ? ['confirmed', 'seated', 'cancelled', 'noshow']
      : ['new', 'preparing', 'ready', 'done', 'cancelled'];
    const item = list.find((x) => x.id === Number(m[2]));
    const status = json().status;
    if (!item || !allowed.includes(status)) return send(res, 400, { error: 'Requête invalide.' });
    item.status = status;
    store.save();
    return send(res, 200, { ok: true });
  }

  if (method === 'PUT' && pathname === '/api/admin/settings') {
    db.settings = cleanSettings(json(), db.settings);
    store.save();
    return send(res, 200, { settings: db.settings });
  }

  if (method === 'PUT' && pathname === '/api/admin/tables') {
    const rows = Array.isArray(json().tables) ? json().tables : [];
    db.tables = rows
      .filter((t) => String(t.name || '').trim() && Number(t.seats) >= 1)
      .map((t) => ({ id: Number(t.id) || store.nextId(), name: String(t.name).slice(0, 30), seats: Math.min(50, Math.floor(Number(t.seats))) }));
    store.save();
    return send(res, 200, { tables: db.tables });
  }

  if (method === 'PUT' && pathname === '/api/admin/menu') {
    const rows = Array.isArray(json().menu) ? json().menu : [];
    db.menu = rows
      .filter((i) => String(i.name || '').trim() && Number(i.price) >= 0)
      .map((i) => ({
        id: Number(i.id) || store.nextId(),
        name: String(i.name).slice(0, 80),
        price: Math.round(Number(i.price) * 100) / 100,
        available: i.available !== false,
      }));
    store.save();
    return send(res, 200, { menu: db.menu });
  }

  return send(res, 404, { error: 'Introuvable.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const raw = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : '';
    const form = req.headers['content-type']?.includes('urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : {};
    const params = { ...Object.fromEntries(url.searchParams), ...form, __raw: raw };

    if (url.pathname.startsWith('/voice/')) {
      if (!validTwilioSignature(req, { ...form }) && !isAdmin(req)) return send(res, 403, 'Signature invalide', 'text/plain');
      const xml = handleVoice(store, url.pathname, params);
      if (url.pathname === '/voice/incoming') notify('call', { from: params.From });
      return send(res, 200, xml, 'text/xml; charset=utf-8');
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url, params);

    const protectedPage = ['/admin', '/admin.html', '/simulateur', '/simulateur.html'].includes(url.pathname);
    if (protectedPage && !isAdmin(req)) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="Espace commerçant"' });
      return res.end('Authentification requise');
    }
    const name = url.pathname === '/' ? 'index.html'
      : url.pathname === '/admin' ? 'admin.html'
      : url.pathname === '/simulateur' ? 'simulateur.html'
      : url.pathname.slice(1);
    const file = path.join(PUBLIC_DIR, name);
    if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return send(res, 404, 'Page introuvable', 'text/plain');
    }
    send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Erreur serveur.' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Standard auto sur http://localhost:${PORT}`);
    if (ADMIN_PASSWORD === 'admin') console.warn('⚠ Mot de passe admin par défaut : définissez ADMIN_PASSWORD.');
    if (!TWILIO_AUTH_TOKEN) console.warn('⚠ TWILIO_AUTH_TOKEN non défini : les appels ne sont pas authentifiés.');
  });
}

module.exports = { server, store };
