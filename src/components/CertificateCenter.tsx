import { useEffect, useState } from "react";
import { Baby, Bandage, Check, Lock, ScrollText, Stethoscope, X } from "lucide-react";
import { playSfx, sfxClick, unlockAudio } from "@/game/audio";
import { cardForLevel } from "@/game/cards";
import {
  CERTIFICATES,
  GIFT_LEVELS,
  cardsHeld,
  certStatus,
  hasCert,
  missingCert,
  type CertId,
  type Certificate,
} from "@/game/certificates";
import { haptic } from "@/game/haptics";
import type { SaveData } from "@/game/save";

const ICON: Record<CertId, typeof Baby> = { clinic: Stethoscope, peds: Baby, wound: Bandage };

/** The certificate badge used on the map signs and in the center. */
export function CertIcon({ id }: { id: CertId }) {
  const Icon = ICON[id];
  return <Icon aria-hidden />;
}

/**
 * The Certificate Center: hand in gift cards, get a certificate, and a fenced part of
 * the island opens. Shared by the overworld and the classic map.
 */
export function CertificateCenter({ save, onEarn, onClose, highlight }: { save: SaveData; onEarn: (id: CertId) => void; onClose: () => void; highlight?: CertId | null }) {
  const [stamping, setStamping] = useState<Certificate | null>(null);
  const held = cardsHeld(save);
  const opened = new Set(save.openedGifts ?? []);
  const earnedIds = GIFT_LEVELS.filter((id) => opened.has(id));
  const hand = earnedIds.slice(Math.max(0, earnedIds.length - held));
  // Gift wards still to clear on the open part of the island.
  const cardWards = GIFT_LEVELS.filter((id) => !opened.has(id) && !missingCert(save, id));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (stamping) setStamping(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stamping]);

  function handIn(cert: Certificate) {
    unlockAudio();
    if (certStatus(save, cert.id).kind !== "ready") {
      playSfx("map.locked");
      haptic("bad");
      return;
    }
    playSfx("cut.stamp");
    window.setTimeout(() => playSfx("reward.unlock"), 380);
    haptic("win");
    setStamping(cert);
    onEarn(cert.id);
  }

  return (
    <div className="sc-sheet-backdrop" onClick={onClose}>
      <div className="sc-sheet cert-sheet" role="dialog" aria-modal="true" aria-label="Certificate Center" onClick={(event) => event.stopPropagation()}>
        <div className="sc-sheet-grip" aria-hidden />
        <div className="cert-head">
          <span className="cert-head-icon"><ScrollText aria-hidden /></span>
          <div>
            <h3>Certificate Center</h3>
            <p>Clinicals don't count here. Cards do.</p>
          </div>
          <button className="icon-btn cert-close" type="button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="cert-hand" aria-label={`${held} card${held === 1 ? "" : "s"} in hand`}>
          <div className="cert-fan" aria-hidden>
            {hand.length ? (
              hand.slice(-6).map((id, i, list) => {
                const card = cardForLevel(id);
                const spread = list.length > 1 ? (i / (list.length - 1) - 0.5) * 2 : 0;
                return <img key={id} src={card.src} alt="" style={{ ["--spread" as string]: spread }} />;
              })
            ) : (
              <span className="cert-fan-empty" />
            )}
          </div>
          <div className="cert-hand-text">
            <span><strong>{held}</strong> card{held === 1 ? "" : "s"} in hand</span>
            <small>{cardWards.length ? <>Cards wait at the end of wards {cardWards.slice(0, 6).join(", ")}{cardWards.length > 6 ? "…" : ""}. Not every ward has one.</> : "Clear more wards for cards. Not every ward has one."}</small>
          </div>
        </div>

        <ul className="cert-list">
          {CERTIFICATES.map((cert) => {
            const status = certStatus(save, cert.id);
            return (
              <li key={cert.id} className={`cert-row ${cert.id} ${status.kind}${highlight === cert.id ? " wanted" : ""}`}>
                <span className="cert-badge"><CertIcon id={cert.id} /></span>
                <div className="cert-info">
                  <strong>{cert.name}</strong>
                  <span>Opens {cert.area}</span>
                  <span className="cert-pips" aria-label={`Costs ${cert.cost} cards`}>
                    {Array.from({ length: cert.cost }, (_, i) => (
                      <i key={i} className={status.kind === "earned" || (status.kind !== "blocked" && i < held) ? "on" : ""} />
                    ))}
                  </span>
                </div>
                {status.kind === "earned" ? (
                  <span className="cert-done"><Check aria-hidden /> Earned</span>
                ) : status.kind === "blocked" ? (
                  <span className="cert-wait"><Lock aria-hidden /> {status.first.name.replace(" certificate", "")} first</span>
                ) : (
                  <button className="btn cert-buy" type="button" disabled={status.kind !== "ready"} onClick={() => handIn(cert)}>
                    {status.kind === "ready" ? `Hand in ${cert.cost}` : `${status.need} more`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {hasCert(save, "wound") ? <p className="cert-foot">Fully certified. Somebody hire this nurse.</p> : null}
      </div>

      {stamping ? (
        <div className="cert-stamp" role="dialog" aria-label={`${stamping.name} earned`} onClick={(event) => { event.stopPropagation(); sfxClick(); setStamping(null); }}>
          <div className="cert-diploma">
            <span className="cert-ribbon" aria-hidden />
            <span className="cert-diploma-badge"><CertIcon id={stamping.id} /></span>
            <small>This certifies that</small>
            <strong className="cert-name">{save.career.name || "Our Nurse"}</strong>
            <small>is now holder of the</small>
            <h4>{stamping.name}</h4>
            <p>{stamping.motto}</p>
            <span className="cert-seal" aria-hidden>CERTIFIED</span>
          </div>
          <p className="cert-open-note">{stamping.area} is open. The fence is coming down.</p>
          <button className="btn" type="button">Back to the island</button>
        </div>
      ) : null}
    </div>
  );
}
