import type { Kind } from "./engine.ts";
import type { LevelDef } from "./levels.ts";

/** Plain-language facts about a level for menus, previews and the map. */

export type LevelKind = "boss" | "microbe" | "heal" | "ward" | "main";

export function levelKind(level: LevelDef): LevelKind {
  if (level.bossHp) return "boss";
  if (level.encounter === "microbe") return "microbe";
  if (level.encounter === "heal") return "heal";
  if (level.id >= 16 && level.id <= 25) return "ward";
  return "main";
}

export const LEVEL_KIND_LABEL: Record<LevelKind, string> = {
  boss: "Boss",
  microbe: "Microbes",
  heal: "Healing",
  ward: "Side ward",
  main: "Shift",
};

const KIND_NAME: Partial<Record<Kind, string>> = {
  heart: "hearts",
  cross: "crosses",
  pill: "pills",
  bandage: "bandages",
  nurse: "nurse caps",
  kit: "kits",
  teddy: "teddies",
  diaper: "diapers",
  bottle: "bottles",
  pacifier: "pacifiers",
  gift: "gifts",
  rattle: "rattles",
};

export interface GoalLine {
  key: string;
  text: string;
  sprite?: string;
}

/** Plain-language goals for a level, for previews and briefings. */
export function goalLines(level: LevelDef): GoalLine[] {
  if (level.bossHp) return [{ key: "boss", text: `Drain ${level.boss && level.boss !== level.name ? level.boss : "the boss"} (${level.bossHp} HP)`, sprite: "/sprites/karen.png" }];
  if (level.encounter === "microbe") return [{ key: "germs", text: `Fight off ${level.swarm?.count ?? "the"} microbes`, sprite: "/sprites/germ-1.png" }];
  if (level.encounter === "heal") return [{ key: "heal", text: `Heal the ${level.patient ?? "patient"}`, sprite: level.patient === "brain" ? "/sprites/brain.png" : "/sprites/organ-heart.png" }];
  return level.goals.map((goal, index) => {
    const key = `${goal.type}-${index}`;
    switch (goal.type) {
      case "score":
        return { key, text: `Score ${goal.target.toLocaleString()} points`, sprite: "/sprites/badge.png" };
      case "collect":
        return { key, text: `Collect ${goal.count} ${KIND_NAME[goal.kind] ?? goal.kind}`, sprite: `/sprites/${goal.kind}.png` };
      case "jelly":
        return { key, text: "Clear all the jelly" };
      case "wraps":
        return { key, text: "Peel every bandage wrap", sprite: "/sprites/wrap.png" };
      case "contagion":
        return { key, text: "Clean every infected cell", sprite: "/sprites/biohaz.png" };
      case "fevers":
        return { key, text: `Treat ${goal.count} fevers` };
    }
  });
}
