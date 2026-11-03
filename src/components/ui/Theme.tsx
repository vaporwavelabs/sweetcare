import { useMemo, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Shared Sweet Care UI pieces. Styles live in src/ui.css (sc-* classes and tokens).
 * See /mnt/project-files/notes/sweetcare-ui-review.md for the token list.
 */

export function ScreenHead({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="sc-head">
      {onBack ? (
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
      ) : (
        <span className="sc-head-gap" />
      )}
      <h2>{title}</h2>
      {right ?? <span className="sc-head-gap" />}
    </header>
  );
}

export type ChipTone = "gold" | "mint" | "danger" | "ghost" | "plain";

export function Chip({ icon, tone = "plain", children, title }: { icon?: ReactNode; tone?: ChipTone; children: ReactNode; title?: string }) {
  return (
    <span className={`sc-chip ${tone}`} title={title}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

const DRIFT_SPRITES = ["heart", "pill", "cross", "bandage", "kit", "nurse", "teddy", "bottle"];

/** Slow drifting sweets behind a screen. Pure CSS animation, frozen under reduced motion. */
export function SweetsBackdrop({ count = 12 }: { count?: number }) {
  const items = useMemo(() => {
    // Fixed layout so server and client render the same thing.
    return Array.from({ length: count }, (_, i) => {
      const lane = (i * 37) % 100;
      return {
        key: i,
        src: `/sprites/${DRIFT_SPRITES[i % DRIFT_SPRITES.length]}.png`,
        left: lane,
        size: 1.6 + ((i * 7) % 5) * 0.45,
        delay: -((i * 2.7) % 18),
        duration: 16 + ((i * 5) % 10),
        spin: i % 2 ? 1 : -1,
      };
    });
  }, [count]);
  return (
    <div className="sc-backdrop" aria-hidden>
      {items.map((item) => (
        <img
          key={item.key}
          src={item.src}
          alt=""
          draggable={false}
          style={{
            left: `${item.left}%`,
            width: `${item.size}rem`,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            ["--spin" as string]: item.spin,
          }}
        />
      ))}
    </div>
  );
}
