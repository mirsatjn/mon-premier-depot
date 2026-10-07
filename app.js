const euro = (n) => n.toFixed(2).replace(".", ",") + " €";
const supplierById = (id) => SUPPLIERS.find((s) => s.id === id);

let filter = "all";
const cart = {}; // productId -> quantité

function renderSuppliers() {
  const el = document.getElementById("suppliers");
  const chip = (id, label, extra = "") =>
    `<button class="chip ${filter === id ? "active" : ""}" data-supplier="${id}">${label}${extra}</button>`;
  el.innerHTML =
    chip("all", "Tous") +
    SUPPLIERS.map((s) =>
      chip(s.id, `${s.emoji} ${s.name}`, `<small>${s.country} · ${s.delay}</small>`)
    ).join("");
}

function renderProducts() {
  const list = PRODUCTS.filter((p) => filter === "all" || p.supplier === filter);
  document.getElementById("products").innerHTML = list
    .map((p) => {
      const s = supplierById(p.supplier);
      const out = p.stock - (cart[p.id] || 0) <= 0;
      return `<article class="card">
        <div class="emoji">${p.emoji}</div>
        <h3>${p.name}</h3>
        <p class="supplier">Fournisseur : ${s.name}</p>
        <p class="price">${euro(p.price)}</p>
        <button data-add="${p.id}" ${out ? "disabled" : ""}>${out ? "Rupture" : "Ajouter"}</button>
      </article>`;
    })
    .join("");
}

function renderCart() {
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  let total = 0;
  document.getElementById("cart-items").innerHTML = ids.length
    ? ids
        .map((id) => {
          const p = PRODUCTS.find((x) => x.id == id);
          total += p.price * cart[id];
          return `<li>${p.emoji} ${p.name} × ${cart[id]}
            <span>${euro(p.price * cart[id])}
            <button class="mini" data-remove="${id}">−</button></span></li>`;
        })
        .join("")
    : "<li>Panier vide</li>";
  document.getElementById("cart-total").textContent = euro(total);
  document.getElementById("cart-count").textContent = ids.reduce((n, id) => n + cart[id], 0);
}

function checkout() {
  // Une commande est répartie automatiquement par fournisseur.
  const bySupplier = {};
  for (const id in cart) {
    if (cart[id] <= 0) continue;
    const p = PRODUCTS.find((x) => x.id == id);
    (bySupplier[p.supplier] ||= []).push(`${cart[id]} × ${p.name}`);
  }
  const lines = Object.entries(bySupplier).map(
    ([sid, items]) => `→ ${supplierById(sid).name} : ${items.join(", ")}`
  );
  if (!lines.length) return alert("Votre panier est vide.");
  alert("Commande envoyée aux fournisseurs :\n\n" + lines.join("\n"));
  for (const id in cart) delete cart[id];
  refresh();
}

function refresh() {
  renderSuppliers();
  renderProducts();
  renderCart();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.supplier) { filter = t.dataset.supplier; refresh(); }
  else if (t.dataset.add) { cart[t.dataset.add] = (cart[t.dataset.add] || 0) + 1; refresh(); }
  else if (t.dataset.remove) { cart[t.dataset.remove]--; refresh(); }
  else if (t.id === "cart-btn") document.getElementById("cart").hidden = false;
  else if (t.id === "cart-close") document.getElementById("cart").hidden = true;
  else if (t.id === "checkout") checkout();
});

refresh();
