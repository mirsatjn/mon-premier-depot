'use strict';
const fs = require('node:fs');
const path = require('node:path');

function defaults() {
  return {
    counters: { id: 100, order: 0 },
    settings: {
      name: 'Chez Demo',
      phone: '',
      timezone: 'Europe/Paris',
      open: '12:00',
      close: '23:00',
      slotMinutes: 30,
      durationMinutes: 90,
      closedDays: [],
      prepMinutes: 20,
      welcome: '',
    },
    tables: [
      { id: 1, name: 'T1', seats: 2 },
      { id: 2, name: 'T2', seats: 2 },
      { id: 3, name: 'T3', seats: 4 },
      { id: 4, name: 'T4', seats: 4 },
      { id: 5, name: 'T5', seats: 6 },
      { id: 6, name: 'T6', seats: 8 },
    ],
    menu: [
      { id: 1, name: 'Pizza Margherita', price: 11, available: true },
      { id: 2, name: 'Pizza Reine', price: 13.5, available: true },
      { id: 3, name: 'Burger maison', price: 14, available: true },
      { id: 4, name: 'Salade César', price: 12, available: true },
      { id: 5, name: 'Tiramisu', price: 6, available: true },
      { id: 6, name: 'Boisson', price: 3, available: true },
    ],
    reservations: [],
    orders: [],
    calls: [],
  };
}

class Store {
  constructor(file) {
    this.file = file; // null => mémoire seulement (tests)
    this.data = defaults();
    if (file && fs.existsSync(file)) {
      this.data = { ...defaults(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } else {
      this.save();
    }
  }
  nextId() {
    return ++this.data.counters.id;
  }
  nextOrderNumber() {
    return ++this.data.counters.order;
  }
  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, defaults };
