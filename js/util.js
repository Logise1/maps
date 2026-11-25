export function params() {
  return new URLSearchParams(location.search);
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function norm(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matches(item, guess) {
  const g = norm(guess);
  if (!g) return false;
  if (g === norm(item.name)) return true;
  return (item.aliases || []).some((alias) => g === norm(alias));
}

export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(path);
  return res.json();
}

export function centroid(rings) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      x += lon;
      y += lat;
      n += 1;
    }
  }
  return n ? [x / n, y / n] : [0, 0];
}

export function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((poly) => poly[0]);
  }
  return [];
}
