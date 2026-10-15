/**
 * Armor is earned by holding. It is worked out from the first buy alone, so it needs nothing from
 * the engine and it can't be bought: only time gives it. Selling ends the run anyway.
 */
export interface Tier {
  name: string;
  /** Days held to wear it. */
  days: number;
  main: string;
  dark: string;
}

export const ARMOR: Tier[] = [
  { name: "No armor", days: 0, main: "", dark: "" },
  { name: "Leather", days: 1, main: "#a0683a", dark: "#6b4022" },
  { name: "Iron", days: 7, main: "#dcdce2", dark: "#9a9aa6" },
  { name: "Gold", days: 30, main: "#f2c230", dark: "#c4931a" },
  { name: "Diamond", days: 90, main: "#4fe0d4", dark: "#2fb8ad" },
];

/** Which armor a wallet wears now (0 = none). `firstIn` and `now` are unix seconds. */
export function armorOf(firstIn: number, now = Date.now() / 1000) {
  if (!firstIn) return 0;
  const days = (now - firstIn) / 86400;
  let tier = 0;
  ARMOR.forEach((a, i) => days >= a.days && (tier = i));
  return tier;
}

/** The next armor and the moment it is earned, or null at the top. */
export function nextArmor(firstIn: number, now = Date.now() / 1000) {
  const tier = armorOf(firstIn, now);
  const next = ARMOR[tier + 1];
  return next && firstIn ? { tier: tier + 1, at: firstIn + next.days * 86400 } : null;
}
