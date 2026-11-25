import { loadJSON } from "./util.js";

export async function loadAppData() {
  const catalog = await loadJSON("data/sets.json");
  return catalog;
}

export function findSet(catalog, id) {
  return catalog.sets.find((set) => set.id === id);
}

export function findMode(catalog, id) {
  return catalog.modes.find((mode) => mode.id === id);
}
