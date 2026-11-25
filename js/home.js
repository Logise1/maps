import { loadAppData } from "./data.js";
import { qs } from "./util.js";

const root = qs("#app");

try {
  const catalog = await loadAppData();
  root.innerHTML = `
    <p class="kicker">Mapa mudo</p>
    <h1>Elige un set</h1>
    <p class="lede">Países y capitales, sin nombres en el mapa. Luego eliges cómo preguntarte.</p>
    <div class="grid">
      ${catalog.sets.map((set) => `
        <a class="card" href="modo.html?set=${set.id}">
          <h2>${set.title}</h2>
          <p>${set.blurb}</p>
          <span class="go">Elegir modo →</span>
        </a>
      `).join("")}
    </div>
  `;
} catch {
  root.innerHTML = `<div class="error">No se pudo cargar <b>data/sets.json</b>. Abre esta carpeta con Live Server (o cualquier servidor local) y recarga.</div>`;
}
