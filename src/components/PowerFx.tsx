import type { Pos } from "@/game/engine";
import type { BoosterId } from "@/game/rewards";
import { POWERS } from "@/game/powers";

export interface PowerFlash {
  id: BoosterId;
  /** Changes on every use so the animation restarts. */
  key: number;
  /** The candy it was aimed at. First Aid has none. */
  at: Pos | null;
}

/** The big shout ("Power pill!") in the talk rail above the board. */
export function PowerCallout({ fx }: { fx: PowerFlash }) {
  const info = POWERS[fx.id];
  return (
    <div className={`power-callout power-${fx.id}`} role="status">
      <span className="power-rays" aria-hidden />
      <img src={info.sprite} alt="" />
      <b>{info.callout}</b>
    </div>
  );
}

const RAIN = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92, 0.3, 0.7];

/** What the power up does on the board: the cross beams, the pill drop, the healing rain. */
export function PowerFx({ fx, rows, cols }: { fx: PowerFlash; rows: number; cols: number }) {
  const at = fx.at ? { left: `${((fx.at.c + 0.5) / cols) * 100}%`, top: `${((fx.at.r + 0.5) / rows) * 100}%` } : null;
  return (
    <div key={fx.key} className={`power-fx pfx-${fx.id}`} aria-hidden>
      {fx.id === "blast" && at ? (
        <>
          <span className="pfx-beam row" style={{ top: at.top, height: `${100 / rows}%` }} />
          <span className="pfx-beam col" style={{ left: at.left, width: `${100 / cols}%` }} />
          <span className="pfx-ring" style={at} />
          <span className="pfx-ring late" style={at} />
          <span className="pfx-core" style={at} />
        </>
      ) : null}
      {fx.id === "stripe" && at ? (
        <>
          <span className="pfx-drop" style={at}><img src={POWERS.stripe.sprite} alt="" /></span>
          <span className="pfx-ring pill" style={at} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n} className="pfx-spark" style={{ ...at, ["--a" as string]: `${n * 45}deg` }} />
          ))}
        </>
      ) : null}
      {fx.id === "aid" ? (
        <>
          <span className="pfx-heal" />
          {RAIN.map((x, n) => (
            <img key={n} className="pfx-rain" src={n % 2 ? "/sprites/heart.png" : POWERS.aid.sprite} alt="" style={{ left: `${x * 100}%`, animationDelay: `${(n % 5) * 0.09}s` }} />
          ))}
          <b className="pfx-plus">+5 moves</b>
        </>
      ) : null}
    </div>
  );
}
