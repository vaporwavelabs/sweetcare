import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Coins, Gift, Lock } from "lucide-react";
import { haptic, hapticsSupported } from "@/game/haptics";
import { HINT_DELAYS, type HapticStrength, type Prefs } from "@/game/prefs";
import {
  BAG_CAP,
  BOOSTER_INFO,
  CHESTS,
  DAILY,
  buy,
  claimChest,
  claimDaily,
  dailyCursor,
  dailyDay,
  openChests,
  rewardText,
  type BoosterId,
  type Reward,
  type Wallet,
} from "@/game/rewards";
import { totalStars, type SaveData } from "@/game/save";
import { dayKey } from "@/game/shifts";

function Head({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="map-head">
      <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
      <h2>{title}</h2>
      <span />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opt-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, hint, on, onChange, disabled = false }: { label: string; hint?: string; on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="opt-row">
      <span className="opt-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? "switch on" : "switch"} onClick={onChange} disabled={disabled}>
        <span />
      </button>
    </div>
  );
}

function Slider({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className={disabled ? "opt-row opt-slider off" : "opt-row opt-slider"}>
      <span className="opt-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft}
        disabled={disabled}
        style={{ ["--fill" as string]: `${draft}%` }}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={() => onChange(draft)}
        onKeyUp={() => onChange(draft)}
        onBlur={() => draft !== value && onChange(draft)}
      />
      <b className="opt-value">{draft}</b>
    </label>
  );
}

function Segments<T extends string | number>({ label, value, options, onChange, disabled = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="opt-row opt-stack">
      <span className="opt-label">{label}</span>
      <div className="segments" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={option.value === value ? "seg on" : "seg"}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OptionsScreen({
  save,
  onBack,
  onSound,
  onMusic,
  onHaptics,
  onPrefs,
  onHelp,
  onReset,
}: {
  save: SaveData;
  onBack: () => void;
  onSound: () => void;
  onMusic: () => void;
  onHaptics: () => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onHelp: () => void;
  onReset: () => void;
}) {
  const prefs = save.prefs;
  const [confirm, setConfirm] = useState(false);
  const [canBuzz, setCanBuzz] = useState(true);
  useEffect(() => setCanBuzz(hapticsSupported()), []);
  const strengths: { value: HapticStrength; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "normal", label: "Normal" },
    { value: "strong", label: "Strong" },
  ];
  return (
    <div className="column help options">
      <Head title="Settings" onBack={onBack} />
      <div className="scroll">
        <Section title="Sound">
          <Toggle label="Sound effects" on={save.sound} onChange={onSound} />
          <Slider label="Effects volume" value={prefs.sfxVolume} disabled={!save.sound} onChange={(n) => onPrefs({ sfxVolume: n })} />
          <Toggle label="Music" on={save.music} onChange={onMusic} />
          <Slider label="Music volume" value={prefs.musicVolume} disabled={!save.music} onChange={(n) => onPrefs({ musicVolume: n })} />
        </Section>
        <Section title="Haptics">
          <Toggle
            label="Vibration"
            hint={canBuzz ? "Buzz on matches, powers, boss hits and wins." : "This device or browser does not support vibration."}
            on={save.haptics && canBuzz}
            disabled={!canBuzz}
            onChange={onHaptics}
          />
          <Segments
            label="Strength"
            value={prefs.hapticStrength}
            options={strengths}
            disabled={!save.haptics || !canBuzz}
            onChange={(value) => {
              onPrefs({ hapticStrength: value });
              window.setTimeout(() => haptic("power"), 30);
            }}
          />
        </Section>
        <Section title="Play">
          <Segments
            label="Hints"
            value={prefs.hintDelay}
            options={HINT_DELAYS.map((n) => ({ value: n as number, label: n === 0 ? "Off" : `${n}s` }))}
            onChange={(value) => onPrefs({ hintDelay: value })}
          />
          <Toggle label="Screen shake" hint="Shake the board on big cascades." on={prefs.shake} onChange={() => onPrefs({ shake: !prefs.shake })} />
          <Toggle
            label="Reduce motion"
            hint="Skip the countdown and falling tiles. Your device setting always applies."
            on={prefs.motion === "reduced"}
            onChange={() => onPrefs({ motion: prefs.motion === "reduced" ? "device" : "reduced" })}
          />
        </Section>
        <Section title="Help">
          <button className="btn opt-btn" type="button" onClick={onHelp}>How to care</button>
        </Section>
        <Section title="Progress">
          {confirm ? (
            <div className="opt-confirm">
              <p>Erase every star, coin, booster and rank? Your settings and nurse stay.</p>
              <div className="opt-pair">
                <button className="btn opt-btn danger" type="button" onClick={() => { setConfirm(false); onReset(); }}>Erase</button>
                <button className="btn opt-btn ghost" type="button" onClick={() => setConfirm(false)}>Keep</button>
              </div>
            </div>
          ) : (
            <button className="btn opt-btn ghost" type="button" onClick={() => setConfirm(true)}>Reset progress</button>
          )}
        </Section>
      </div>
    </div>
  );
}

function RewardIcons({ reward }: { reward: Reward }) {
  return (
    <span className="reward-icons">
      {reward.coins ? <span className="ri"><Coins className="coin-icon" aria-hidden />{reward.coins}</span> : null}
      {(["blast", "stripe", "aid"] as const).map((id) =>
        reward[id] ? (
          <span key={id} className="ri">
            <img src={BOOSTER_INFO[id].sprite} alt="" />
            {reward[id]! > 1 ? `x${reward[id]}` : BOOSTER_INFO[id].label}
          </span>
        ) : null,
      )}
    </span>
  );
}

export function RewardsScreen({
  save,
  onBack,
  onWallet,
}: {
  save: SaveData;
  onBack: () => void;
  onWallet: (recipe: (wallet: Wallet, stars: number) => Wallet) => void;
}) {
  const today = dayKey();
  const wallet = save.wallet;
  const stars = totalStars(save);
  const cursor = dailyCursor(wallet, today);
  const ready = dailyDay(wallet, today) != null;
  const upcoming = CHESTS.find((chest) => !wallet.chests.includes(chest.stars) && stars < chest.stars) ?? null;
  const readyChests = openChests(wallet, stars).length;
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const claimToday = () => {
    const result = claimDaily(wallet, today);
    if (!result) return;
    setToast(`Day ${result.day} · ${rewardText(result.reward)}`);
    onWallet((current) => claimDaily(current, today)?.wallet ?? current);
  };
  const claim = (milestone: number) => {
    const chest = CHESTS.find((item) => item.stars === milestone);
    if (!chest) return;
    setToast(`${milestone} star chest · ${rewardText(chest.reward)}`);
    onWallet((current, have) => claimChest(current, have, milestone) ?? current);
  };
  const purchase = (id: BoosterId) => {
    if (!buy(wallet, id)) return;
    setToast(`${BOOSTER_INFO[id].label} added to your bag`);
    onWallet((current) => buy(current, id) ?? current);
  };

  return (
    <div className="column help rewards">
      <Head title="Rewards" onBack={onBack} />
      <div className="purse-bar">
        <span><Coins className="coin-icon" aria-hidden /><b>{wallet.coins}</b> coins</span>
        <span className="bag-mini">
          {(["blast", "stripe", "aid"] as const).map((id) => (
            <span key={id} title={BOOSTER_INFO[id].label}><img src={BOOSTER_INFO[id].sprite} alt="" />{wallet.bag[id]}</span>
          ))}
        </span>
      </div>
      <div className="scroll">
        <Section title="Daily care package">
          <ol className="daily-row">
            {DAILY.map((reward, index) => {
              const day = index + 1;
              const done = day < cursor.day || (day === cursor.day && cursor.claimed);
              const now = day === cursor.day && !cursor.claimed;
              return (
                <li key={day} className={["daily", done ? "done" : "", now ? "now" : "", day === DAILY.length ? "big" : ""].filter(Boolean).join(" ")}>
                  <span className="daily-day">Day {day}</span>
                  {done ? <Check className="daily-check" aria-label="Claimed" /> : <RewardIcons reward={reward} />}
                </li>
              );
            })}
          </ol>
          <button className="btn opt-btn" type="button" disabled={!ready} onClick={claimToday}>
            {ready ? "Claim today's package" : "Come back tomorrow"}
          </button>
          <p className="opt-note">Claim on back-to-back days to reach the day 7 bundle. Missing a day starts the run over.</p>
        </Section>
        <Section title="Star chests">
          <p className="opt-note">
            {stars} stars earned.
            {readyChests > 0 ? ` ${readyChests} ${readyChests === 1 ? "chest is" : "chests are"} ready.` : upcoming ? ` Next chest at ${upcoming.stars}.` : " Every chest is open."}
          </p>
          {upcoming ? (
            <div className="chest-bar" aria-hidden>
              <span style={{ width: `${Math.min(100, (stars / upcoming.stars) * 100)}%` }} />
            </div>
          ) : null}
          <ul className="chest-list">
            {CHESTS.map((chest) => {
              const claimed = wallet.chests.includes(chest.stars);
              const open = !claimed && stars >= chest.stars;
              return (
                <li key={chest.stars} className={claimed ? "chest done" : open ? "chest open" : "chest"}>
                  <span className="chest-stars">{chest.stars}★</span>
                  <RewardIcons reward={chest.reward} />
                  {claimed ? (
                    <Check className="daily-check" aria-label="Claimed" />
                  ) : open ? (
                    <button className="btn mini" type="button" onClick={() => claim(chest.stars)}><Gift aria-hidden />Open</button>
                  ) : (
                    <Lock className="chest-lock" aria-label="Locked" />
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title="Supply shop">
          <p className="opt-note">Every ward hands out one free booster of each kind. Bag boosters are spent after that and carry over between wards.</p>
          <ul className="shop-list">
            {(["blast", "stripe", "aid"] as const).map((id) => {
              const info = BOOSTER_INFO[id];
              const full = wallet.bag[id] >= BAG_CAP;
              return (
                <li key={id} className="shop-item">
                  <img src={info.sprite} alt="" />
                  <span className="opt-label">
                    {info.label} <small>{info.blurb} In bag: {wallet.bag[id]}/{BAG_CAP}</small>
                  </span>
                  <button className="btn mini" type="button" disabled={full || wallet.coins < info.price} onClick={() => purchase(id)}>
                    {full ? "Full" : <><Coins className="coin-icon" aria-hidden />{info.price}</>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="opt-note">Earn coins by clearing wards. Stars, spare moves, first clears, bosses and your first win each day all pay extra.</p>
        </Section>
      </div>
      {toast ? <p className="reward-toast" role="status">{toast}</p> : null}
    </div>
  );
}
