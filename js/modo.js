import { findSet, loadAppData } from "./data.js";
import { params, qs } from "./util.js";

const root = qs("#app");
const setId = params().get("set");

try {
  const catalog = await loadAppData();
  const set = findSet(catalog, setId);
  if (!set) {
    root.innerHTML = `<div class="error">Ese set no existe. <a href="index.html">Volver</a></div>`;
  } else {
    root.innerHTML = `
      <div class="nav">
        <a href="index.html">Sets</a>
        <span class="dot">/</span>
        <span>${set.title}</span>
      </div>
      <p class="kicker">${set.blurb}</p>
      <h1>Cómo quieres jugar</h1>
      <p class="lede">Tres formas de preguntar sobre el mismo mapa mudo.</p>
      <div class="grid">
        ${catalog.modes.map((mode) => `
          <a class="card" href="jugar.html?set=${set.id}&mode=${mode.id}">
            <h2>${mode.title}</h2>
            <p>${mode.blurb}</p>
            <span class="go">Empezar →</span>
          </a>
        `).join("")}
      </div>
    `;
  }
} catch {
  root.innerHTML = `<div class="error">No se pudo cargar el JSON. Abre la carpeta con Live Server.</div>`;
}
