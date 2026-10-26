import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Copy, FlipHorizontal2, Play, Plus, Trash2 } from "lucide-react";
import { KINDS, type Kind, type Power } from "@/game/engine";
import { LEVELS, countJelly, makeJelly, type Goal, type LevelDef } from "@/game/levels";
import { MAX_SIDE, MIN_SIDE, formatGrid, mirrorGrid, parseGrid, plainCell, resizeGrid, type CellSpec } from "@/game/layout";
import { SHAPES } from "@/game/shapes";
import { canSimulate, simulateAsync, tune, type Report } from "@/game/simulate";
import {
  MAX_GOALS,
  MAX_KINDS,
  MIN_KINDS,
  blankLevel,
  checkLevel,
  cleanLevel,
  duplicateLevel,
  loadCustomLevels,
  readShareCode,
  saveCustomLevels,
  shareCode,
  toLevelDef,
  type CustomLevel,
} from "@/game/customLevels";

type Tool = "plain" | "hole" | "jelly" | "wrap1" | "wrap2" | "row" | "col" | "bomb" | "rainbow";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "plain", label: "Tile", hint: "Plain cell. Clears everything on it." },
  { id: "hole", label: "Hole", hint: "No tile. Pieces fall through." },
  { id: "jelly", label: "Jelly", hint: "Match on it to clear the jelly." },
  { id: "wrap1", label: "Wrap", hint: "Bandage wrap. Can't be swapped. One match peels it." },
  { id: "wrap2", label: "Wrap ×2", hint: "Two wraps. Needs two matches." },
  { id: "row", label: "Row", hint: "Starts as a row stripe." },
  { id: "col", label: "Column", hint: "Starts as a column stripe." },
  { id: "bomb", label: "Bomb", hint: "Starts as a bomb." },
  { id: "rainbow", label: "Rainbow", hint: "Starts as a rainbow." },
];

const SPECIAL_GLYPH: Record<Power, string> = { row: "↔", col: "↕", bomb: "✹", rainbow: "★" };

const TARGETS = [
  { label: "Gentle", rate: 0.9 },
  { label: "Fair", rate: 0.75 },
  { label: "Tricky", rate: 0.55 },
  { label: "Hard", rate: 0.35 },
];

/** Campaign levels that work as a starting point: goal levels, not bosses or encounters. */
const REMIXABLE = LEVELS.filter((level) => !level.bossHp && !level.encounter && level.goals.length > 0);

function paint(cell: CellSpec, tool: Tool, on: boolean): CellSpec {
  if (tool === "plain") return plainCell();
  if (tool === "hole") return on ? { hole: true, jelly: false, wrap: 0, special: null } : plainCell();
  const next = cell.hole ? plainCell() : { ...cell };
  if (tool === "jelly") next.jelly = on;
  else if (tool === "wrap1") next.wrap = on ? 1 : 0;
  else if (tool === "wrap2") next.wrap = on ? 2 : 0;
  else next.special = on ? tool : null;
  return next;
}

/** Whether a stroke that starts on this cell adds the tool's layer or takes it away. */
function strokeAdds(cell: CellSpec, tool: Tool): boolean {
  if (tool === "plain") return true;
  if (tool === "hole") return !cell.hole;
  if (tool === "jelly") return !cell.jelly;
  if (tool === "wrap1") return cell.wrap !== 1;
  if (tool === "wrap2") return cell.wrap !== 2;
  return cell.special !== tool;
}

function fromCampaign(level: LevelDef): CustomLevel {
  const jelly = makeJelly(level);
  const cells = parseGrid(level.grid, level.rows, level.cols);
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) if (jelly[r]![c] && !cells[r]![c]!.hole) cells[r]![c]!.jelly = true;
  return cleanLevel({
    ...level,
    name: `${level.name} remix`,
    kinds: [...new Set(level.kinds)],
    grid: formatGrid(cells),
    scene: level.id <= 15 ? level.id : 1,
    uid: undefined,
    updatedAt: Date.now(),
  });
}

export function LevelCreator({ onBack, onPlay, initialUid }: { onBack: () => void; onPlay: (level: LevelDef, uid: string) => void; initialUid?: string | null }) {
  const [levels, setLevels] = useState<CustomLevel[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("hole");
  const [report, setReport] = useState<Report | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [target, setTarget] = useState(1);
  const [importText, setImportText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const stroke = useRef<{ on: boolean; last: string } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const testRun = useRef(0);

  useEffect(() => {
    const stored = loadCustomLevels();
    const list = stored.length ? stored : [blankLevel()];
    setLevels(list);
    setUid(list.find((level) => level.uid === initialUid)?.uid ?? list[0]!.uid);
  }, [initialUid]);

  const level = levels.find((item) => item.uid === uid) ?? null;
  const cells = useMemo(() => (level ? parseGrid(level.grid, level.rows, level.cols) : []), [level]);
  const issues = useMemo(() => (level ? checkLevel(level) : []), [level]);
  const errors = issues.filter((issue) => issue.level === "error");
  const code = useMemo(() => (level ? shareCode(level) : ""), [level]);
  const jellyCount = useMemo(() => (level ? countJelly(makeJelly(toLevelDef(level))) : 0), [level]);

  function commit(next: CustomLevel[]) {
    setLevels(next);
    saveCustomLevels(next);
  }

  function update(patch: Partial<CustomLevel> | ((current: CustomLevel) => Partial<CustomLevel>)) {
    if (!level) return;
    const change = typeof patch === "function" ? patch(level) : patch;
    const next = cleanLevel({ ...level, ...change, updatedAt: Date.now() });
    commit(levels.map((item) => (item.uid === level.uid ? next : item)));
    setReport(null);
  }

  function setCells(next: CellSpec[][]) {
    update({ grid: formatGrid(next) });
  }

  function say(text: string) {
    setFlash(text);
    window.setTimeout(() => setFlash((current) => (current === text ? null : current)), 2200);
  }

  function cellAt(event: React.PointerEvent): { r: number; c: number } | null {
    const board = boardRef.current;
    if (!board || !level) return null;
    const rect = board.getBoundingClientRect();
    const c = Math.floor(((event.clientX - rect.left) / rect.width) * level.cols);
    const r = Math.floor(((event.clientY - rect.top) / rect.height) * level.rows);
    if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return null;
    return { r, c };
  }

  function applyAt(r: number, c: number, on: boolean) {
    const next = cells.map((row) => row.map((cell) => ({ ...cell })));
    next[r]![c] = paint(next[r]![c]!, tool, on);
    setCells(next);
  }

  function addLevel(made: CustomLevel) {
    commit([made, ...levels]);
    setUid(made.uid);
    setReport(null);
  }

  function removeLevel() {
    if (!level) return;
    if (!window.confirm(`Delete "${level.name}"? This cannot be undone.`)) return;
    const rest = levels.filter((item) => item.uid !== level.uid);
    const list = rest.length ? rest : [blankLevel()];
    commit(list);
    setUid(list[0]!.uid);
  }

  function runTests() {
    if (!level) return;
    const def = toLevelDef(level);
    if (!canSimulate(def) || errors.length) return;
    const run = ++testRun.current;
    setTesting(0);
    void simulateAsync(def, 24, 3, (done) => {
      if (testRun.current === run) setTesting(done);
    }).then((result) => {
      if (testRun.current !== run) return;
      setTesting(null);
      setReport(result);
    });
  }

  function autoTune() {
    if (!level || errors.length) return;
    const chosen = TARGETS[target]!;
    setTesting(0);
    window.setTimeout(() => {
      const tuned = tune(toLevelDef(level), chosen.rate, 20, 5);
      update({ moves: tuned.moves, star2: tuned.star2, star3: tuned.star3 });
      setTesting(null);
      say(`Tuned to ${tuned.moves} moves for about ${Math.round(tuned.winRate * 100)}% bot wins.`);
    }, 30);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      say("Share code copied.");
    } catch {
      say("Copy blocked. Select the code and copy it by hand.");
    }
  }

  function importCode() {
    const made = readShareCode(importText);
    if (!made) {
      say("That code did not read as a Sweet Care level.");
      return;
    }
    addLevel(made);
    setImportText("");
    say(`Loaded "${made.name}".`);
  }

  function setGoal(index: number, goal: Goal) {
    update((current) => ({ goals: current.goals.map((item, i) => (i === index ? goal : item)) }));
  }

  if (!level) return <div className="column help" />;

  return (
    <div className="column help creator">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>Level creator</h2>
        <button className="icon-btn" type="button" onClick={() => onPlay(toLevelDef(level), level.uid)} disabled={errors.length > 0} aria-label="Play this level"><Play /></button>
      </div>
      <div className="scroll">
        <div className="lc-levels" role="tablist" aria-label="Your levels">
          {levels.map((item) => (
            <button key={item.uid} type="button" role="tab" aria-selected={item.uid === level.uid} className={item.uid === level.uid ? "on" : ""} onClick={() => { setUid(item.uid); setReport(null); }}>
              {item.name}
            </button>
          ))}
          <button type="button" className="lc-add" onClick={() => addLevel(blankLevel())} aria-label="New level"><Plus /></button>
        </div>

        <section className="lc-card">
          <label className="lc-field wide">
            <span>Name</span>
            <input value={level.name} maxLength={28} onChange={(event) => update({ name: event.target.value })} />
          </label>
          <div className="lc-row">
            <Stepper label="Rows" value={level.rows} min={MIN_SIDE} max={MAX_SIDE} onChange={(rows) => update({ rows, grid: formatGrid(resizeGrid(cells, rows, level.cols)) })} />
            <Stepper label="Columns" value={level.cols} min={MIN_SIDE} max={MAX_SIDE} onChange={(cols) => update({ cols, grid: formatGrid(resizeGrid(cells, level.rows, cols)) })} />
            <Stepper label="Moves" value={level.moves} min={1} max={99} onChange={(moves) => update({ moves })} />
          </div>
        </section>

        <section className="lc-card">
          <div className="lc-tools" role="radiogroup" aria-label="Paint tool">
            {TOOLS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={tool === item.id} title={item.hint} className={`lc-tool tool-${item.id}${tool === item.id ? " on" : ""}`} onClick={() => setTool(item.id)}>
                <i aria-hidden />
                {item.label}
              </button>
            ))}
          </div>
          <p className="lc-hint">{TOOLS.find((item) => item.id === tool)?.hint} Drag to paint.</p>
          <div
            ref={boardRef}
            className="lc-board"
            style={{ gridTemplateColumns: `repeat(${level.cols}, 1fr)`, aspectRatio: `${level.cols} / ${level.rows}` }}
            onPointerDown={(event) => {
              const at = cellAt(event);
              if (!at) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const on = strokeAdds(cells[at.r]![at.c]!, tool);
              stroke.current = { on, last: `${at.r},${at.c}` };
              applyAt(at.r, at.c, on);
            }}
            onPointerMove={(event) => {
              const active = stroke.current;
              if (!active) return;
              const at = cellAt(event);
              if (!at || active.last === `${at.r},${at.c}`) return;
              active.last = `${at.r},${at.c}`;
              applyAt(at.r, at.c, active.on);
            }}
            onPointerUp={() => { stroke.current = null; }}
            onPointerCancel={() => { stroke.current = null; }}
            role="grid"
            aria-label="Board layout"
          >
            {cells.map((row, r) =>
              row.map((cell, c) => (
                <div key={`${r}-${c}`} role="gridcell" aria-label={describe(cell, r, c)} className={["lc-cell", cell.hole ? "hole" : "", cell.jelly ? "jelly" : "", cell.wrap ? `wrap wrap-${cell.wrap}` : ""].filter(Boolean).join(" ")}>
                  {!cell.hole ? <img src={`/sprites/${level.kinds[(r * 2 + c * 3 + ((r * c) % 3)) % level.kinds.length]}.png`} alt="" draggable={false} /> : null}
                  {cell.special ? <b className="lc-special">{SPECIAL_GLYPH[cell.special]}</b> : null}
                  {cell.wrap === 2 ? <em className="lc-wrapcount">2</em> : null}
                </div>
              )),
            )}
          </div>
          <div className="lc-actions">
            <button type="button" className="lc-chip" onClick={() => setCells(mirrorGrid(cells))}><FlipHorizontal2 aria-hidden />Mirror left to right</button>
            <button type="button" className="lc-chip" onClick={() => setCells(parseGrid(undefined, level.rows, level.cols))}>Clear board</button>
          </div>
          <label className="lc-field wide">
            <span>Start from a shape</span>
            <select value="" onChange={(event) => {
              const shape = SHAPES.find((item) => item.id === event.target.value);
              if (shape) update({ rows: 6, cols: 6, grid: shape.grid });
            }}>
              <option value="">Pick a 6 × 6 outline…</option>
              {SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
            </select>
          </label>
        </section>

        <section className="lc-card">
          <h3>Supplies <small>{level.kinds.length}/{MAX_KINDS}</small></h3>
          <p className="lc-hint">Fewer supplies means more matches and bigger cascades. Five is a normal ward.</p>
          <div className="lc-kinds">
            {KINDS.map((kind) => {
              const on = level.kinds.includes(kind);
              const full = !on && level.kinds.length >= MAX_KINDS;
              const last = on && level.kinds.length <= MIN_KINDS;
              return (
                <button key={kind} type="button" aria-pressed={on} disabled={full || last} className={on ? "on" : ""} title={kind} onClick={() => update({ kinds: on ? level.kinds.filter((item) => item !== kind) : [...level.kinds, kind] })}>
                  <img src={`/sprites/${kind}.png`} alt={kind} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="lc-card">
          <h3>Goals</h3>
          {level.goals.map((goal, index) => (
            <GoalRow key={index} goal={goal} kinds={level.kinds} onChange={(next) => setGoal(index, next)} onRemove={level.goals.length > 1 ? () => update((current) => ({ goals: current.goals.filter((_, i) => i !== index) })) : undefined} />
          ))}
          {level.goals.length < MAX_GOALS ? (
            <button type="button" className="lc-chip" onClick={() => update((current) => ({ goals: [...current.goals, { type: "collect", kind: current.kinds[0]!, count: 20 }] }))}><Plus aria-hidden />Add goal</button>
          ) : null}
          <p className="lc-hint">{jellyCount} jelly cells on the board.</p>
          <div className="lc-row">
            <label className="lc-field">
              <span>2 stars at</span>
              <NumberField min={100} step={50} value={level.star2} label="2 stars at" onCommit={(star2) => update({ star2 })} />
            </label>
            <label className="lc-field">
              <span>3 stars at</span>
              <NumberField min={150} step={50} value={level.star3} label="3 stars at" onCommit={(star3) => update({ star3 })} />
            </label>
          </div>
          <div className="lc-row">
            <label className="lc-field">
              <span>Backdrop</span>
              <select value={level.scene} onChange={(event) => update({ scene: Number(event.target.value) })}>
                {Array.from({ length: 15 }, (_, i) => <option key={i + 1} value={i + 1}>Scene {i + 1}</option>)}
              </select>
            </label>
            <label className="lc-field">
              <span>Power in the middle</span>
              <select value={level.startSpecial ?? ""} onChange={(event) => update({ startSpecial: (event.target.value || null) as Power | null })}>
                <option value="">None</option>
                <option value="row">Row stripe</option>
                <option value="col">Column stripe</option>
                <option value="bomb">Bomb</option>
                <option value="rainbow">Rainbow</option>
              </select>
            </label>
          </div>
        </section>

        <section className="lc-card">
          <h3>Playtest</h3>
          <p className="lc-hint">A bot plays your level 24 times with the game's real rules. It's greedy and uses no boosters, so treat its win rate as a floor.</p>
          {issues.length ? (
            <ul className="lc-issues">
              {issues.map((issue) => <li key={issue.text} className={issue.level}>{issue.text}</li>)}
            </ul>
          ) : <p className="lc-ok">No problems found.</p>}
          <div className="lc-actions">
            <button type="button" className="btn" disabled={testing !== null || errors.length > 0} onClick={runTests}>
              {testing !== null ? `Testing ${testing}/24…` : "Run bot playtest"}
            </button>
          </div>
          {report ? (
            <div className="lc-report" aria-live="polite">
              <div><b>{Math.round(report.winRate * 100)}%</b><span>bot wins</span></div>
              <div><b>{report.difficulty}</b><span>difficulty</span></div>
              <div><b>{report.medianUsed}</b><span>moves to win</span></div>
              <div><b>{report.avgScore}</b><span>avg score</span></div>
              <button type="button" className="lc-chip" onClick={() => update({ star2: report.star2, star3: report.star3 })}>Use stars {report.star2} / {report.star3}</button>
            </div>
          ) : null}
          <div className="lc-row tune">
            <label className="lc-field">
              <span>Aim for</span>
              <select value={target} onChange={(event) => setTarget(Number(event.target.value))}>
                {TARGETS.map((item, i) => <option key={item.label} value={i}>{item.label} · {Math.round(item.rate * 100)}% bot wins</option>)}
              </select>
            </label>
            <button type="button" className="lc-chip" disabled={testing !== null || errors.length > 0} onClick={autoTune}>Auto-tune moves and stars</button>
          </div>
        </section>

        <section className="lc-card">
          <h3>Share</h3>
          <div className="lc-share">
            <input readOnly value={code} aria-label="Share code" onFocus={(event) => event.currentTarget.select()} />
            <button type="button" className="icon-btn" onClick={() => void copyCode()} aria-label="Copy share code"><Copy /></button>
          </div>
          <div className="lc-share">
            <input value={importText} placeholder="Paste a code that starts with SC1." onChange={(event) => setImportText(event.target.value)} aria-label="Import a share code" />
            <button type="button" className="lc-chip" disabled={!importText.trim()} onClick={importCode}>Load</button>
          </div>
          <label className="lc-field wide">
            <span>Remix a campaign level</span>
            <select value="" onChange={(event) => {
              const source = REMIXABLE.find((item) => String(item.id) === event.target.value);
              if (source) addLevel(fromCampaign(source));
            }}>
              <option value="">Pick a level…</option>
              {REMIXABLE.map((item) => <option key={item.id} value={item.id}>{item.id}. {item.name}</option>)}
            </select>
          </label>
          <div className="lc-actions">
            <button type="button" className="lc-chip" onClick={() => addLevel(duplicateLevel(level))}>Duplicate</button>
            <button type="button" className="lc-chip danger" onClick={removeLevel}><Trash2 aria-hidden />Delete</button>
          </div>
        </section>
        <button className="btn lc-play" type="button" disabled={errors.length > 0} onClick={() => onPlay(toLevelDef(level), level.uid)}>Play this level</button>
      </div>
      {flash ? <p className="lc-flash" role="status">{flash}</p> : null}
    </div>
  );
}

function describe(cell: CellSpec, r: number, c: number) {
  if (cell.hole) return `Row ${r + 1}, column ${c + 1}: hole`;
  const parts = [cell.jelly ? "jelly" : "", cell.wrap ? `${cell.wrap} wrap` : "", cell.special ?? ""].filter(Boolean);
  return `Row ${r + 1}, column ${c + 1}: ${parts.length ? parts.join(", ") : "tile"}`;
}

/** Holds the typed text until blur or Enter, so a half-typed number is not clamped mid-edit. */
function NumberField({ value, min, max, step, label, onCommit }: { value: number; min?: number; max?: number; step?: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && draft.trim() !== "") onCommit(n);
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="lc-field lc-stepper">
      <span>{label}</span>
      <div>
        <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <b>{value}</b>
        <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  );
}

function GoalRow({ goal, kinds, onChange, onRemove }: { goal: Goal; kinds: Kind[]; onChange: (goal: Goal) => void; onRemove?: () => void }) {
  return (
    <div className="lc-goal">
      <select value={goal.type} aria-label="Goal type" onChange={(event) => {
        const type = event.target.value as Goal["type"];
        if (type === "collect") onChange({ type, kind: kinds[0]!, count: 20 });
        else if (type === "score") onChange({ type, target: 8000 });
        else onChange({ type });
      }}>
        <option value="collect">Collect</option>
        <option value="jelly">Clear all jelly</option>
        <option value="wraps">Unwrap everything</option>
        <option value="score">Reach a score</option>
      </select>
      {goal.type === "collect" ? (
        <>
          <NumberField min={1} max={200} value={goal.count} label="How many" onCommit={(count) => onChange({ ...goal, count })} />
          <select value={goal.kind} aria-label="Which supply" onChange={(event) => onChange({ ...goal, kind: event.target.value as Kind })}>
            {kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          <img src={`/sprites/${goal.kind}.png`} alt="" />
        </>
      ) : null}
      {goal.type === "score" ? (
        <NumberField min={500} step={500} value={goal.target} label="Target score" onCommit={(target) => onChange({ ...goal, target })} />
      ) : null}
      {onRemove ? <button type="button" className="lc-x" onClick={onRemove} aria-label="Remove goal">×</button> : null}
    </div>
  );
}
