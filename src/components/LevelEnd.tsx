/**
 * The end of a level: the "Level complete!" beat that plays over the slowed board,
 * and the big progress bar on the result card. Styles live in src/level-end.css.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Star } from "lucide-react";
import { STAGES, stageIndexFor, stageProgress } from "@/game/evolution";
import { motionReduced } from "@/game/prefs";

/**
 * Plays over the board for a couple of seconds after the last move, before the result card.
 * The board itself slows down through the `.slowmo` class on the play column.
 */
export function LevelComplete({
  won,
  name,
  reason,
  stars,
  bonus,
  onSkip,
}: {
  won: boolean;
  name: string;
  reason: string | null;
  stars: number;
  bonus: number;
  onSkip: () => void;
}) {
  const words = won ? ["Level", "complete!"] : reason ? [reason] : ["Out of", "moves"];
  let letter = 0;
  return (
    <button type="button" className={`level-end${won ? " won" : " lost"}`} onClick={onSkip} aria-label={won ? `Level complete. ${name}. Tap to see results` : "Out of moves. Tap to see results"}>
      <span className="level-end-veil" aria-hidden />
      {won ? <span className="level-end-rays" aria-hidden /> : null}
      {won ? <span className="level-end-ring" aria-hidden /> : null}
      <span className="level-end-copy" aria-hidden>
        <span className="level-end-title">
          {words.map((word, w) => (
            <span key={w} className="level-end-word">
              {Array.from(word).map((ch, i) => {
                const index = letter++;
                return (
                  <i key={i} style={{ "--i": index } as CSSProperties}>{ch === " " ? " " : ch}</i>
                );
              })}
            </span>
          ))}
        </span>
        <span className="level-end-name">{name}</span>
        {won ? (
          <span className="level-end-stars">
            {[0, 1, 2].map((index) => (
              <Star key={index} className={index < stars ? "on" : ""} style={{ "--i": index } as CSSProperties} />
            ))}
          </span>
        ) : null}
        {won && bonus > 0 ? <span className="level-end-bonus">+{bonus.toLocaleString()} move bonus</span> : null}
      </span>
      {won ? <Sparks /> : null}
      <span className="level-end-hint" aria-hidden>Tap to continue</span>
    </button>
  );
}

/** Soft glowing motes that drift up slowly behind the title. */
function Sparks() {
  const bits = useRef(
    Array.from({ length: 26 }, (_, id) => ({
      id,
      left: 6 + ((id * 37) % 88),
      size: 0.35 + ((id * 7) % 5) * 0.14,
      delay: (id % 9) * 0.18,
      dur: 2.4 + (id % 4) * 0.5,
      drift: ((id % 5) - 2) * 0.9,
      hue: id % 3,
    })),
  ).current;
  return (
    <span className="level-end-sparks" aria-hidden>
      {bits.map((bit) => (
        <i
          key={bit.id}
          className={`h${bit.hue}`}
          style={{
            left: `${bit.left}%`,
            width: `${bit.size}rem`,
            height: `${bit.size}rem`,
            animationDelay: `${bit.delay}s`,
            animationDuration: `${bit.dur}s`,
            "--drift": `${bit.drift}rem`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

/**
 * The nurse's progress to her next level (evolution stage), filled from the old
 * Care Points total to the new one. Crossing a stage fills to the end, flashes "Level up!", then carries on.
 */
export function StageBar({ from, to, gained }: { from: number; to: number; gained: number }) {
  const [xp, setXp] = useState(from);
  useEffect(() => {
    if (motionReduced() || to <= from) {
      setXp(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + 750;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / 1500));
      setXp(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  const progress = stageProgress(xp);
  const leveled = stageIndexFor(xp) > stageIndexFor(from);
  const filling = xp !== to;
  const pct = Math.round(progress.ratio * 100);
  const left = progress.next ? Math.max(0, progress.next.need - xp) : 0;
  const stage = progress.stage;
  const tone = { "--evo-a": STAGES[stage.index]!.aura[0], "--evo-glow": progress.next ? STAGES[progress.next.index]!.aura[0] : "#ffd25a" } as CSSProperties;
  return (
    <div className={`stage-bar rise${filling ? " filling" : ""}${leveled ? " leveled" : ""}`} style={tone} role="meter" aria-label={progress.next ? `${progress.into} of ${progress.span} care points to ${progress.next.title}` : `${stage.title}, top level`} aria-valuemin={0} aria-valuemax={progress.span || 1} aria-valuenow={progress.next ? progress.into : 1}>
      <div className="stage-bar-head">
        <span className="stage-badge" aria-hidden>{stage.emblem}</span>
        <span className="stage-names">
          <small>Nurse level {stage.index + 1}</small>
          <b>{stage.title}</b>
        </span>
        {gained > 0 ? <span className="stage-gain">+{gained.toLocaleString()} CP</span> : null}
      </div>
      <div className="stage-track">
        <span className="stage-fill" style={{ width: `${pct}%` }}>
          <span className="stage-shine" />
          {pct > 2 && pct < 100 ? <span className="stage-head" /> : null}
        </span>
        <span className="stage-ticks" aria-hidden>
          <i /><i /><i />
        </span>
      </div>
      <div className="stage-foot">
        {progress.next ? (
          <>
            <span>{progress.into.toLocaleString()} / {progress.span.toLocaleString()} CP</span>
            <span className="stage-next">{left.toLocaleString()} to <b>{progress.next.title}</b> {progress.next.emblem}</span>
          </>
        ) : (
          <span>{xp.toLocaleString()} CP · top level reached</span>
        )}
      </div>
      {leveled ? <span className="stage-up">Level up!</span> : null}
    </div>
  );
}
