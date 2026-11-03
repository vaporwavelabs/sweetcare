/**
 * Character evolution UI: the evolved avatar frame, the evolution cutscene,
 * the Care Points card on the result screen, the challenge chip in the HUD,
 * and the evolution track on the profile. Logic lives in src/game/evolution.ts.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DocAvatar } from "@/components/Profile";
import { haptic } from "@/game/haptics";
import { sfxSpecial, sfxSummon, sfxWow, unlockAudio } from "@/game/audio";
import { rewardText } from "@/game/rewards";
import type { Career } from "@/game/profile";
import {
  STAGES,
  stageProgress,
  type CarePoints,
  type Challenge,
  type Evolution,
  type Stage,
} from "@/game/evolution";

function auraStyle(stage: Stage): CSSProperties {
  return { "--aura-in": stage.aura[0], "--aura-out": stage.aura[1] } as CSSProperties;
}

/**
 * Wraps any picture of the nurse in her evolution look: aura, halo, wings and emblem.
 * The map walker can wrap its own sprite with this.
 */
export function EvoFrame({
  stage,
  children,
  badge = true,
  className = "",
}: {
  stage: number;
  children: ReactNode;
  badge?: boolean;
  className?: string;
}) {
  const info = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))]!;
  return (
    <span className={`evo evo-s${info.index} ${className}`} style={auraStyle(info)} data-stage={info.id}>
      {info.index > 0 ? <span className="evo-aura" aria-hidden /> : null}
      {info.index >= 4 ? <span className="evo-wings" aria-hidden><i /><i /></span> : null}
      {children}
      {info.index >= 3 ? <span className="evo-halo" aria-hidden /> : null}
      {info.index >= 2 ? (
        <span className="evo-sparks" aria-hidden>
          <i /><i /><i /><i />
        </span>
      ) : null}
      {badge && info.index > 0 ? (
        <span className="evo-badge" title={info.title} aria-label={info.title}>
          {info.emblem}
        </span>
      ) : null}
    </span>
  );
}

/** DocAvatar in its evolution frame. */
export function EvolvedAvatar({
  career,
  evolution,
  className = "",
  badge = true,
}: {
  career: Career;
  evolution: Evolution;
  className?: string;
  badge?: boolean;
}) {
  return (
    <EvoFrame stage={evolution.stage} badge={badge} className={className}>
      <DocAvatar career={career} />
    </EvoFrame>
  );
}

/** XP bar that fills from the old total to the new one. */
function XpBar({ from, to }: { from: number; to: number }) {
  const [xp, setXp] = useState(from);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setXp(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + 350;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / 1100));
      setXp(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  const progress = stageProgress(xp);
  return (
    <div className="evo-xp">
      <div className="evo-xp-head">
        <b>{progress.stage.title}</b>
        <span>{progress.next ? `${progress.into.toLocaleString()} / ${progress.span.toLocaleString()} CP` : `${xp.toLocaleString()} CP · max`}</span>
      </div>
      <div className="evo-xp-bar" aria-hidden>
        <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </div>
      {progress.next ? <small>Next: {progress.next.title}</small> : null}
    </div>
  );
}

/** The Care Points block on the result card. */
export function CareCard({
  points,
  before,
  after,
  challenge,
  challengeDone,
}: {
  points: CarePoints;
  before: number;
  after: Evolution;
  challenge: Challenge | null;
  challengeDone: boolean;
}) {
  const mults: string[] = [];
  if (points.streakMult > 1) mults.push(`Streak ${after.streak} · x${points.streakMult.toFixed(1)}`);
  if (points.auraMult > 1) mults.push(`Healing aura · x${points.auraMult}`);
  return (
    <div className="care-card" aria-label={`${points.total} care points earned`}>
      <span className="kicker">Care points</span>
      <ul>
        {points.lines.map((line) => (
          <li key={line.label} className={challenge && line.label === challenge.label ? "challenge" : ""}>
            <span>{line.label}</span>
            <b>+{line.points}</b>
          </li>
        ))}
      </ul>
      {challenge && !challengeDone ? <p className="care-missed">Bonus missed · {challenge.label}</p> : null}
      {mults.length ? <p className="care-mult">{mults.join(" · ")}</p> : null}
      <p className="care-total">+{points.total} CP</p>
      <XpBar from={before} to={after.xp} />
    </div>
  );
}

/** Small HUD pill with the ward's bonus challenge. */
export function ChallengeChip({ challenge, done }: { challenge: Challenge; done: boolean }) {
  return (
    <div className={done ? "challenge-chip done" : "challenge-chip"} role="status" aria-label={`Bonus: ${challenge.label}${done ? ", done" : ""}`}>
      <i aria-hidden>{done ? "✓" : "★"}</i>
      <span>{challenge.label}</span>
      <b>+{challenge.points}</b>
    </div>
  );
}

/**
 * The evolution cutscene. Plays once when a round pushes the nurse into a new stage.
 * charge: old look glows and shakes. burst: white flash. reveal: new look, title, ability and reward.
 */
export function EvolutionCutscene({
  career,
  from,
  to,
  onDone,
}: {
  career: Career;
  from: number;
  to: Stage[];
  onDone: () => void;
}) {
  const top = to[to.length - 1]!;
  const [beat, setBeat] = useState<"charge" | "burst" | "reveal">("charge");
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setBeat("reveal");
      return;
    }
    try {
      unlockAudio();
      sfxSummon();
    } catch {
      /* audio is optional */
    }
    const a = window.setTimeout(() => {
      setBeat("burst");
      try {
        sfxSpecial();
      } catch {
        /* audio is optional */
      }
      haptic("win");
    }, 1500);
    const b = window.setTimeout(() => {
      setBeat("reveal");
      try {
        sfxWow();
      } catch {
        /* audio is optional */
      }
    }, 1900);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);
  const shown = beat === "reveal" ? top.index : from;
  const rewards = to.map((stage) => rewardText(stage.reward)).filter(Boolean);
  return (
    <div className={`evo-cutscene beat-${beat}`} role="dialog" aria-label={`Evolved into ${top.title}`} onClick={beat === "reveal" ? undefined : () => setBeat("reveal")}>
      <div className="evo-rays" aria-hidden />
      <div className="evo-stage-wrap">
        <EvoFrame stage={shown} className="evo-hero">
          <DocAvatar career={career} />
        </EvoFrame>
      </div>
      <div className="evo-flash" aria-hidden />
      {beat === "reveal" ? (
        <div className="evo-reveal">
          <span className="kicker">Evolution</span>
          <h2>{top.title}</h2>
          <p className="evo-look">{top.look}</p>
          {to.filter((stage) => stage.ability).map((stage) => (
            <div key={stage.id} className="evo-ability">
              <b>New ability · {stage.ability!.label}</b>
              <span>{stage.ability!.blurb}</span>
            </div>
          ))}
          {rewards.length ? <p className="evo-reward">Promotion gift: {rewards.join(" + ")}</p> : null}
          <button className="btn" type="button" onClick={onDone}>Continue</button>
        </div>
      ) : (
        <p className="evo-hint">Something is happening…</p>
      )}
    </div>
  );
}

/** The five stages laid out on the profile, with the current one lit. */
export function EvolutionTrack({ career, evolution }: { career: Career; evolution: Evolution }) {
  const progress = stageProgress(evolution.xp);
  return (
    <div className="evo-track-card">
      <div className="evo-track-hero">
        <EvolvedAvatar career={career} evolution={evolution} className="evo-profile" />
        <div>
          <span className="kicker">Evolution</span>
          <h4>{progress.stage.title}</h4>
          <p>{progress.stage.look}</p>
          <p className="evo-stats">
            {evolution.xp.toLocaleString()} CP · best streak {evolution.bestStreak} · {evolution.challenges} bonus goals
          </p>
        </div>
      </div>
      <XpBar from={evolution.xp} to={evolution.xp} />
      <ol className="evo-track">
        {STAGES.map((stage) => {
          const state = stage.index < evolution.stage ? "done" : stage.index === evolution.stage ? "now" : "locked";
          return (
            <li key={stage.id} className={state} style={auraStyle(stage)}>
              <span className="evo-pip" aria-hidden>{stage.emblem}</span>
              <b>{stage.title}</b>
              <small>{stage.need === 0 ? "Start" : `${stage.need.toLocaleString()} CP`}</small>
              {stage.ability ? <em>{stage.ability.label}: {stage.ability.blurb}</em> : <em>Every nurse starts here.</em>}
            </li>
          );
        })}
      </ol>
      <p className="rank-note">Care points come from every ward: clears, stars, combos, spare moves and the bonus goal. Wins in a row multiply them up to x1.5.</p>
    </div>
  );
}
