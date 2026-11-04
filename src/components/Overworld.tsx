import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Gift, Lock, Map as MapIcon, Navigation, Play, ScrollText, Skull, Star } from "lucide-react";
import { CertIcon, CertificateCenter } from "@/components/CertificateCenter";
import { LevelSheet } from "@/components/LevelSheet";
import { portrait } from "@/components/Profile";
import { playSfx, sfxClick, sfxGift, unlockAudio } from "@/game/audio";
import { CERTIFICATES, cardsHeld, certById, lockedCerts, missingCert, nextCert, signsFor, type CertId } from "@/game/certificates";
import { walkerLook } from "@/game/evolution";
import { haptic } from "@/game/haptics";
import { generateWard } from "@/game/generator";
import { getLevel, type LevelDef } from "@/game/levels";
import {
  MAP_H,
  MAP_W,
  NEAR_RADIUS,
  SPURS,
  WARD_NODES,
  ZONE_NAMES,
  CENTER,
  atCenter,
  cameraFor,
  fenceAt,
  fencePolysFor,
  setFences,
  findPath,
  nearestNode,
  pinNear,
  roadBetween,
  nodeById,
  nodeState,
  readRoam,
  roadSplit,
  screenToMap,
  spawnPoint,
  standFor,
  stepToward,
  stepWalker,
  velocityFrom,
  writeRoam,
  zoneAt,
  type Camera,
  type NodeKind,
  type Pt,
  type ZoneId,
} from "@/game/overworld";
import { attemptFor, continueLevel, type SaveData } from "@/game/save";
import { evolveWardAhead, formOffset, lockedWard } from "@/game/wardEvolution";

/**
 * How the walker looks. The character evolution work can pass its own skin here:
 * `idle` is the standing sprite, `walk` optional frames cycled while moving, `aura`
 * an optional CSS colour for a glow ring under the feet, `size` the height in rem.
 */
export interface WalkerSkin {
  idle: string;
  walk?: string[];
  aura?: string;
  size?: number;
  label?: string;
  /** Evolution extras: a golden halo and candy wings. */
  halo?: boolean;
  wings?: boolean;
}

/** The nurse as they look at their current evolution stage. */
export function defaultWalkerSkin(save: SaveData): WalkerSkin {
  const look = walkerLook(save.evolution);
  return { idle: portrait(save.career), label: look.title, aura: look.aura ?? undefined, size: look.size, halo: look.halo, wings: look.wings };
}

const KIND_LABEL: Record<NodeKind, string> = {
  ward: "Ward",
  boss: "Boss ward",
  side: "Side ward",
  microbe: "Microbe swarm",
  heal: "Healing stage",
};

const ROLLED = (id: number) => id >= 3 && id <= 15 && !getLevel(id).bossHp;

/** The next ward's evolved roll, the same preview the classic map shows. */
function useNextWard(save: SaveData) {
  const nextId = continueLevel(save);
  const preview = attemptFor(save, nextId);
  const rolled = ROLLED(nextId);
  const [evolved, setEvolved] = useState<LevelDef | null>(() => (rolled ? lockedWard(nextId, preview.seed, preview.shiftId) : null));
  useEffect(() => {
    if (!rolled) return;
    let live = true;
    void evolveWardAhead(nextId, preview.seed, preview.shiftId, formOffset(save.form)).then((level) => {
      if (live && level) setEvolved(level);
    });
    return () => {
      live = false;
    };
  }, [nextId, preview.seed, preview.shiftId, rolled, save.form]);
  const level = evolved ?? (save.seeds[String(nextId)] && rolled ? generateWard(nextId, preview.seed, preview.shiftId) : getLevel(nextId));
  return { nextId, level };
}

interface Props {
  save: SaveData;
  onBack: () => void;
  onPick: (id: number) => void;
  onCollect: (levelId: number) => void;
  onClassic: () => void;
  /** Shows the gift card reveal; the caller owns it so both maps share one. */
  renderReveal?: (levelId: number, close: () => void) => ReactNode;
  walker?: WalkerSkin;
  /** Called on each footfall while walking, for a step sound. */
  onStep?: (index: number) => void;
  /** Hand in cards for a certificate (the caller saves it). */
  onEarnCert?: (id: CertId) => void;
  /** Open the Certificate Center on arrival, pointing at this certificate. */
  certPrompt?: CertId | null;
  onPromptSeen?: () => void;
}

const pctPt = (x: number, y: number) => ({ x: (x / 100) * MAP_W, y: (y / 100) * MAP_H });

export function Overworld({ save, onBack, onPick, onCollect, onClassic, renderReveal, walker, onStep, onEarnCert, certPrompt, onPromptSeen }: Props) {
  // Close the districts whose certificate is missing before anything walks or spawns.
  const locked = lockedCerts(save);
  setFences(locked);
  const skin = walker ?? defaultWalkerSkin(save);
  const { nextId, level: nextLevel } = useNextWard(save);
  const viewRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Pt>(spawnPoint(readRoam(), nextId));
  const targetRef = useRef<{ path: Pt[]; node: number | null } | null>(null);
  const keysRef = useRef(new Set<string>());
  const stickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const camRef = useRef<Camera | null>(null);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const [focus, setFocus] = useState<number | null>(() => nearestNode(posRef.current)?.id ?? null);
  const focusRef = useRef(focus);
  const [zone, setZone] = useState<{ id: ZoneId; at: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const [stick, setStick] = useState<{ x: number; y: number } | null>(null);
  const [nearCenter, setNearCenter] = useState(() => atCenter(posRef.current));
  const [center, setCenter] = useState<{ highlight: CertId | null } | null>(() => (certPrompt ? { highlight: certPrompt } : null));
  const [bump, setBump] = useState<{ cert: CertId; at: number } | null>(null);
  const [falling, setFalling] = useState<CertId[]>([]);
  const lockedKey = locked.join(",");
  const prevLocked = useRef(locked);
  useEffect(() => {
    if (certPrompt) onPromptSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A fence that just opened plays its fall, then goes away.
  useEffect(() => {
    const opened = prevLocked.current.filter((id) => !locked.includes(id));
    prevLocked.current = locked;
    if (!opened.length) return;
    setFalling((list) => [...list, ...opened]);
    const timer = window.setTimeout(() => setFalling((list) => list.filter((id) => !opened.includes(id))), 1600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedKey]);
  const road = useMemo(() => roadSplit(save.unlocked), [save.unlocked]);
  const reduced = typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced";

  // The game loop: input to velocity, walk, follow camera, find the nearest ward.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let stepClock = 0;
    let dustClock = 0;
    let saveClock = 0;
    let frame = 0;
    let lastZone: ZoneId | null = null;
    let wasMoving = false;
    let bumpAt = -Infinity;
    let wasNearCenter = atCenter(posRef.current);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const keys = keysRef.current;
      let ix = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0) + stickRef.current.x;
      let iy = (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0) + stickRef.current.y;
      ix = Math.max(-1, Math.min(1, ix));
      iy = Math.max(-1, Math.min(1, iy));
      const before = posRef.current;
      let pos = before;
      const { vx, vy } = velocityFrom(ix, iy);
      if (vx !== 0 || vy !== 0) {
        targetRef.current = null;
        pos = stepWalker(pos, vx, vy, dt);
        if (pos.x === before.x && pos.y === before.y) {
          // Pushing into a fence: say which certificate opens it.
          const ahead = fenceAt({ x: pos.x + Math.sign(vx) * 12, y: pos.y + Math.sign(vy) * 12 });
          if (ahead && now - bumpAt > 2200) {
            bumpAt = now;
            setBump({ cert: ahead, at: now });
            haptic("bad");
          }
        }
      } else if (targetRef.current) {
        const route = targetRef.current;
        const result = stepToward(pos, route.path[0]!, dt);
        pos = result.pos;
        if (result.arrived) {
          route.path.shift();
          if (!route.path.length || result.blocked) targetRef.current = null;
        }
      }
      posRef.current = pos;
      const dx = pos.x - before.x;
      const isMoving = Math.hypot(dx, pos.y - before.y) > 0.01;

      const view = viewRef.current;
      const world = worldRef.current;
      if (view && world) {
        const goal = cameraFor(pos, view.clientWidth, view.clientHeight);
        const prev = camRef.current;
        const ease = reduced || !prev ? 1 : 1 - Math.pow(0.0015, dt);
        const cam = prev
          ? { scale: goal.scale, tx: prev.tx + (goal.tx - prev.tx) * ease, ty: prev.ty + (goal.ty - prev.ty) * ease }
          : goal;
        camRef.current = cam;
        world.style.transform = `translate3d(${cam.tx}px, ${cam.ty}px, 0) scale(${cam.scale})`;
        world.style.setProperty("--inv", String(1 / cam.scale));
      }
      const body = walkerRef.current;
      if (body) {
        body.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(var(--inv, 1))`;
        if (Math.abs(dx) > 0.05) body.dataset.face = dx < 0 ? "left" : "right";
      }
      if (isMoving !== wasMoving) {
        wasMoving = isMoving;
        setMoving(isMoving);
        if (body) body.classList.toggle("moving", isMoving);
      }
      if (isMoving) {
        stepClock += dt;
        dustClock += dt;
        if (stepClock > 0.3) {
          stepClock = 0;
          frame++;
          stepRef.current?.(frame);
          const sprite = spriteRef.current;
          if (sprite && skin.walk?.length) sprite.src = skin.walk[frame % skin.walk.length]!;
        }
        if (dustClock > 0.16 && !reduced && dustRef.current) {
          dustClock = 0;
          const puff = document.createElement("span");
          puff.className = "roam-dust";
          puff.style.left = `${pos.x + (Math.random() - 0.5) * 10}px`;
          puff.style.top = `${pos.y + 2}px`;
          dustRef.current.appendChild(puff);
          window.setTimeout(() => puff.remove(), 650);
        }
      } else if (skin.walk?.length && spriteRef.current && spriteRef.current.getAttribute("src") !== skin.idle) {
        spriteRef.current.src = skin.idle;
      }
      const centerHere = atCenter(pos);
      if (centerHere !== wasNearCenter) {
        wasNearCenter = centerHere;
        setNearCenter(centerHere);
        if (centerHere) haptic("tap");
      }
      const near = centerHere ? null : nearestNode(pos)?.id ?? null;
      if (near !== focusRef.current) {
        focusRef.current = near;
        setFocus(near);
        if (near != null) haptic("tap");
      }
      const here = zoneAt(pos);
      if (here !== lastZone) {
        if (lastZone) setZone({ id: here, at: now });
        lastZone = here;
      }
      saveClock += dt;
      if (saveClock > 1 && isMoving) {
        saveClock = 0;
        writeRoam({ x: pos.x, y: pos.y });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      writeRoam({ x: posRef.current.x, y: posRef.current.y });
    };
  }, [reduced, skin.idle, skin.walk]);

  useEffect(() => {
    if (!zone) return;
    const timer = window.setTimeout(() => setZone(null), 1800);
    return () => window.clearTimeout(timer);
  }, [zone]);

  useEffect(() => {
    if (!bump) return;
    const timer = window.setTimeout(() => setBump(null), 2000);
    return () => window.clearTimeout(timer);
  }, [bump]);

  function openCenter(highlight: CertId | null = null) {
    unlockAudio();
    playSfx("map.door");
    keysRef.current.clear();
    targetRef.current = null;
    setCenter({ highlight });
  }

  function walkToCenter() {
    unlockAudio();
    const path = findPath(posRef.current, CENTER.door);
    targetRef.current = path.length ? { path, node: null } : null;
  }

  function enter(id: number) {
    const state = nodeState(save, id);
    if (state.locked) {
      haptic("bad");
      return;
    }
    unlockAudio();
    sfxClick();
    writeRoam({ ...standFor(nodeById(id)!) });
    onPick(id);
  }

  function preview(id: number) {
    if (nodeState(save, id).locked) {
      haptic("bad");
      return;
    }
    unlockAudio();
    sfxClick();
    keysRef.current.clear();
    setSheet(id);
  }

  function openGift(id: number) {
    unlockAudio();
    sfxGift(id);
    onCollect(id);
    setOpening(id);
  }

  function walkTo(id: number) {
    const node = nodeById(id);
    if (!node) return;
    // Fenced off: the way in starts at the Certificate Center.
    const fenced = missingCert(save, id);
    if (fenced) {
      setBump({ cert: fenced.id, at: performance.now() });
      walkToCenter();
      return;
    }
    unlockAudio();
    const path = findPath(posRef.current, standFor(node));
    targetRef.current = path.length ? { path, node: id } : null;
  }

  // Keyboard: arrows or WASD to walk, Enter / Space / E to enter, Escape to leave.
  useEffect(() => {
    const map: Record<string, string> = {
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    };
    const down = (event: KeyboardEvent) => {
      if (opening != null || sheet != null || center) return;
      const dir = map[event.code];
      if (dir) {
        keysRef.current.add(dir);
        event.preventDefault();
        return;
      }
      if ((event.code === "Enter" || event.code === "Space" || event.code === "KeyE") && (focusRef.current != null || atCenter(posRef.current))) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "BUTTON") return;
        event.preventDefault();
        if (focusRef.current != null) preview(focusRef.current);
        else openCenter(nextCert(save)?.id ?? null);
      } else if (event.code === "Escape") {
        onBack();
      } else if (event.code === "KeyN") {
        walkTo(nextId);
      }
    };
    const up = (event: KeyboardEvent) => {
      const dir = map[event.code];
      if (dir) keysRef.current.delete(dir);
    };
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });

  // Tap anywhere on the island to walk there.
  function onMapTap(event: React.PointerEvent<HTMLDivElement>) {
    const view = viewRef.current;
    const cam = camRef.current;
    if (!view || !cam || event.button > 0) return;
    if ((event.target as HTMLElement).closest("button, .roam-stick, .roam-card")) return;
    if (center) return;
    const rect = view.getBoundingClientRect();
    const at = screenToMap(event.clientX - rect.left, event.clientY - rect.top, cam);
    const node = pinNear(at, 40 / cam.scale) ?? nearestNode(at, NEAR_RADIUS * 0.8);
    unlockAudio();
    const path = findPath(posRef.current, node ? standFor(node) : at);
    targetRef.current = path.length ? { path, node: node?.id ?? null } : null;
  }

  // Thumb stick for touch: drag from the pad, the knob shows the direction.
  const stickBase = useRef<{ x: number; y: number; id: number } | null>(null);
  function stickDown(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    stickBase.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    unlockAudio();
    stickMove(event);
  }
  function stickMove(event: React.PointerEvent<HTMLDivElement>) {
    const base = stickBase.current;
    if (!base || base.id !== event.pointerId) return;
    const radius = 38;
    let x = (event.clientX - base.x) / radius;
    let y = (event.clientY - base.y) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    stickRef.current = { x, y };
    setStick({ x, y });
  }
  function stickUp() {
    stickBase.current = null;
    stickRef.current = { x: 0, y: 0 };
    setStick(null);
  }

  const focusNode = focus != null ? nodeById(focus) : undefined;
  const focusState = focusNode ? nodeState(save, focusNode.id) : null;
  const focusLevel = focusNode ? (focusNode.id === nextId ? nextLevel : getLevel(focusNode.id)) : null;
  const best = focusNode ? save.best[String(focusNode.id)] ?? 0 : 0;
  const totalStars = Object.values(save.stars).reduce((sum, n) => sum + n, 0);
  const aura = skin.aura ? { ["--aura" as string]: skin.aura } : undefined;

  return (
    <div className="column map roam">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>Care Island</h2>
        <span className="star-total"><Star className="star on" aria-hidden />{totalStars}</span>
      </div>
      <div
        className="roam-view"
        ref={viewRef}
        onPointerUp={onMapTap}
        role="application"
        aria-label="Island map. Use arrow keys or WASD to walk, Enter to start the ward you are standing at, N to walk to the next ward."
      >
        <div className="roam-world" ref={worldRef} style={{ width: MAP_W, height: MAP_H }}>
          <img className="roam-art" src="/map/island.jpg" alt="" draggable={false} />
          <svg className="roam-roads" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden>
            {SPURS.map(([a, b]) => {
              const open = !nodeState(save, b).locked && !nodeState(save, a).locked;
              return <polyline key={`${a}-${b}`} className={open ? "spur open" : "spur"} points={roadBetween(a, b).map((p) => `${p.x},${p.y}`).join(" ")} />;
            })}
            <polyline className="road ahead" points={road.ahead.map((p) => `${p.x},${p.y}`).join(" ")} />
            <polyline className="road walked" points={road.walked.map((p) => `${p.x},${p.y}`).join(" ")} />
          </svg>
          <svg className="roam-fences" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden>
            <defs>
              <pattern id="roam-hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="18" height="18" className="hatch-bg" />
                <rect width="7" height="18" className="hatch-stripe" />
              </pattern>
            </defs>
            {[...locked, ...falling.filter((id) => !locked.includes(id))].map((id) =>
              fencePolysFor(id).map((poly, i) => (
                <polygon key={`${id}-${i}`} className={`roam-fence ${id}${locked.includes(id) ? "" : " falling"}`} points={poly.map((p) => `${p.x},${p.y}`).join(" ")} />
              )),
            )}
          </svg>
          {locked.flatMap((id) =>
            signsFor(id).map(([x, y], i) => {
              const at = pctPt(x, y);
              return (
                <button key={`sign-${id}-${i}`} type="button" className={`roam-sign ${id}`} style={{ left: at.x, top: at.y }} onClick={() => openCenter(id)} aria-label={`Closed: ${certById(id).name} needed. Open the Certificate Center.`}>
                  <span className="roam-sign-board"><CertIcon id={id} /><span>{certById(id).name.replace(" certificate", "")}<small>certificate</small></span></span>
                  <span className="roam-sign-post" aria-hidden />
                </button>
              );
            }),
          )}
          <span className={`roam-door center${nearCenter ? " focus" : ""}`} style={{ left: CENTER.door.x, top: CENTER.door.y }} aria-hidden />
          <button type="button" className={`roam-center${nearCenter ? " focus" : ""}${cardsHeld(save) >= (nextCert(save)?.cost ?? Infinity) ? " ready" : ""}`} style={{ left: CENTER.pin.x, top: CENTER.pin.y }} onClick={() => (nearCenter ? openCenter(nextCert(save)?.id ?? null) : walkToCenter())} aria-label="Certificate Center">
            <span className="roam-center-face"><ScrollText aria-hidden /></span>
            <span className="roam-center-label">Certificates</span>
          </button>
          {WARD_NODES.map((node) => {
            const spot = standFor(node);
            const state = nodeState(save, node.id);
            return <span key={`door-${node.id}`} className={`roam-door ${node.kind}${state.locked ? " locked" : ""}${node.id === focus ? " focus" : ""}`} style={{ left: spot.x, top: spot.y }} aria-hidden />;
          })}
          {WARD_NODES.map((node) => {
            const state = nodeState(save, node.id);
            const classes = ["roam-pin", node.kind, state.locked ? "locked" : "", state.cleared ? "cleared" : "", node.id === nextId ? "next" : "", node.id === focus ? "focus" : ""].filter(Boolean).join(" ");
            return (
              <button
                key={node.id}
                type="button"
                className={classes}
                style={{ left: node.x, top: node.y }}
                aria-label={`${KIND_LABEL[node.kind]} ${node.id}, ${getLevel(node.id).name}${state.locked ? ", locked" : `, ${state.stars} stars`}`}
                onClick={() => walkTo(node.id)}
              >
                <span className="roam-pin-face">
                  {state.locked ? <Lock aria-hidden /> : node.kind === "boss" ? <Skull aria-hidden /> : node.mark}
                </span>
                {!state.locked ? (
                  <span className="roam-pin-stars" aria-hidden>
                    {[0, 1, 2].map((i) => <i key={i} className={i < state.stars ? "on" : ""} />)}
                  </span>
                ) : null}
                {state.giftWaiting ? <span className="roam-pin-gift" aria-hidden><Gift /></span> : null}
              </button>
            );
          })}
          <div className="roam-dust-layer" ref={dustRef} aria-hidden />
          <div className="roam-walker" ref={walkerRef} data-face="right" style={{ ...aura, ["--walker-size" as string]: `${skin.size ?? 3.1}rem` }} aria-hidden>
            <span className="roam-shadow" />
            {skin.aura ? <span className="roam-aura" /> : null}
            {skin.wings ? <span className="roam-wings" /> : null}
            <img ref={spriteRef} className="roam-sprite" src={skin.idle} alt="" draggable={false} />
            {skin.halo ? <span className="roam-halo" /> : null}
          </div>
        </div>

        {zone && !bump ? <div className="roam-zone" key={zone.at}>{ZONE_NAMES[zone.id]}</div> : null}
        {bump ? <div className="roam-zone roam-bump" key={`bump-${bump.at}`}><CertIcon id={bump.cert} /> {certById(bump.cert).name} needed</div> : null}

        <div className="roam-hud">
          <button type="button" className="roam-chip" onClick={() => { sfxClick(); walkTo(nextId); }}>
            <Navigation aria-hidden /> {missingCert(save, nextId) ? "Certificates" : "Next ward"}
          </button>
          <button type="button" className="roam-chip cards" onClick={() => { sfxClick(); openCenter(nextCert(save)?.id ?? null); }} aria-label={`${cardsHeld(save)} cards in hand. Certificates: ${CERTIFICATES.filter((c) => !locked.includes(c.id)).length} of 3`}>
            <span className="roam-card-icon" aria-hidden /> {cardsHeld(save)}
            <span className="roam-cert-dots" aria-hidden>{CERTIFICATES.map((c) => <i key={c.id} className={locked.includes(c.id) ? "" : "on"} />)}</span>
          </button>
          <button type="button" className="roam-chip ghost" onClick={() => { sfxClick(); onClassic(); }}>
            <MapIcon aria-hidden /> Classic map
          </button>
        </div>

        <div
          className={`roam-stick${stick ? " held" : ""}`}
          onPointerDown={stickDown}
          onPointerMove={stickMove}
          onPointerUp={stickUp}
          onPointerCancel={stickUp}
          aria-hidden
        >
          <span className="roam-knob" style={stick ? { transform: `translate(${stick.x * 38}px, ${stick.y * 38}px)` } : undefined} />
        </div>

        {nearCenter && !center ? (
          <div className={`roam-card center${moving ? " passing" : ""}`} role="dialog" aria-label="Certificate Center">
            <div className="roam-card-top">
              <span className="roam-kicker">Hospital plaza</span>
            </div>
            <h3>Certificate Center</h3>
            <p className="roam-card-note">
              {(() => {
                const want = nextCert(save);
                const held = cardsHeld(save);
                if (!want) return "All three certificates earned. Every path is open.";
                return held >= want.cost
                  ? `You have ${held} card${held === 1 ? "" : "s"}. Enough for the ${want.name}.`
                  : `You have ${held} card${held === 1 ? "" : "s"}. The ${want.name} needs ${want.cost}.`;
              })()}
            </p>
            <div className="roam-card-actions">
              <button type="button" className="btn" onClick={() => openCenter(nextCert(save)?.id ?? null)}>
                <ScrollText aria-hidden /> Go in
              </button>
            </div>
          </div>
        ) : null}

        {focusNode && focusState && focusLevel ? (
          <div className={`roam-card ${focusNode.kind}${focusState.locked ? " locked" : ""}${moving ? " passing" : ""}`} role="dialog" aria-label={focusLevel.name}>
            <div className="roam-card-top">
              <span className="roam-kicker">{KIND_LABEL[focusNode.kind]} {focusNode.mark} · {ZONE_NAMES[focusNode.zone]}</span>
              {!focusState.locked ? (
                <span className="roam-card-stars" aria-label={`${focusState.stars} stars`}>
                  {[0, 1, 2].map((i) => <Star key={i} className={i < focusState.stars ? "star on" : "star"} />)}
                </span>
              ) : null}
            </div>
            <h3>{focusLevel.name}</h3>
            <p className="roam-card-note">
              {focusState.locked
                ? focusState.reason
                : focusNode.id === nextId && focusLevel.evolved
                  ? `Evolved for today${focusLevel.evolved.note ? `: ${focusLevel.evolved.note}` : ""}`
                  : best > 0
                    ? `Best ${best.toLocaleString()}`
                    : focusState.cleared
                      ? `Cleared${focusState.stars ? ` with ${focusState.stars} star${focusState.stars > 1 ? "s" : ""}` : ""}. Go again for more.`
                    : focusNode.kind === "boss"
                      ? "Nurse Karen is waiting."
                      : focusNode.id === nextId
                        ? "Your next ward."
                        : "Not played yet."}
            </p>
            <div className="roam-card-actions">
              {focusState.giftWaiting ? (
                <button type="button" className="btn secondary roam-gift-btn" onClick={() => openGift(focusNode.id)}>
                  <Gift aria-hidden /> Gift
                </button>
              ) : null}
              {missingCert(save, focusNode.id) ? (
                <button type="button" className="btn secondary" onClick={() => openCenter(missingCert(save, focusNode.id)!.id)}>
                  <ScrollText aria-hidden /> Certificates
                </button>
              ) : null}
              <button type="button" className="btn" disabled={focusState.locked} onClick={() => preview(focusNode.id)}>
                {focusState.locked ? <><Lock aria-hidden /> Locked</> : <><Play aria-hidden /> {focusState.cleared ? "Replay" : "Start"}</>}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {opening != null && renderReveal ? renderReveal(opening, () => setOpening(null)) : null}
      {center ? (
        <CertificateCenter
          save={save}
          highlight={center.highlight}
          onEarn={(id) => onEarnCert?.(id)}
          onClose={() => {
            sfxClick();
            setCenter(null);
          }}
        />
      ) : null}
      {sheet != null ? (
        <LevelSheet
          levelId={sheet}
          save={save}
          level={sheet === nextId ? nextLevel : undefined}
          onClose={() => setSheet(null)}
          onPlay={() => {
            const id = sheet;
            setSheet(null);
            enter(id);
          }}
        />
      ) : null}
    </div>
  );
}

