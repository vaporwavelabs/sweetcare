import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { GIFT_CARDS, type GiftCard } from "@/game/cards";
import { LEVELS } from "@/game/levels";
import {
  ACHIEVEMENTS,
  COSMETICS,
  cosmeticOwned,
  gapFor,
  rankTitle,
  scrubFilter,
  type Career,
} from "@/game/profile";
import type { SaveData } from "@/game/save";
import { LOOT_STICKERS } from "@/game/save";

export function portrait(career: Career) {
  return career.look === "f" ? "/avatar/idle-f.png" : "/avatar/idle.png";
}

export function DocAvatar({
  career,
  frame = null,
  className = "",
}: {
  career: Career;
  frame?: number | null;
  className?: string;
}) {
  const female = career.look === "f";
  const src = female || frame == null ? portrait(career) : `/avatar/cele-${frame}.png`;
  const filter = female ? "none" : scrubFilter(career.scrub);
  return (
    <span className={`doc${female ? " look-f" : ""} ${className}`}>
      <img src={src} alt="" draggable={false} style={filter === "none" ? undefined : { filter }} />
      {!female && frame == null && career.coat ? <span className="lab-coat" aria-hidden /> : null}
      {!female && frame == null && career.accessory === "glasses" ? <span className="acc glasses" aria-hidden /> : null}
      {!female && frame == null && career.accessory === "bow" ? <span className="acc bow" aria-hidden /> : null}
      {!female && frame == null && career.accessory === "cap" ? <span className="acc cap" aria-hidden /> : null}
    </span>
  );
}

/** The end-of-level dance. Each nurse has her own keyed clip. */
export function Cheer({ career }: { career: Career }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const src = career.look === "f" ? "/avatar/dance-f.webm" : "/avatar/dance.webm";
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    if (media.matches) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {});
  }, [src]);
  if (reduced) return <DocAvatar career={career} className="cheer" />;
  return (
    <span className={`doc cheer dance${career.look === "f" ? " look-f" : ""}`}>
      <video key={src} ref={videoRef} src={src} autoPlay muted loop playsInline preload="auto" />
    </span>
  );
}

export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 680);
      setN(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

export function ProfileScreen({
  save,
  openCase = false,
  onBack,
  onReplay,
  onChange,
}: {
  save: SaveData;
  openCase?: boolean;
  onBack: () => void;
  onReplay: (id: number) => void;
  onChange: (recipe: (prev: SaveData) => SaveData) => void;
}) {
  const career = save.career;
  const [caseOpen, setCaseOpen] = useState(openCase);
  const gap = gapFor(career.rank);
  const board = LEVELS.map((level) => ({
    id: level.id,
    name: level.name,
    score: save.best[String(level.id)] ?? 0,
    stars: save.stars[String(level.id)] ?? 0,
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const owned = (id: string) => {
    const item = COSMETICS.find((entry) => entry.id === id);
    return item ? cosmeticOwned(career.rank, item) : false;
  };
  const equip = (slot: "scrub" | "coat" | "accessory", id: string) => {
    onChange((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        scrub: slot === "scrub" ? id : prev.career.scrub,
        coat: slot === "coat" ? !prev.career.coat : prev.career.coat,
        accessory: slot === "accessory" ? (prev.career.accessory === id ? "none" : id) : prev.career.accessory,
      },
    }));
  };
  return (
    <div className="column profile">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
        <h2>Profile</h2>
        <span />
      </div>
      <div className="scroll">
        <div className="profile-card">
          <DocAvatar career={career} className="profile-doc" />
          <label className="name-field">
            <span className="kicker">Name</span>
            <input
              value={career.name}
              maxLength={16}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, career: { ...prev.career, name: event.target.value.slice(0, 16) } }))
              }
            />
          </label>
          <p className="rank-line">
            <b>
              {rankTitle(career.rank)} · Lv {career.rank}
            </b>
            <span>
              {career.progress}/{gap} to next
            </span>
          </p>
          <div className="bar" aria-hidden>
            <span style={{ width: `${Math.round((career.progress / gap) * 100)}%` }} />
          </div>
          <p className="rank-note">Rank rises after 2 rounds, then every 3, 4, and 3. Matching a high score counts double.</p>
        </div>
        <h3>Achievements</h3>
        <div className="achieve-grid">
          {ACHIEVEMENTS.map((item) => {
            const got = career.achievements.includes(item.id);
            return (
              <div key={item.id} className={got ? "achieve on" : "achieve"}>
                <b>{item.label}</b>
                <span>{got ? "Earned" : item.hint}</span>
              </div>
            );
          })}
        </div>
        <h3>Suitcase</h3>
        {caseOpen && save.loot ? (
          <HomeBase decor={save.decor ?? []} onChange={onChange} onClose={() => setCaseOpen(false)} />
        ) : (
          <button className="suitcase-btn" type="button" disabled={!save.loot} onClick={() => setCaseOpen(true)}>
            <img src="/ui/loot-case.jpg" alt="" />
            <span>
              <b>Loot case</b>
              <small>{save.loot ? "Decorate your home base" : "Beat Nurse Karen to unlock"}</small>
            </span>
          </button>
        )}
        <h3>Gifts</h3>
        <GiftShelf owned={save.gifts ?? []} />
        <h3>Cosmetics</h3>
        <div className="cosmetic-row">
          {COSMETICS.map((item) => {
            const open = owned(item.id);
            const on =
              (item.slot === "scrub" && career.scrub === item.id) ||
              (item.slot === "coat" && career.coat) ||
              (item.slot === "accessory" && career.accessory === item.id);
            return (
              <button key={item.id} type="button" className={on ? "chip on" : "chip"} disabled={!open} onClick={() => equip(item.slot, item.id)}>
                {item.label}
                {open ? "" : ` · Lv ${item.need}`}
              </button>
            );
          })}
        </div>
        <h3>Scoreboard</h3>
        {board.length === 0 ? <p className="summary-note">Finish a ward to post a score.</p> : null}
        <ol className="board-list">
          {board.map((row, index) => (
            <li key={row.id}>
              <span>{index + 1}</span>
              <b>
                {row.name}
                <small>Level {row.id}</small>
              </b>
              <strong>{row.score}</strong>
            </li>
          ))}
        </ol>
        <h3>Replay</h3>
        <div className="replay-list">
          {LEVELS.filter((level) => level.id <= save.unlocked).map((level) => (
            <button key={level.id} type="button" className="btn secondary" onClick={() => onReplay(level.id)}>
              Level {level.id} · {level.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SketchModel({ card }: { card: GiftCard }) {
  if (!card.model) return null;
  return (
    <div className="sketchfab-embed-wrapper">
      <iframe
        title={card.name}
        src={card.model}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        loading="eager"
      />
      <p className="sketch-credit">
        <a href="https://sketchfab.com/3d-models/ghost-toon-14c0146dbbfc42238aabb6b6a19cb842" target="_blank" rel="noreferrer">
          Ghost Toon
        </a>
        {" by "}
        <a href="https://sketchfab.com/msanjurj" target="_blank" rel="noreferrer">
          Grotex
        </a>
        {" on "}
        <a href="https://sketchfab.com" target="_blank" rel="noreferrer">
          Sketchfab
        </a>
      </p>
    </div>
  );
}

function HomeBase({
  decor,
  onChange,
  onClose,
}: {
  decor: SaveData["decor"];
  onChange: (recipe: (prev: SaveData) => SaveData) => void;
  onClose: () => void;
}) {
  const [sticker, setSticker] = useState<string>(LOOT_STICKERS[0]);
  const place = (event: MouseEvent<HTMLDivElement>) => {
    if (decor.length >= 16) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const id = `${Date.now().toString(36)}-${decor.length}`;
    onChange((prev) => ({ ...prev, decor: [...(prev.decor ?? []), { id, sticker, x, y }] }));
  };
  const remove = (id: string) => {
    onChange((prev) => ({ ...prev, decor: (prev.decor ?? []).filter((pin) => pin.id !== id) }));
  };
  return (
    <div className="home-base">
      <div className="home-stage" onClick={place} role="application" aria-label="Home base. Tap to place a decoration.">
        <img className="room" src="/ui/loot-case.jpg" alt="" />
        {decor.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className="home-sticker"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            onClick={(event) => {
              event.stopPropagation();
              remove(pin.id);
            }}
            aria-label="Remove decoration"
          >
            <img src={`/sprites/${pin.sticker}.png`} alt="" />
          </button>
        ))}
      </div>
      <div className="sticker-palette">
        {LOOT_STICKERS.map((kind) => (
          <button key={kind} type="button" className={sticker === kind ? "on" : ""} onClick={() => setSticker(kind)} aria-label={kind}>
            <img src={`/sprites/${kind}.png`} alt="" />
          </button>
        ))}
      </div>
      <p className="summary-note">Tap the case to place. Tap a decoration to take it off.</p>
      <button className="btn secondary" type="button" onClick={onClose}>Close suitcase</button>
    </div>
  );
}

function barcodeWidths(letter: string): number[] {
  const code = letter.charCodeAt(0) || 65;
  return Array.from({ length: 32 }, (_, i) => {
    const bit = (code * 13 + i * 7) % 5;
    return bit > 2 ? 4 : bit === 0 ? 1 : 2;
  });
}

function GiftShelf({ owned }: { owned: string[] }) {
  const cards = GIFT_CARDS.filter((card) => owned.includes(card.id));
  const [open, setOpen] = useState<GiftCard | null>(null);
  return (
    <>
      {cards.length === 0 ? <p className="summary-note">Open a present after a win to keep a card.</p> : null}
      <div className="gift-row">
        {cards.map((card) => (
          <button key={card.id} type="button" className="gift-thumb" onClick={() => setOpen(card)} aria-label={`Inspect ${card.name}`}>
            <img src={card.src} alt="" />
          </button>
        ))}
      </div>
      {open ? <GiftInspect card={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function GiftInspect({ card, onClose }: { card: GiftCard; onClose: () => void }) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  const bars = barcodeWidths(card.letter);
  if (card.model) {
    return (
      <div className="inspect-scrim" role="dialog" aria-label={card.name}>
        <button className="icon-btn inspect-close" type="button" onClick={onClose} aria-label="Close">
          <ChevronLeft />
        </button>
        <SketchModel card={card} />
      </div>
    );
  }
  return (
    <div className="inspect-scrim" role="dialog" aria-label={card.name}>
      <button className="icon-btn inspect-close" type="button" onClick={onClose} aria-label="Close">
        <ChevronLeft />
      </button>
      <p className="inspect-hint">Drag the card to turn it</p>
      <div
        className="inspect-stage"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, angle };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setAngle(drag.current.angle + (event.clientX - drag.current.x) * 0.6);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="inspect-card" style={{ transform: `rotateY(${angle}deg)` }}>
          <div className="inspect-face front">
            <img src={card.src} alt={card.name} draggable={false} />
          </div>
          <div className="inspect-face back">
            <span className="barcode" aria-hidden>
              {bars.map((width, index) => (
                <i key={index} style={{ width }} />
              ))}
            </span>
            <b>{card.letter}</b>
            <small>{card.name}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
