import { useEffect } from "react";
import { Footprints, Grid3x3, Play, Sparkles, Star } from "lucide-react";
import { Chip } from "@/components/ui/Theme";
import { LEVEL_KIND_LABEL, goalLines, levelKind } from "@/game/levelInfo";
import { getLevel, type LevelDef } from "@/game/levels";
import type { SaveData } from "@/game/save";

/**
 * Level preview bottom sheet: what the ward is, what to do, best stars, Start.
 * Free of map state so any screen (classic map, overworld) can render it.
 * Pass `level` to show a rolled or evolved ward instead of the scripted one.
 */
export function LevelSheet({ levelId, save, onPlay, onClose, level }: { levelId: number; save: SaveData; onPlay: () => void; onClose: () => void; level?: LevelDef }) {
  const shown = level ?? getLevel(levelId);
  const kind = levelKind(shown);
  const best = save.stars[String(levelId)] ?? 0;
  const score = save.best?.[String(levelId)] ?? 0;
  const goals = goalLines(shown);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sc-sheet-backdrop" onClick={onClose}>
      <div className="sc-sheet" role="dialog" aria-modal="true" aria-label={`${shown.name} preview`} onClick={(event) => event.stopPropagation()}>
        <div className="sc-sheet-grip" aria-hidden />
        <div className="sc-level-head">
          <span className={`sc-level-num ${kind}`}>{levelId}</span>
          <div>
            <span className={`sc-tag ${kind}`}>{LEVEL_KIND_LABEL[kind]}</span>
            <h3>{shown.name}</h3>
          </div>
          <div className="sc-level-best">
            <span className="sc-mini-stars" aria-label={`Best ${best} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <Star key={i} className={i < best ? "on" : ""} aria-hidden />
              ))}
            </span>
            {score ? `Best ${score.toLocaleString()}` : best ? null : "Not cleared yet"}
          </div>
        </div>
        <ul className="sc-level-goals" aria-label="Goals">
          {goals.map((goal) => (
            <li key={goal.key}>
              {goal.sprite ? <img src={goal.sprite} alt="" /> : <span className="sc-goal-dot" aria-hidden />}
              {goal.text}
            </li>
          ))}
        </ul>
        <div className="sc-level-facts">
          <Chip icon={<Footprints aria-hidden />}>{shown.moves} moves</Chip>
          <Chip icon={<Grid3x3 aria-hidden />}>{shown.rows}×{shown.cols}</Chip>
          {shown.shiftLabel ? <Chip icon={<Sparkles aria-hidden />}>{shown.shiftLabel}</Chip> : null}
          {shown.evolved ? <Chip tone="mint">Evolved</Chip> : null}
        </div>
        {shown.evolved?.note ? <p className="sc-level-note">{shown.evolved.note}</p> : null}
        <div className="sc-level-actions">
          <button className="btn opt-btn ghost" type="button" onClick={onClose}>Back</button>
          <button className="sc-cta" type="button" onClick={onPlay} autoFocus>
            <span className="sc-cta-main"><Play aria-hidden />{best ? "Replay" : "Start"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
