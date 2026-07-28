/**
 * Module-selection logic for the Source panel's "specific modules" pickers
 * (stack and file). Self-contained — takes a minimal `{ key, dependsOn }` shape
 * so it stays independent of the store slice.
 */
export interface ModuleLike {
  key: string;
  dependsOn: string[];
}

/**
 * Toggles a module in the selection, honoring dependency edges (FR-3.6):
 * - selecting a module auto-selects its (transitive) dependencies;
 * - a dependency cannot be unselected while a dependent remains selected.
 */
export const toggleModule = (
  modules: ModuleLike[],
  selected: string[],
  key: string
): string[] => {
  if (selected.includes(key)) {
    const blocked = modules.some(
      (m) => selected.includes(m.key) && m.dependsOn.includes(key)
    );
    if (blocked) return selected; // required by a selected dependent
    return selected.filter((k) => k !== key);
  }

  const next = new Set(selected);
  const add = (k: string) => {
    if (next.has(k)) return;
    next.add(k);
    modules.find((m) => m.key === k)?.dependsOn.forEach(add);
  };
  add(key);
  return [...next];
};

/** Keys that are currently forced (a selected module depends on them). */
export const forcedKeys = (
  modules: ModuleLike[],
  selected: string[]
): Set<string> => {
  const forced = new Set<string>();
  for (const m of modules) {
    if (!selected.includes(m.key)) continue;
    for (const dep of m.dependsOn) if (selected.includes(dep)) forced.add(dep);
  }
  return forced;
};
