'use strict';

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

function now(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
}

function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();

/** Créneaux de début possibles dans la journée (HH:MM). */
function allSlots(s) {
  const out = [];
  const last = toMin(s.close) - s.durationMinutes;
  for (let m = toMin(s.open); m <= last; m += s.slotMinutes) out.push(toHHMM(m));
  return out;
}

const maxSeats = (db) => Math.max(0, ...db.tables.map((t) => t.seats));

/** Cherche la plus petite table libre pouvant accueillir `party` personnes. */
function checkSlot(db, { date, time, party }) {
  const s = db.settings;
  if (!isDate(date) || !isTime(time)) return { ok: false, reason: 'invalid' };
  const n = now(s.timezone);
  if (date < n.date || (date === n.date && toMin(time) <= n.minutes)) return { ok: false, reason: 'past' };
  if (s.closedDays.includes(weekday(date))) return { ok: false, reason: 'closed' };
  const start = toMin(time);
  if (start < toMin(s.open) || start + s.durationMinutes > toMin(s.close)) {
    return { ok: false, reason: 'hours' };
  }
  if (party > maxSeats(db)) return { ok: false, reason: 'too_large' };
  const busy = new Set(
    db.reservations
      .filter((r) => r.status === 'confirmed' && r.date === date)
      .filter((r) => {
        const rs = toMin(r.time);
        return start < rs + s.durationMinutes && rs < start + s.durationMinutes;
      })
      .map((r) => r.tableId)
  );
  const table = db.tables
    .filter((t) => t.seats >= party && !busy.has(t.id))
    .sort((a, b) => a.seats - b.seats || a.id - b.id)[0];
  return table ? { ok: true, table } : { ok: false, reason: 'full' };
}

function availableSlots(db, date, party) {
  return allSlots(db.settings).filter((time) => checkSlot(db, { date, time, party }).ok);
}

const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');
const validPhone = (p) => /^\+?\d{6,15}$/.test(cleanPhone(p));

const REASONS = {
  invalid: 'Date ou heure invalide.',
  past: 'Ce créneau est déjà passé.',
  closed: 'Nous sommes fermés ce jour-là.',
  hours: "Ce créneau est en dehors de nos horaires d'ouverture.",
  too_large: 'Nous ne pouvons pas accueillir un groupe aussi grand.',
  full: "Il n'y a plus de table disponible à cette heure.",
};

function createReservation(store, input) {
  const db = store.data;
  const party = Number(input.party);
  const name = String(input.name || '').trim().slice(0, 80);
  if (!Number.isInteger(party) || party < 1) return { ok: false, error: 'Nombre de personnes invalide.' };
  if (!name) return { ok: false, error: 'Le nom est obligatoire.' };
  if (!validPhone(input.phone)) return { ok: false, error: 'Numéro de téléphone invalide.' };
  const slot = checkSlot(db, { date: input.date, time: input.time, party });
  if (!slot.ok) return { ok: false, error: REASONS[slot.reason], reason: slot.reason };
  const reservation = {
    id: store.nextId(),
    createdAt: new Date().toISOString(),
    date: input.date,
    time: input.time,
    party,
    name,
    phone: cleanPhone(input.phone),
    notes: String(input.notes || '').slice(0, 300),
    tableId: slot.table.id,
    status: 'confirmed',
    source: input.source || 'web',
  };
  db.reservations.push(reservation);
  store.save();
  return { ok: true, reservation, table: slot.table };
}

function createOrder(store, input) {
  const db = store.data;
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Le nom est obligatoire.' };
  if (!validPhone(input.phone)) return { ok: false, error: 'Numéro de téléphone invalide.' };
  const lines = [];
  for (const it of input.items || []) {
    const qty = Number(it.qty);
    const item = db.menu.find((m) => m.id === Number(it.id) && m.available);
    if (!item || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return { ok: false, error: 'Article invalide.' };
    }
    const existing = lines.find((l) => l.id === item.id);
    if (existing) existing.qty += qty;
    else lines.push({ id: item.id, name: item.name, price: item.price, qty });
  }
  if (!lines.length) return { ok: false, error: 'Le panier est vide.' };
  const total = Math.round(lines.reduce((t, l) => t + l.price * l.qty, 0) * 100) / 100;
  const order = {
    id: store.nextId(),
    number: store.nextOrderNumber(),
    createdAt: new Date().toISOString(),
    name,
    phone: cleanPhone(input.phone),
    items: lines,
    total,
    pickupInMinutes: db.settings.prepMinutes,
    status: 'new',
    source: input.source || 'web',
  };
  db.orders.push(order);
  store.save();
  return { ok: true, order };
}

module.exports = {
  toMin, toHHMM, now, addDays, allSlots, checkSlot, availableSlots,
  createReservation, createOrder, maxSeats, isDate, isTime, validPhone,
};
