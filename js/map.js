const SKIP_IDS = new Set([
  "svg3157", "namedview1", "title4", "defs3159", "clipPath7195", "rect7197",
  "style1", "layer1", "ocean", "country", "water_masses", "large_masses_of_water",
  "metadata1", "xb", "uk", "gb", "gb-gbn", "gb-land-clip", "gb-eng", "gb-sct",
  "gb-wls", "gb-nir", "gb-coastline", "dk_kingdom", "ru", "ru-main", "ru-kgd",
  "transnistria", "nagorno-karabakh", "Southamerica_Blank",
]);

const NAME_TO_ISO = {
  Peru: "PE",
  FrenchGuiana: "GF",
  Bolivia: "BO",
  Brazil: "BR",
  BrazilNorthIslands: "BR",
  BrazilSouthIslands: "BR",
  BrazilSoutheastIslands: "BR",
  BrazilEastIslands: "BR",
  Venezuela: "VE",
  Colombia: "CO",
  Argentina: "AR",
  Suriname: "SR",
  Ecuador: "EC",
  EcuadorIslands: "EC",
  FalklandIslands: "FK",
  Paraguay: "PY",
  Guyana: "GY",
  Uruguay: "UY",
  Chile: "CL",
  IslandsChile: "CL",
};

function isoFromId(raw) {
  if (!raw || SKIP_IDS.has(raw)) return null;
  if (NAME_TO_ISO[raw]) return NAME_TO_ISO[raw];
  if (/^[a-z]{2}$/.test(raw)) return raw.toUpperCase();
  return null;
}

function bboxPin(el, pin) {
  try {
    const bb = el.getBBox();
    if (!Number.isFinite(bb.x) || (bb.width <= 0 && bb.height <= 0)) return null;
    return {
      x: bb.x + bb.width * (pin ? pin[0] : 0.5),
      y: bb.y + bb.height * (pin ? pin[1] : 0.5),
    };
  } catch {
    return null;
  }
}

function markerHost(el) {
  return el.localName === "g" ? el : el.parentNode;
}

function localToUser(svg, host, x, y) {
  let pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  let node = host;
  while (node && node !== svg) {
    const list = node.transform?.baseVal;
    if (list && list.numberOfItems) {
      let m = svg.createSVGMatrix();
      for (let i = 0; i < list.numberOfItems; i += 1) {
        m = m.multiply(list.getItem(i).matrix);
      }
      pt = pt.matrixTransform(m);
    }
    node = node.parentElement;
  }
  return [pt.x, pt.y];
}

function userScale(svg, host) {
  let s = 1;
  let node = host;
  while (node && node !== svg) {
    const list = node.transform?.baseVal;
    if (list) {
      for (let i = 0; i < list.numberOfItems; i += 1) {
        const m = list.getItem(i).matrix;
        s *= Math.hypot(m.a, m.b);
      }
    }
    node = node.parentElement;
  }
  return s > 1e-8 ? s : 1;
}

function inViewBox(svg, x, y) {
  const vb = svg.viewBox.baseVal;
  return x >= vb.x && y >= vb.y && x <= vb.x + vb.width && y <= vb.y + vb.height;
}

function addMarker(host, x, y, r, className, id) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", x);
  c.setAttribute("cy", y);
  c.setAttribute("r", r);
  c.setAttribute("class", className);
  c.dataset.id = id;
  host.appendChild(c);
}

export async function renderMap(svg, set, mapCfg) {
  const res = await fetch(mapCfg.svg);
  if (!res.ok) throw new Error(mapCfg.svg);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("svg");
  const src = doc.documentElement;
  const width = parseFloat(src.getAttribute("width")) || 680;
  const height = parseFloat(src.getAttribute("height")) || 520;
  svg.setAttribute("viewBox", src.getAttribute("viewBox") || `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.replaceChildren();

  const sea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  sea.setAttribute("class", "sea");
  sea.setAttribute("x", 0);
  sea.setAttribute("y", 0);
  sea.setAttribute("width", width);
  sea.setAttribute("height", height);
  svg.appendChild(sea);

  for (const node of [...src.childNodes]) {
    if (node.nodeType !== 1) continue;
    const tag = node.localName;
    if (tag === "namedview" || tag === "metadata" || tag === "title") continue;
    const copy = document.importNode(node, true);
    copy.querySelectorAll?.("style").forEach((el) => el.remove());
    if (tag === "style" || copy.tagName === "style") continue;
    svg.appendChild(copy);
  }

  const xb = svg.querySelector("#xb");
  const cy = svg.querySelector("#cy");
  if (xb && cy && !xb.contains(cy)) xb.appendChild(cy);

  const playIds = new Set(set.items.map((item) => item.id));
  const byIso = {};

  svg.querySelectorAll("[id]").forEach((el) => {
    const iso = isoFromId(el.id);
    if (!iso) return;
    el.dataset.id = iso;
    el.classList.add("land");
    if (playIds.has(iso)) el.classList.add("is-play");
    if (!byIso[iso] || NAME_TO_ISO[el.id] && /Island/i.test(byIso[iso].id)) {
      byIso[iso] = el;
    }
  });

  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
  overlay.setAttribute("class", "overlay");
  svg.appendChild(overlay);

  const centers = {};
  const items = set.items;
  for (const item of items) {
    const el = byIso[item.id];
    if (!el) continue;
    const local = bboxPin(el, item.pin);
    if (!local) continue;
    const host = markerHost(el);
    const user = localToUser(svg, host, local.x, local.y);
    if (!inViewBox(svg, user[0], user[1])) continue;
    centers[item.id] = { user, local, host };
  }

  if (set.kind === "capital") {
    for (const item of items) {
      const c = centers[item.id];
      if (!c) continue;
      const r = (mapCfg.cityR || 4.2) / userScale(svg, c.host);
      addMarker(c.host, c.local.x, c.local.y, r, "city", item.id);
    }
  } else {
    for (const id of mapCfg.micro || []) {
      const c = centers[id];
      if (!c) continue;
      const r = (mapCfg.microR || 5) / userScale(svg, c.host);
      addMarker(c.host, c.local.x, c.local.y, r, "micro-dot is-play", id);
    }
  }

  return { centers, overlay };
}

export function markTarget(svg, id, kind) {
  clearMarks(svg, ["is-mark"]);
  const sel = kind === "capital"
    ? `.city[data-id="${id}"]`
    : `[data-id="${id}"]`;
  svg.querySelectorAll(sel).forEach((el) => el.classList.add("is-mark"));
}

export function setState(svg, id, state) {
  svg.querySelectorAll(`[data-id="${id}"]`).forEach((el) => {
    el.classList.remove("is-mark", "is-ok", "is-bad", "is-over");
    if (state) el.classList.add(state);
  });
}

export function clearMarks(svg, classes = ["is-mark", "is-bad"]) {
  svg.querySelectorAll(classes.map((c) => `.${c}`).join(",")).forEach((el) => {
    classes.forEach((c) => el.classList.remove(c));
  });
}

export function placeLabel(overlay, item, center) {
  const xy = center?.user || center;
  if (!xy) return;
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", xy[0]);
  label.setAttribute("y", xy[1] - 6);
  label.setAttribute("class", "placed-label");
  label.textContent = item.name;
  overlay.appendChild(label);
}

export function hitId(target) {
  const el = target.closest ? target.closest("[data-id]") : null;
  return el ? el.dataset.id : null;
}
