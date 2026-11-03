import type { ReactNode } from "react";
import { Bug, Coins, Gift, Hammer, IdCard, Map as MapIcon, Play, ScrollText, Settings, Sparkles, Star, UserPlus, Volume2, VolumeX } from "lucide-react";
import { DocAvatar } from "@/components/Profile";
import { Chip, SweetsBackdrop } from "@/components/ui/Theme";
import { LEVEL_KIND_LABEL, levelKind } from "@/game/levelInfo";
import { HOSPITAL_KINDS, LEVELS, getLevel } from "@/game/levels";
import { rankTitle } from "@/game/profile";
import { rewardsWaiting } from "@/game/rewards";
import { continueLevel, totalStars, type SaveData } from "@/game/save";
import { dayKey, shiftForDate } from "@/game/shifts";
import { isRolledWard } from "@/game/wardEvolution";

export interface HomeProps {
  save: SaveData;
  onNew: () => void;
  onContinue: () => void;
  onMap: () => void;
  onSettings: () => void;
  onRewards: () => void;
  onDev: () => void;
  onCreator: () => void;
  onSound: () => void;
  onProfile: () => void;
  noteCount: number;
  logOpen: boolean;
  onToggleLog: () => void;
  /** The launch log list, rendered under the footer when open. */
  log: ReactNode;
}

function MiniStars({ n }: { n: number }) {
  return (
    <span className="sc-mini-stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={i < n ? "on" : ""} aria-hidden />
      ))}
    </span>
  );
}

/** The title screen: one clear Play button, a tile grid for the rest, tools tucked in the footer. */
export function HomeScreen({ save, onNew, onContinue, onMap, onSettings, onRewards, onDev, onCreator, onSound, onProfile, noteCount, logOpen, onToggleLog, log }: HomeProps) {
  const played = save.unlocked > 1 || Object.values(save.stars).some((n) => n > 0);
  const stars = totalStars(save);
  const waiting = rewardsWaiting(save.wallet, stars, dayKey());
  const shift = shiftForDate();
  const nextId = continueLevel(save);
  const next = getLevel(nextId);
  const kind = levelKind(next);
  // Rolled wards change name per attempt, so the title screen just shows the number.
  const nextName = isRolledWard(next) ? `Ward ${nextId}` : `${nextId} · ${next.name}`;
  const nextStars = save.stars[String(nextId)] ?? 0;
  const career = save.career;
  return (
    <div className="column home sc-home">
      <SweetsBackdrop />
      <div className="sc-home-top">
        <button className="icon-btn" type="button" onClick={onSound} aria-label={save.sound ? "Mute sound" : "Sound on"}>
          {save.sound ? <Volume2 /> : <VolumeX />}
        </button>
        <div className="sc-home-purse">
          <Chip tone="gold" icon={<Star aria-hidden />} title="Stars earned">{stars}/{LEVELS.length * 3}</Chip>
          <Chip tone="gold" icon={<Coins aria-hidden />} title="Coins">{save.wallet.coins}</Chip>
        </div>
        <button className={`avatar-btn evo-ring evo-ring-s${save.evolution.stage}`} type="button" onClick={onProfile} aria-label={`${career.name} profile`}>
          <DocAvatar career={career} />
        </button>
      </div>

      <div className="scroll sc-home-body">
        <div className="sc-home-hero">
          <img className="sc-logo" src="/ui/crush-title.png" alt="Sweet Care Crush" draggable={false} />
          <div className="sc-parade" aria-hidden>
            {HOSPITAL_KINDS.map((kind, i) => (
              <img key={kind} src={`/sprites/${kind}.png`} alt="" draggable={false} style={{ animationDelay: `${i * 0.14}s` }} />
            ))}
          </div>
          <p className="sc-tagline">Match the sweets. Mend the ward.</p>
          <p className="sc-shift" title={shift.blurb}>
            <Sparkles aria-hidden />
            Today's shift · {shift.label}
          </p>
        </div>

        <div className="sc-home-card">
          <button className="sc-home-nurse" type="button" onClick={onProfile}>
            <DocAvatar career={career} />
            <span>
              <b>{career.name}</b>
              <small>{rankTitle(career.rank)} · Rank {career.rank}</small>
            </span>
          </button>
          <button className="sc-cta" type="button" onClick={played ? onContinue : onNew}>
            <span className="sc-cta-main">
              <Play aria-hidden />
              {played ? "Play" : "Start your first shift"}
            </span>
            {played ? (
              <span className="sc-cta-sub">
                <span className={`sc-tag ${kind}`}>{LEVEL_KIND_LABEL[kind]}</span>
                {nextName}
                <MiniStars n={nextStars} />
              </span>
            ) : (
              <span className="sc-cta-sub">Pick your nurse and clock in</span>
            )}
          </button>
        </div>

        <nav className="sc-tiles" aria-label="Menu">
          <button className="sc-tile map" type="button" onClick={onMap}>
            <MapIcon aria-hidden />
            <span>World map</span>
          </button>
          <button className={waiting ? "sc-tile rewards ready" : "sc-tile rewards"} type="button" onClick={onRewards}>
            <Gift aria-hidden />
            <span>Rewards</span>
            {waiting ? <span className="sc-badge" aria-label={`${waiting} ready`}>{waiting}</span> : null}
          </button>
          <button className="sc-tile profile" type="button" onClick={onProfile}>
            <IdCard aria-hidden />
            <span>Locker</span>
          </button>
          <button className="sc-tile creator" type="button" onClick={onCreator}>
            <Hammer aria-hidden />
            <span>Creator</span>
          </button>
        </nav>

        <footer className="sc-home-foot">
          <button type="button" onClick={onSettings}><Settings aria-hidden />Settings</button>
          {played ? <button type="button" onClick={onNew}><UserPlus aria-hidden />New nurse</button> : null}
          <button type="button" className="quiet" onClick={onDev}><Bug aria-hidden />Dev</button>
          <button type="button" className="quiet" onClick={onToggleLog} aria-expanded={logOpen}>
            <ScrollText aria-hidden />Log{noteCount ? ` (${noteCount})` : ""}
          </button>
        </footer>
        {logOpen ? log : null}
      </div>
    </div>
  );
}
