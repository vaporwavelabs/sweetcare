import { useEffect, useMemo, useRef, useState } from "react";
import { ACTOR_NAMES, SCENES, lineFor, setAt, stageAt, type ActorId, type SceneId, type SetId } from "@/game/cutscenes";
import { playSfx } from "@/game/sfx";
import { setMusicScene } from "@/game/music";
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

  const set = setAt(scene, index);

  // Each beat: its sound, then the typewriter.
  useEffect(() => {
    if (beat.music) setMusicScene(beat.music);
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
    <div className={`cutscene${leaving ? " leaving" : ""}${beat.fx ? ` scene-fx-${beat.fx}` : ""}`} role="dialog" aria-modal="true" aria-label={scene.title} onClick={advance}>
      {set ? <StorySet key={set} set={set} name={name} /> : <div className="cut-bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden />}
      <div className="cut-vignette" aria-hidden />
      <div className="cut-bar top" aria-hidden />
      <div className="cut-bar bottom" aria-hidden />
      {beat.fx ? <SceneFx key={`${index}-${beat.fx}`} fx={beat.fx} stamp={beat.stamp} /> : null}
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
  caps: ["", "", "", "", "", "", "", ""],
  confetti: Array.from({ length: 18 }, () => ""),
};

function SceneFx({ fx, stamp }: { fx: string; stamp?: string }) {
  const bits = BITS[fx];
  return (
    <div className={`cut-fx cut-fx-${fx}`} aria-hidden>
      {bits?.map((glyph, n) => (
        <span key={n} style={{ ["--i" as string]: String(n), ["--x" as string]: `${(n * 37 + 11) % 100}%` }}>{glyph}</span>
      ))}
      {fx === "stamp" ? <b className="cut-stamp">{stamp ?? "APPROVED"}</b> : null}
    </div>
  );
}

/**
 * Illustrated backdrops for the prologue, drawn with CSS so they match the kawaii theme without new art.
 * Each set fills the screen behind the actors; styles are in src/prologue.css.
 */
function StorySet({ set, name }: { set: SetId; name: string }) {
  const n = (count: number) => Array.from({ length: count }, (_, i) => i);
  return (
    <div className={`cut-set set-${set}`} aria-hidden>
      {set === "campus" ? (
        <>
          <div className="s-sun" />
          <div className="s-cloud c1" />
          <div className="s-cloud c2" />
          <div className="s-bunting">{n(11).map((i) => <span key={i} style={{ ["--i" as string]: String(i) }} />)}</div>
          <div className="s-banner"><small>Sweet Care School of Nursing</small><b>Class of Care</b></div>
          <div className="s-podium"><span>✚</span></div>
          <div className="s-stage" />
          <div className="s-crowd">{n(14).map((i) => <span key={i} style={{ ["--i" as string]: String(i), ["--y" as string]: String((i * 7) % 5) }} />)}</div>
        </>
      ) : null}
      {set === "study" ? (
        <>
          <div className="s-window"><span className="s-moon" />{n(7).map((i) => <i key={i} style={{ ["--i" as string]: String(i) }} />)}</div>
          <div className="s-clock"><span /></div>
          <div className="s-glow" />
          <div className="s-desk" />
          <div className="s-books"><span>Med-Surg</span><span>Pharm</span><span>NCLEX review</span></div>
          <div className="s-lamp" />
          <div className="s-mug"><i /><i /><i /></div>
          <div className="s-cards">{n(5).map((i) => <span key={i} style={{ ["--i" as string]: String(i), ["--y" as string]: String(((i * 3) % 4) * 1.8) }}>{["ABCs", "K+ 3.5-5", "SATA", "Prioritize", "Delegate"][i]}</span>)}</div>
        </>
      ) : null}
      {set === "exam" || set === "exam-off" ? (
        <>
          <div className="s-wall" />
          <div className="s-monitor">
            <div className="s-screen">
              {set === "exam" ? (
                <>
                  <small>NCLEX-RN</small>
                  <b>Question <em /></b>
                  <div className="s-choices"><span /><span /><span /><span /></div>
                  <div className="s-meter"><span /></div>
                </>
              ) : (
                <span className="s-off">. . .</span>
              )}
            </div>
            <div className="s-standpost" />
          </div>
          <div className="s-table" />
        </>
      ) : null}
      {set === "result" ? (
        <>
          <div className="s-rays" />
          <div className="s-phone">
            <div className="s-notch" />
            <div className="s-note">
              <small>NCLEX-RN · Result</small>
              <b>PASS</b>
              <span>Licensed: {name || "Nurse"}, RN</span>
            </div>
          </div>
        </>
      ) : null}
      {set === "debt" ? (
        <>
          <div className="s-gloom" />
          <div className="s-bill">
            <small>Student Loan Statement</small>
            <b>$87,412.06</b>
            <ul>
              <li><span>Tuition</span><em>$$$$</em></li>
              <li><span>Scrubs (4 colors)</span><em>$$</em></li>
              <li><span>Interest</span><em>yes</em></li>
              <li><span>Interest on interest</span><em>also yes</em></li>
            </ul>
            <i>Payment due: forever</i>
          </div>
        </>
      ) : null}
      {set === "rejects" ? (
        <>
          <div className="s-gloom" />
          <div className="s-pile">
            {n(4).map((i) => <span key={i} style={{ ["--i" as string]: String(i) }} />)}
            <div className="s-reject">
              <small>Re: Your application</small>
              <b>Unfortunately...</b>
              <span>We require 2+ years of experience.</span>
              <em>(Clinicals do not count.)</em>
            </div>
          </div>
        </>
      ) : null}
      {set === "letter" ? (
        <>
          <div className="s-rays soft" />
          <div className="s-envelope">
            <div className="s-paper">
              <small>Sweet Care Island Hospital</small>
              <b>You're hired!</b>
              <span>No experience? No problem, {name || "Nurse"}!</span>
            </div>
            <div className="s-pocket" />
            <div className="s-seal">♥</div>
          </div>
        </>
      ) : null}
      {set === "ferry" ? (
        <>
          <div className="s-sun dawn" />
          <div className="s-isle" />
          <div className="s-light" />
          <div className="s-sea">{n(3).map((i) => <span key={i} style={{ ["--i" as string]: String(i) }} />)}</div>
          <div className="s-boat"><span className="s-flag" /><span className="s-cabin" /><span className="s-hull" /></div>
          <div className="s-gulls"><i /><i /><i /></div>
        </>
      ) : null}
      {set === "island" ? (
        <>
          <img className="s-map" src="/map/island.jpg" alt="" draggable={false} />
          <div className="s-cloud big l" />
          <div className="s-cloud big r" />
          <div className="s-pin"><span>1</span></div>
        </>
      ) : null}
    </div>
  );
}
