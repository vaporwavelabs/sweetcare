import { PERKS, type PerkId } from "@/game/perks";
import type { Pos } from "@/game/engine";

export interface PerkFlash {
  id: PerkId;
  /** Changes on every fire so the animation restarts. */
  key: number;
  zap: Pos | null;
  planted: Pos[];
}

/** The toast and the board effect for a perk that just fired. Sits inside the board. */
export function PerkFx({ fx, rows, cols }: { fx: PerkFlash; rows: number; cols: number }) {
  const info = PERKS[fx.id];
  const at = (pos: Pos) => ({ left: `${((pos.c + 0.5) / cols) * 100}%`, top: `${((pos.r + 0.5) / rows) * 100}%` });
  return (
    <>
      <div key={`toast-${fx.key}`} className={`perk-toast perk-${fx.id}`} role="status">
        <img src={info.icon} alt="" />
        <div>
          <b>{info.name}</b>
          <span>{info.effect}</span>
        </div>
      </div>
      <div key={`fx-${fx.key}`} className={`perk-fx fx-${fx.id}`} aria-hidden>
        {fx.id === "vitals" ? (
          <svg className="ecg" viewBox="0 0 200 60" preserveAspectRatio="none">
            <polyline points="0,30 50,30 62,30 70,8 80,54 90,18 98,30 130,30 140,30 146,20 152,40 158,30 200,30" />
          </svg>
        ) : null}
        {fx.id === "adrenaline" ? <span className="pulse-heart" /> : null}
        {fx.id === "defib" && fx.zap ? (
          <>
            <span className="shock" />
            <span className="bolt row" style={{ top: at(fx.zap).top }} />
            <span className="bolt col" style={{ left: at(fx.zap).left }} />
          </>
        ) : null}
        {fx.id === "sugar-rush" ? <span className="swirl" /> : null}
        {fx.id === "miracle"
          ? fx.planted.map((pos) => <span key={`b${pos.r}-${pos.c}`} className="beam" style={{ left: at(pos).left, height: `calc(${at(pos).top} + 40%)` }} />)
          : null}
        {fx.planted.map((pos) => <span key={`h${pos.r}-${pos.c}`} className={`halo${fx.id === "sugar-rush" ? " stripe" : ""}`} style={at(pos)} />)}
      </div>
    </>
  );
}
