import { useEffect, useMemo, useRef, useState } from "react";
import { ACTOR_NAMES, SCENES, lineFor, stageAt, type ActorId, type SceneId } from "@/game/cutscenes";
import { playSfx } from "@/game/sfx";
import { motionReduced } from "@/game/prefs";

const ACTOR_SRC: Record<Exclude<ActorId, "you">, string> = {
  teddy: "/sprites/teddy.png",
  karen: "/sprites/karen.png",
  germ: "/sprites/germ-boss.png",
};

/** Characters per second for the typewriter. */
const TYPE_RATE = 48;

/**
 * Plays one story scene over whatever screen is underneath. Tap or press Space to advance,
 * Escape or the Skip button to leave. With reduced motion the text appears at once and the
 * stage stays still.
 */
export function Cutscene({ id, name, portraitSrc, onDone }: { id: SceneId; name: string; portraitSrc: string; onDone: () => void }) {
  const scene = SCENES[id];
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const beat = scene.beats[Math.min(index, scene.beats.length - 1)]!;
  const text = beat.line ? lineFor(beat.line, name) : "";
  const still = motionReduced();
  const full = typed >= text.length;
  const stage = stageAt(scene, index);
  const prev = index > 0 ? stageAt(scene, index - 1) : { left: null, right: null };
  const bg = useMemo(() => {
    let current = scene.bg;
    for (let i = 0; i <= index; i++) current = scene.beats[i]?.bg ?? current;
    return current;
  }, [scene, index]);

  // Each beat: its sound, then the typewriter.
  useEffect(() => {
    if (beat.sfx) playSfx(beat.sfx);
    if (beat.card) playSfx("cut.whoosh", { gain: 0.7 });
    if (still || !text) {
      setTyped(text.length);
      return;
    }
    setTyped(0);
    let shown = 0;
    const timer = window.setInterval(() => {
      shown += 1;
      setTyped(shown);
      if (shown % 3 === 0 && text[shown - 1] !== " ") playSfx("cut.blip", { index: shown, pitch: beat.speaker === "karen" ? 0.8 : beat.speaker === "germ" ? 0.6 : beat.speaker === "teddy" ? 0.92 : 1.1 });
      if (shown >= text.length) window.clearInterval(timer);
    }, 1000 / TYPE_RATE);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, index]);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => doneRef.current(), still ? 0 : 320);
  };

  const advance = () => {
    if (leaving) return;
    if (!full) {
      setTyped(text.length);
      return;
    }
    if (index >= scene.beats.length - 1) {
      finish();
      return;
    }
    playSfx("ui.tap", { gain: 0.6 });
    setIndex((n) => n + 1);
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        advanceRef.current();
      } else if (event.key === "Escape") finishRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actorAt = (side: "left" | "right") => {
    const who = stage[side];
    const was = prev[side];
    const exiting = was && was !== who && beat.pose?.[was] === "exit" ? was : null;
    return (
      <>
        {exiting ? <Actor key={`${exiting}-out`} who={exiting} side={side} pose="exit" portraitSrc={portraitSrc} talking={false} /> : null}
        {who ? <Actor key={who} who={who} side={side} pose={beat.pose?.[who]} portraitSrc={portraitSrc} talking={beat.speaker === who && !full} dim={Boolean(beat.speaker && beat.speaker !== who)} /> : null}
      </>
    );
  };

  return (
    <div className={`cutscene${leaving ? " leaving" : ""}${beat.fx ? ` fx-${beat.fx}` : ""}`} role="dialog" aria-modal="true" aria-label={scene.title} onClick={advance}>
      <div className="cut-bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden />
      <div className="cut-vignette" aria-hidden />
      <div className="cut-bar top" aria-hidden />
      <div className="cut-bar bottom" aria-hidden />
      {beat.fx ? <SceneFx key={`${index}-${beat.fx}`} fx={beat.fx} /> : null}
      <div className="cut-stage">
        {actorAt("left")}
        {actorAt("right")}
      </div>
      {beat.card ? (
        <div key={`card-${index}`} className={`cut-card tone-${beat.card.tone}`}>
          <span className="cut-kicker">{beat.card.kicker}</span>
          <strong>{beat.card.title}</strong>
        </div>
      ) : null}
      {text ? (
        <div key={`say-${index}`} className={`cut-say${beat.speaker ? ` from-${beat.speaker === stage.left ? "left" : "right"}` : " caption"}`} aria-live="polite">
          {beat.speaker ? <b className={`cut-name who-${beat.speaker}`}>{beat.speaker === "you" ? name || ACTOR_NAMES.you : ACTOR_NAMES[beat.speaker]}</b> : null}
          <p>
            {text.slice(0, typed)}
            <span className="cut-ghost" aria-hidden>{text.slice(typed)}</span>
          </p>
          {full ? <i className="cut-next" aria-hidden>▼</i> : null}
        </div>
      ) : null}
      <div className="cut-dots" aria-hidden>
        {scene.beats.map((_, n) => <span key={n} className={n === index ? "on" : n < index ? "past" : ""} />)}
      </div>
      <button
        className="cut-skip"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          playSfx("ui.back");
          finish();
        }}
      >
        Skip
      </button>
    </div>
  );
}

function Actor({ who, side, pose, portraitSrc, talking, dim = false }: { who: ActorId; side: "left" | "right"; pose?: string; portraitSrc: string; talking: boolean; dim?: boolean }) {
  const src = who === "you" ? portraitSrc : ACTOR_SRC[who];
  return (
    <div className={["cut-actor", `side-${side}`, `actor-${who}`, pose ? `pose-${pose}` : "", talking ? "talking" : "", dim ? "dim" : ""].filter(Boolean).join(" ")}>
      <img src={src} alt={ACTOR_NAMES[who]} draggable={false} />
      <span className="cut-shadow" aria-hidden />
    </div>
  );
}

const BITS: Record<string, string[]> = {
  sparkle: ["✦", "✧", "✦", "✧", "✦", "✧", "✦", "✧"],
  hearts: ["♥", "♥", "♥", "♥", "♥", "♥", "♥"],
  paper: ["", "", "", "", "", "", "", "", ""],
  spores: ["", "", "", "", "", "", "", "", "", ""],
};

function SceneFx({ fx }: { fx: string }) {
  const bits = BITS[fx];
  return (
    <div className={`cut-fx cut-fx-${fx}`} aria-hidden>
      {bits?.map((glyph, n) => (
        <span key={n} style={{ ["--i" as string]: String(n), ["--x" as string]: `${(n * 37 + 11) % 100}%` }}>{glyph}</span>
      ))}
      {fx === "stamp" ? <b className="cut-stamp">APPROVED</b> : null}
    </div>
  );
}
