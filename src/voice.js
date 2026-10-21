'use strict';
const B = require('./booking');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const say = (t) => `<Say language="fr-FR" voice="Polly.Lea">${esc(t)}</Say>`;
const wrap = (body) => `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
const hangup = (msg) => wrap(say(msg) + '<Hangup/>');

function gather(action, prompt, numDigits, timeout = 7) {
  return wrap(
    `<Gather input="dtmf" numDigits="${numDigits}" timeout="${timeout}" method="POST" action="${esc(action)}">` +
      say(prompt) +
      '</Gather>' +
      say("Nous n'avons pas reçu de réponse. Au revoir.") +
      '<Hangup/>'
  );
}

const euros = (n) => {
  const e = Math.floor(n);
  const c = Math.round((n - e) * 100);
  return `${e} euro${e > 1 ? 's' : ''}${c ? ' ' + c : ''}`;
};
const hourSpeech = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${h} heure${h > 1 ? 's' : ''}${m ? ' ' + m : ''}`;
};
function daySpeech(date, today) {
  if (date === today) return "aujourd'hui";
  if (date === B.addDays(today, 1)) return 'demain';
  return new Date(date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

function parseTime(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d || d.length > 4) return null;
  const h = d.length <= 2 ? Number(d) : Number(d.slice(0, -2));
  const m = d.length <= 2 ? 0 : Number(d.slice(-2));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const phoneMenu = (db) => db.menu.filter((m) => m.available).slice(0, 9);
const parseCart = (s) => (s ? s.split(',').filter(Boolean).map(Number) : []);

function logCall(store, p, outcome) {
  const calls = store.data.calls;
  let call = calls.find((c) => c.sid === p.CallSid);
  if (!call) {
    call = { id: store.nextId(), sid: p.CallSid || null, at: new Date().toISOString(), from: p.From || 'inconnu', outcome: 'en cours' };
    calls.push(call);
    if (calls.length > 200) calls.shift();
  }
  if (outcome) call.outcome = outcome;
  store.save();
}

/**
 * Traite une étape de l'appel (webhooks Twilio, méthode POST) et renvoie du TwiML.
 * `route` est le chemin (ex. "/voice/menu"), `p` les paramètres (requête + corps fusionnés).
 */
function handleVoice(store, route, p) {
  const db = store.data;
  const s = db.settings;
  const today = B.now(s.timezone).date;
  const digits = (p.Digits || '').trim();

  switch (route) {
    case '/voice/incoming': {
      logCall(store, p);
      const hello = s.welcome || `Bienvenue chez ${s.name}.`;
      return gather(
        '/voice/menu',
        `${hello} Pour réserver une table, tapez 1. Pour commander à emporter, tapez 2.`,
        1
      );
    }

    case '/voice/menu':
      if (digits === '1') {
        return gather('/voice/res/size', 'Pour combien de personnes ? Tapez le nombre, par exemple 4.', 2);
      }
      if (digits === '2') return orderMenu('');
      return gather('/voice/menu', 'Choix non reconnu. Tapez 1 pour réserver une table, ou 2 pour commander.', 1);

    case '/voice/res/size': {
      const size = Number(digits);
      const max = B.maxSeats(db);
      if (!size || size > max) {
        return gather('/voice/res/size', `Nous accueillons de 1 à ${max} personnes. Pour combien de personnes ?`, 2);
      }
      return gather(`/voice/res/day?size=${size}`, 'Pour aujourd\'hui, tapez 1. Pour demain, tapez 2.', 1);
    }

    case '/voice/res/day': {
      if (digits !== '1' && digits !== '2') {
        return gather(`/voice/res/day?size=${p.size}`, "Pour aujourd'hui, tapez 1. Pour demain, tapez 2.", 1);
      }
      const date = digits === '1' ? today : B.addDays(today, 1);
      return timePrompt(p.size, date);
    }

    case '/voice/res/time': {
      const time = parseTime(digits);
      const party = Number(p.size);
      const date = p.date;
      const slot = time && B.checkSlot(db, { date, time, party });
      if (slot && slot.ok) {
        const r = B.createReservation(store, {
          date, time, party, name: p.name || 'Client téléphone', phone: p.From || '', source: 'telephone',
        });
        if (r.ok) {
          logCall(store, p, `table réservée ${date} ${time}`);
          return hangup(
            `C'est réservé. Une table pour ${party} personne${party > 1 ? 's' : ''}, ${daySpeech(date, today)} à ${hourSpeech(time)}. ` +
              `Nous vous attendons chez ${s.name}. À bientôt !`
          );
        }
        // Appelant sans numéro valide : on réserve quand même au nom "téléphone".
        const forced = B.createReservation(store, { date, time, party, name: 'Client téléphone', phone: '+0000000', source: 'telephone' });
        if (forced.ok) {
          logCall(store, p, `table réservée ${date} ${time} (numéro masqué)`);
          return hangup(`C'est réservé pour ${party} personnes, ${daySpeech(date, today)} à ${hourSpeech(time)}. À bientôt !`);
        }
      }
      const alt = B.availableSlots(db, date, party)
        .map((t) => ({ t, d: Math.abs(B.toMin(t) - B.toMin(time || '20:00')) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.t)
        .sort();
      if (!alt.length) {
        logCall(store, p, 'complet');
        return hangup(`Désolé, nous n'avons plus de table pour ${party} personnes ${daySpeech(date, today)}. Au revoir.`);
      }
      const intro = time ? `Désolé, nous n'avons pas de table à ${hourSpeech(time)}.` : "Heure non reconnue.";
      return timePrompt(party, date, `${intro} Nous avons de la place à ${alt.map(hourSpeech).join(', ')}.`);
    }

    case '/voice/order/add': {
      const items = phoneMenu(db);
      const cart = parseCart(p.cart);
      if (digits === '0') {
        if (!cart.length) return orderMenu('', "Votre panier est vide.");
        return finishOrder(cart);
      }
      const item = items[Number(digits) - 1];
      if (!item) return orderMenu(p.cart || '', 'Choix non reconnu.');
      cart.push(item.id);
      const total = cartTotal(cart);
      return gather(
        `/voice/order/add?cart=${cart.join(',')}`,
        `${item.name} ajouté. Votre panier compte ${cart.length} article${cart.length > 1 ? 's' : ''}, ${euros(total)}. ` +
          'Tapez un autre numéro de plat, ou tapez 0 pour valider votre commande.',
        1,
        8
      );
    }

    default:
      return hangup('Service indisponible.');
  }

  function timePrompt(size, date, intro = '') {
    return gather(
      `/voice/res/time?size=${size}&date=${date}`,
      `${intro} À quelle heure ? Tapez l'heure sur quatre chiffres, par exemple 1 9 3 0 pour dix-neuf heures trente.`.trim(),
      4,
      10
    );
  }

  function orderMenu(cart, intro = '') {
    const list = phoneMenu(db)
      .map((m, i) => `Tapez ${i + 1} pour ${m.name}, ${euros(m.price)}.`)
      .join(' ');
    return gather(`/voice/order/add?cart=${cart}`, `${intro} Voici notre carte. ${list} Tapez 0 pour terminer.`.trim(), 1, 10);
  }

  function cartTotal(cart) {
    return cart.reduce((t, id) => t + (db.menu.find((m) => m.id === id)?.price || 0), 0);
  }

  function finishOrder(cart) {
    const counts = {};
    for (const id of cart) counts[id] = (counts[id] || 0) + 1;
    const r = B.createOrder(store, {
      name: 'Client téléphone',
      phone: p.From && B.validPhone(p.From) ? p.From : '+0000000',
      items: Object.entries(counts).map(([id, qty]) => ({ id: Number(id), qty })),
      source: 'telephone',
    });
    if (!r.ok) return hangup("Désolé, une erreur est survenue. Merci de rappeler.");
    logCall(store, p, `commande n°${r.order.number}`);
    return hangup(
      `Votre commande numéro ${r.order.number} est enregistrée. Total : ${euros(r.order.total)}. ` +
        `Elle sera prête dans ${s.prepMinutes} minutes. Merci et à bientôt chez ${s.name} !`
    );
  }
}

module.exports = { handleVoice, parseTime };
