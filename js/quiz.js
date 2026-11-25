import { findMode, findSet, loadAppData } from "./data.js";
import {
  clearMarks,
  hitId,
  markTarget,
  placeLabel,
  renderMap,
  setState,
} from "./map.js";
import { matches, params, qs, shuffle } from "./util.js";

const root = qs("#app");

function fail(msg) {
  root.innerHTML = `<div class="error">${msg}</div>`;
}

function layout(set, mode, extra = "") {
  return `
    <div class="nav">
      <a href="index.html">Sets</a>
      <span class="dot">/</span>
      <a href="modo.html?set=${set.id}">${set.title}</a>
      <span class="dot">/</span>
      <span>${mode.title}</span>
    </div>
    <div class="stage">
      <div class="map-frame"><svg id="map" viewBox="0 0 800 620"></svg></div>
      <aside class="panel" id="panel">${extra}</aside>
    </div>
  `;
}

function scoreLine(done, total, misses) {
  return `<div class="score"><span>${done} / ${total}</span><span>${misses} fallo${misses === 1 ? "" : "s"}</span></div>`;
}

function endScreen(set, mode, total, misses) {
  const ok = total - Math.min(misses, total);
  qs("#panel").innerHTML = `
    <div class="done">
      <p class="kicker">Fin</p>
      <p class="big">${ok}/${total}</p>
      <p class="meta">${misses} fallo${misses === 1 ? "" : "s"} en ${mode.title.toLowerCase()}.</p>
      <div class="row">
        <a class="btn" href="jugar.html?set=${set.id}&mode=${mode.id}">Otra vez</a>
        <a class="btn ghost" href="modo.html?set=${set.id}">Cambiar modo</a>
      </div>
    </div>
  `;
}

function startWrite(svg, set, mode, map) {
  const queue = shuffle(set.items);
  let i = 0;
  let misses = 0;
  const panel = qs("#panel");

  const show = () => {
    if (i >= queue.length) {
      clearMarks(svg);
      endScreen(set, mode, queue.length, misses);
      return;
    }
    const item = queue[i];
    markTarget(svg, item.id, set.kind);
    panel.innerHTML = `
      ${scoreLine(i, queue.length, misses)}
      <p class="prompt">${set.promptWrite}</p>
      <form class="answer">
        <input name="guess" autocomplete="off" autofocus placeholder="Escribe el nombre">
        <button class="btn" type="submit">Ok</button>
      </form>
      <p class="feedback" id="fb"></p>
      <div class="row">
        <button class="btn ghost" type="button" id="skip">Saltar</button>
      </div>
    `;
    const form = panel.querySelector("form");
    const input = form.guess;
    input.focus();
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fb = qs("#fb");
      if (matches(item, input.value)) {
        fb.className = "feedback ok";
        fb.textContent = item.name;
        setState(svg, item.id, "is-ok");
        i += 1;
        setTimeout(show, 420);
      } else {
        misses += 1;
        fb.className = "feedback bad";
        fb.textContent = "No. Prueba otra vez.";
        input.select();
      }
    });
    qs("#skip").addEventListener("click", () => {
      misses += 1;
      qs("#fb").className = "feedback";
      qs("#fb").textContent = item.name;
      i += 1;
      setTimeout(show, 700);
    });
  };
  show();
}

function startClick(svg, set, mode) {
  const queue = shuffle(set.items);
  let i = 0;
  let misses = 0;
  let locked = false;
  const panel = qs("#panel");

  const show = () => {
    locked = false;
    clearMarks(svg, ["is-mark", "is-bad"]);
    if (i >= queue.length) {
      endScreen(set, mode, queue.length, misses);
      return;
    }
    const item = queue[i];
    panel.innerHTML = `
      ${scoreLine(i, queue.length, misses)}
      <p class="prompt">${set.promptClick} <b>${item.name}</b></p>
      <p class="meta">Pulsa en el mapa.</p>
      <p class="feedback" id="fb"></p>
    `;
  };

  svg.addEventListener("click", (ev) => {
    if (locked || i >= queue.length) return;
    const id = hitId(ev.target);
    if (!id || !set.items.some((it) => it.id === id)) return;
    const item = queue[i];
    if (id === item.id) {
      setState(svg, id, "is-ok");
      qs("#fb").className = "feedback ok";
      qs("#fb").textContent = "Sí.";
      locked = true;
      i += 1;
      setTimeout(show, 420);
    } else {
      misses += 1;
      setState(svg, id, "is-bad");
      qs("#fb").className = "feedback bad";
      qs("#fb").textContent = "Ahí no.";
      setTimeout(() => setState(svg, id, ""), 420);
    }
  });
  show();
}

function startDrag(svg, set, mode, map) {
  const left = shuffle(set.items);
  const placed = new Set();
  let misses = 0;
  const panel = qs("#panel");

  panel.innerHTML = `
    ${scoreLine(0, left.length, 0)}
    <p class="prompt">Mapa mudo</p>
    <p class="meta">Arrastra cada nombre a su sitio.</p>
    <div class="chips" id="chips"></div>
  `;
  const chips = qs("#chips");
  left.forEach((item) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.textContent = item.name;
    el.dataset.id = item.id;
    chips.appendChild(el);
  });

  const refresh = () => {
    qs(".score").outerHTML = scoreLine(placed.size, left.length, misses);
    if (placed.size === left.length) endScreen(set, mode, left.length, misses);
  };

  let drag = null;
  chips.addEventListener("pointerdown", (ev) => {
    const chip = ev.target.closest(".chip");
    if (!chip || chip.classList.contains("is-gone")) return;
    ev.preventDefault();
    const ghost = chip.cloneNode(true);
    ghost.classList.add("ghost");
    document.body.appendChild(ghost);
    chip.style.opacity = "0.35";
    drag = { chip, ghost, id: chip.dataset.id };
    moveGhost(ev);
    ghost.setPointerCapture?.(ev.pointerId);
  });

  function moveGhost(ev) {
    if (!drag) return;
    drag.ghost.style.left = `${ev.clientX - 40}px`;
    drag.ghost.style.top = `${ev.clientY - 16}px`;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    svg.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    const id = hitId(under);
    if (id) svg.querySelectorAll(`[data-id="${id}"]`).forEach((el) => el.classList.add("is-over"));
  }

  window.addEventListener("pointermove", moveGhost);
  window.addEventListener("pointerup", (ev) => {
    if (!drag) return;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const id = hitId(under);
    const ok = id === drag.id && set.items.some((it) => it.id === id);
    drag.ghost.remove();
    drag.chip.style.opacity = "";
    svg.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    if (ok) {
      drag.chip.classList.add("is-gone");
      placed.add(id);
      setState(svg, id, "is-ok");
      const item = set.items.find((it) => it.id === id);
      placeLabel(map.overlay, item, map.centers[id]);
    } else if (id) {
      misses += 1;
      setState(svg, id, "is-bad");
      setTimeout(() => {
        if (!placed.has(id)) setState(svg, id, "");
      }, 350);
    }
    drag = null;
    refresh();
  });
}

async function main() {
  const q = params();
  const setId = q.get("set");
  const modeId = q.get("mode");
  if (!setId || !modeId) {
    location.replace("index.html");
    return;
  }
  let catalog;
  try {
    catalog = await loadAppData();
  } catch {
    fail("No se pudo leer data/sets.json. Abre la carpeta con Live Server.");
    return;
  }
  const set = findSet(catalog, setId);
  const mode = findMode(catalog, modeId);
  if (!set || !mode) {
    fail("Ese set o modo no existe.");
    return;
  }
  const mapCfg = catalog.maps[set.map];
  root.innerHTML = layout(set, mode, `<p class="meta">Cargando mapa…</p>`);
  const svg = qs("#map");
  let map;
  try {
    map = await renderMap(svg, set, mapCfg);
  } catch {
    fail("No se pudo cargar el mapa mudo. Abre la carpeta con Live Server.");
    return;
  }
  if (mode.id === "escribir") startWrite(svg, set, mode, map);
  else if (mode.id === "clicar") startClick(svg, set, mode, map);
  else startDrag(svg, set, mode, map);
}

main();
