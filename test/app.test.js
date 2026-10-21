'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../src/store');
const B = require('../src/booking');
const { handleVoice, parseTime } = require('../src/voice');

const fresh = () => new Store(null);
const tomorrow = (s) => B.addDays(B.now(s.data.settings.timezone).date, 1);

test('réservation : choisit la plus petite table libre puis détecte le complet', () => {
  const s = fresh();
  const date = tomorrow(s);
  const a = B.createReservation(s, { date, time: '20:00', party: 2, name: 'A', phone: '0612345678' });
  assert.equal(a.table.seats, 2);
  const b = B.createReservation(s, { date, time: '20:30', party: 2, name: 'B', phone: '0612345678' });
  assert.notEqual(b.reservation.tableId, a.reservation.tableId); // chevauchement => autre table
  for (let i = 0; i < 4; i++) B.createReservation(s, { date, time: '20:00', party: 8, name: 'X', phone: '0612345678' });
  const full = B.createReservation(s, { date, time: '20:00', party: 8, name: 'Z', phone: '0612345678' });
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'full');
});

test('réservation : refuse le passé, hors horaires, jour fermé, données invalides', () => {
  const s = fresh();
  const date = tomorrow(s);
  const base = { date, time: '20:00', party: 2, name: 'A', phone: '0612345678' };
  assert.equal(B.createReservation(s, { ...base, date: '2020-01-01' }).reason, 'past');
  assert.equal(B.createReservation(s, { ...base, time: '22:30' }).reason, 'hours');
  assert.equal(B.createReservation(s, { ...base, party: 99 }).reason, 'too_large');
  assert.equal(B.createReservation(s, { ...base, name: ' ' }).ok, false);
  assert.equal(B.createReservation(s, { ...base, phone: 'abc' }).ok, false);
  s.data.settings.closedDays = [new Date(date + 'T12:00:00Z').getUTCDay()];
  assert.equal(B.createReservation(s, base).reason, 'closed');
});

test('commande : total recalculé côté serveur, articles invalides refusés', () => {
  const s = fresh();
  const r = B.createOrder(s, { name: 'A', phone: '0612345678', items: [{ id: 1, qty: 2 }, { id: 5, qty: 1 }, { id: 1, qty: 1 }] });
  assert.equal(r.order.total, 11 * 3 + 6);
  assert.equal(r.order.items.length, 2);
  assert.equal(B.createOrder(s, { name: 'A', phone: '0612345678', items: [{ id: 999, qty: 1 }] }).ok, false);
  assert.equal(B.createOrder(s, { name: 'A', phone: '0612345678', items: [{ id: 1, qty: -1 }] }).ok, false);
  assert.equal(B.createOrder(s, { name: 'A', phone: '0612345678', items: [] }).ok, false);
});

test('parseTime', () => {
  assert.equal(parseTime('1930'), '19:30');
  assert.equal(parseTime('930'), '09:30');
  assert.equal(parseTime('20'), '20:00');
  assert.equal(parseTime('2575'), null);
  assert.equal(parseTime(''), null);
});

const q = (xml) => xml.match(/action="([^"]*)"/)?.[1]?.replace(/&amp;/g, '&');
const call = (s, url, extra = {}) => {
  const u = new URL(url, 'http://x');
  return handleVoice(s, u.pathname, { ...Object.fromEntries(u.searchParams), CallSid: 'C1', From: '+33612345678', ...extra });
};

test('téléphone : parcours complet de réservation', () => {
  const s = fresh();
  let xml = call(s, '/voice/incoming');
  assert.match(xml, /Bienvenue chez Chez Demo/);
  xml = call(s, q(xml), { Digits: '1' });
  xml = call(s, q(xml), { Digits: '4' });
  xml = call(s, q(xml), { Digits: '2' }); // demain
  xml = call(s, q(xml), { Digits: '1930' });
  assert.match(xml, /C'est réservé/);
  assert.match(xml, /<Hangup\/>/);
  const r = s.data.reservations[0];
  assert.deepEqual([r.party, r.time, r.date, r.source, r.phone], [4, '19:30', tomorrow(s), 'telephone', '+33612345678']);
  assert.match(s.data.calls[0].outcome, /table réservée/);
});

test('téléphone : propose des alternatives quand c\'est complet', () => {
  const s = fresh();
  const date = tomorrow(s);
  for (let i = 0; i < 2; i++) B.createReservation(s, { date, time: '20:00', party: 8, name: 'X', phone: '0612345678' }); // 1 seule table de 8 => 2e échoue
  const xml = call(s, `/voice/res/time?size=8&date=${date}`, { Digits: '2000' });
  assert.match(xml, /pas de table/);
  assert.match(xml, /<Gather/); // redemande l'heure
});

test('téléphone : parcours complet de commande', () => {
  const s = fresh();
  let xml = call(s, '/voice/menu', { Digits: '2' });
  assert.match(xml, /Tapez 1 pour Pizza Margherita, 11 euros/);
  xml = call(s, q(xml), { Digits: '1' });
  xml = call(s, q(xml), { Digits: '1' });
  xml = call(s, q(xml), { Digits: '5' });
  assert.match(xml, /3 articles, 28 euros/);
  xml = call(s, q(xml), { Digits: '0' });
  assert.match(xml, /commande numéro 1/);
  assert.equal(s.data.orders[0].total, 28);
  assert.equal(s.data.orders[0].source, 'telephone');
});

test('téléphone : panier vide et saisies invalides', () => {
  const s = fresh();
  assert.match(call(s, '/voice/order/add', { Digits: '0' }), /panier est vide/);
  assert.match(call(s, '/voice/menu', { Digits: '7' }), /Choix non reconnu/);
  assert.match(call(s, '/voice/res/size', { Digits: '40' }), /de 1 à 8 personnes/);
  assert.equal(s.data.orders.length, 0);
});

test('HTTP : API publique, auth admin, signature Twilio', async () => {
  process.env.DATA_FILE = require('node:path').join(require('node:os').tmpdir(), `t-${Date.now()}.json`);
  process.env.ADMIN_PASSWORD = 'secret';
  const { server } = require('../src/server');
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { authorization: 'Basic ' + Buffer.from('admin:secret').toString('base64') };
  try {
    assert.equal((await fetch(base + '/api/admin/state')).status, 401);
    assert.equal((await fetch(base + '/admin')).status, 401);
    assert.equal((await fetch(base + '/api/admin/state', { headers: { authorization: 'Basic ' + Buffer.from('a:nope').toString('base64') } })).status, 401);
    assert.equal((await fetch(base + '/api/admin/state', { headers: auth })).status, 200);
    assert.equal((await fetch(base + '/../package.json')).status, 404);

    const info = await (await fetch(base + '/api/info')).json();
    const date = B.addDays(info.today, 1);
    const { slots } = await (await fetch(`${base}/api/availability?date=${date}&party=2`)).json();
    assert.ok(slots.includes('20:00'));
    const res = await fetch(base + '/api/reservations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date, time: '20:00', party: 2, name: 'Test', phone: '0612345678' }),
    });
    assert.equal(res.status, 201);
    const bad = await fetch(base + '/api/reservations', { method: 'POST', body: '{}' });
    assert.equal(bad.status, 400);

    const v = await fetch(base + '/voice/incoming', { method: 'POST', body: new URLSearchParams({ From: '+33600000000', CallSid: 'H1' }) });
    assert.equal(v.status, 200);
    assert.match(v.headers.get('content-type'), /xml/);
    const state = await (await fetch(base + '/api/admin/state', { headers: auth })).json();
    assert.equal(state.reservations.length, 1);
    assert.equal(state.calls.length, 1);
  } finally {
    server.close();
  }
});
