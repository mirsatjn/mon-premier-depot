// Fournisseurs et produits déjà intégrés à la boutique.
// Modifiez ce fichier pour ajouter vos vrais fournisseurs et produits.
const SUPPLIERS = [
  { id: "bio-terroir", name: "Bio Terroir", country: "France", delay: "2-3 jours", emoji: "🌿" },
  { id: "tech-asia", name: "TechAsia Distribution", country: "Chine", delay: "7-12 jours", emoji: "🔌" },
  { id: "maison-lisboa", name: "Maison Lisboa", country: "Portugal", delay: "3-5 jours", emoji: "🏺" },
];

const PRODUCTS = [
  { id: 1, supplier: "bio-terroir", name: "Miel de fleurs 500 g", price: 9.9, cost: 5.2, stock: 40, emoji: "🍯" },
  { id: 2, supplier: "bio-terroir", name: "Huile d'olive bio 1 L", price: 14.5, cost: 8.9, stock: 25, emoji: "🫒" },
  { id: 3, supplier: "bio-terroir", name: "Tisane détox", price: 6.9, cost: 2.8, stock: 60, emoji: "🍵" },
  { id: 4, supplier: "tech-asia", name: "Écouteurs Bluetooth", price: 24.9, cost: 9.5, stock: 100, emoji: "🎧" },
  { id: 5, supplier: "tech-asia", name: "Chargeur sans fil", price: 19.9, cost: 6.8, stock: 80, emoji: "🔋" },
  { id: 6, supplier: "tech-asia", name: "Support téléphone voiture", price: 12.9, cost: 3.4, stock: 150, emoji: "📱" },
  { id: 7, supplier: "maison-lisboa", name: "Tasse en céramique", price: 11.9, cost: 5.0, stock: 35, emoji: "☕" },
  { id: 8, supplier: "maison-lisboa", name: "Bougie parfumée", price: 16.9, cost: 7.2, stock: 50, emoji: "🕯️" },
  { id: 9, supplier: "maison-lisboa", name: "Plat en terre cuite", price: 29.9, cost: 14.0, stock: 12, emoji: "🍲" },
];
