/**
 * Certificates and the cards that pay for them.
 *
 * Some wards (not all) end with a gift. Every gift is a card. Cards are handed in at the
 * Certificate Center for Clinic, Pediatric and Wound Care certificates, and each
 * certificate opens a fenced district of the island. The certificates come in a fixed
 * order so the player can never spend cards on the wrong one and get stuck.
 *
 * Pure: no browser, no React. Fences are polygons in percent of the island art, so the
 * overworld can turn them into walls.
 */

export type CertId = "clinic" | "peds" | "wound";

export interface Certificate {
  id: CertId;
  name: string;
  /** One line on the certificate itself. */
  motto: string;
  /** Cards handed in to earn it. */
  cost: number;
  /** Earn this one first. */
  requires: CertId | null;
  /** Wards behind its fence. */
  wards: number[];
  /** What the fence keeps closed, for the locked card. */
  area: string;
  /** Fenced district, in percent of the island art. Clockwise. */
  fence: Array<[number, number]>;
  /** Where the "closed" sign stands, on the path into the district (percent). */
  sign: [number, number];
}

export const CERTIFICATES: Certificate[] = [
  {
    id: "clinic",
    name: "Clinic certificate",
    motto: "Can take a blood pressure without panicking. Mostly.",
    cost: 3,
    requires: null,
    wards: [6, 7, 8, 9, 10, 17, 20],
    area: "Care Clinic",
    fence: [[45, 22], [78, 22], [78, 57], [52, 57], [52, 47], [45, 38]],
    sign: [51.5, 58.5],
  },
  {
    id: "peds",
    name: "Pediatric certificate",
    motto: "Fluent in tantrum. Carries stickers at all times.",
    cost: 4,
    requires: "clinic",
    wards: [11, 12, 13, 14, 15, 18, 21, 22, 25],
    area: "Pediatric Clinic and Teddy Park",
    fence: [[77.5, 15], [100, 15], [100, 97], [67, 97], [67, 62], [77.5, 57]],
    sign: [66, 63.5],
  },
  {
    id: "wound",
    name: "Wound Care certificate",
    motto: "Has seen things. Still eats lunch.",
    cost: 5,
    requires: "peds",
    wards: [16, 26, 27, 28, 29, 30],
    area: "Spore Hills and Harbor Dock",
    fence: [[0, 15], [45.5, 15], [45.5, 28], [38, 28.5], [32, 26], [22, 25.5], [17, 29], [12, 33], [0, 36]],
    sign: [33, 27.5],
  },
];

/**
 * The Harbor Dock is the second half of the Wound Care district. It is its own polygon
 * so it does not have to wrap the whole hospital.
 */
export const EXTRA_FENCES: Array<{ cert: CertId; fence: Array<[number, number]>; sign: [number, number] }> = [
  { cert: "wound", fence: [[5, 66], [27, 66], [41, 80], [41, 97], [5, 97]], sign: [28, 67] },
];

export function certById(id: CertId): Certificate {
  return CERTIFICATES.find((cert) => cert.id === id)!;
}

/** Every fence polygon for a certificate (Wound Care has two). */
export function fencesFor(id: CertId): Array<Array<[number, number]>> {
  return [certById(id).fence, ...EXTRA_FENCES.filter((extra) => extra.cert === id).map((extra) => extra.fence)];
}

/** Signs for a certificate's fences. */
export function signsFor(id: CertId): Array<[number, number]> {
  return [certById(id).sign, ...EXTRA_FENCES.filter((extra) => extra.cert === id).map((extra) => extra.sign)];
}

/**
 * Wards that end with a gift card. The rest end without one. There are enough cards on
 * the open part of the island for each certificate in turn:
 * before Clinic 1 2 3 5 23 24 (6 cards for 3), before Pediatric 7 8 10 17 20 (+5 for 4),
 * before Wound Care 12 13 15 18 22 (+5 for 5).
 */
export const GIFT_LEVELS: readonly number[] = [1, 2, 3, 5, 7, 8, 10, 12, 13, 15, 17, 18, 20, 22, 23, 24];

export function hasGift(levelId: number): boolean {
  return GIFT_LEVELS.includes(levelId);
}

export interface CertProgress {
  openedGifts?: number[];
  certs?: CertId[];
  cardsSpent?: number;
}

/** Cards ever earned: gifts opened on gift wards. */
export function cardsEarned(save: CertProgress): number {
  return new Set((save.openedGifts ?? []).filter(hasGift)).size;
}

/** Cards in hand right now. */
export function cardsHeld(save: CertProgress): number {
  return Math.max(0, cardsEarned(save) - (save.cardsSpent ?? 0));
}

export function hasCert(save: CertProgress, id: CertId): boolean {
  return (save.certs ?? []).includes(id);
}

/** The certificate a ward sits behind, if any. */
export function certForWard(levelId: number): Certificate | null {
  return CERTIFICATES.find((cert) => cert.wards.includes(levelId)) ?? null;
}

/** The certificate still missing for a ward, or null when the ward's district is open. */
export function missingCert(save: CertProgress, levelId: number): Certificate | null {
  const cert = certForWard(levelId);
  return cert && !hasCert(save, cert.id) ? cert : null;
}

export type CertStatus =
  | { kind: "earned" }
  | { kind: "ready" }
  | { kind: "short"; need: number }
  | { kind: "blocked"; first: Certificate };

export function certStatus(save: CertProgress, id: CertId): CertStatus {
  const cert = certById(id);
  if (hasCert(save, id)) return { kind: "earned" };
  if (cert.requires && !hasCert(save, cert.requires)) return { kind: "blocked", first: certById(cert.requires) };
  const held = cardsHeld(save);
  return held >= cert.cost ? { kind: "ready" } : { kind: "short", need: cert.cost - held };
}

/** Hand in the cards. Returns the save unchanged when the certificate can't be earned yet. */
export function earnCert<T extends CertProgress>(save: T, id: CertId): T {
  if (certStatus(save, id).kind !== "ready") return save;
  return { ...save, certs: [...(save.certs ?? []), id], cardsSpent: (save.cardsSpent ?? 0) + certById(id).cost };
}

/** The next certificate to work toward, or null when all three are framed on the wall. */
export function nextCert(save: CertProgress): Certificate | null {
  return CERTIFICATES.find((cert) => !hasCert(save, cert.id)) ?? null;
}

/** Locked fences: every certificate not yet earned. */
export function lockedCerts(save: CertProgress): CertId[] {
  return CERTIFICATES.filter((cert) => !hasCert(save, cert.id)).map((cert) => cert.id);
}

const CERT_IDS = new Set<string>(["clinic", "peds", "wound"]);

/** Read certificates from an old or hand-edited save. */
export function readCerts(value: unknown): CertId[] {
  if (!Array.isArray(value)) return [];
  const out: CertId[] = [];
  for (const id of value) if (typeof id === "string" && CERT_IDS.has(id) && !out.includes(id as CertId)) out.push(id as CertId);
  return out;
}

/** Where the Certificate Center stands: on the lawn below the hospital plaza (percent). */
export const CENTER_PIN: [number, number] = [36.2, 60.5];
/** Where to stand to go in. */
export const CENTER_DOOR: [number, number] = [36.2, 68];
