export interface GiftCard {
  id: string;
  name: string;
  src: string;
  letter: string;
  model?: string;
}

const ROTATION: GiftCard[] = [
  { id: "durbin", name: "Dr. Durbin", src: "/cards/durbin.jpg", letter: "D" },
  { id: "kai", name: "Beat Kai", src: "/cards/beat-kai.jpg", letter: "K" },
  { id: "moss", name: "Mossroot", src: "/cards/mossroot.jpg", letter: "M" },
  { id: "niko", name: "Niko Okinawa", src: "/cards/niko.jpg", letter: "N" },
];

const RICK: GiftCard = { id: "rick", name: "Rick Rolo Mololo", src: "/cards/rick-rolo.jpg", letter: "R" };

const GHOST: GiftCard = {
  id: "ghost",
  name: "Ghost Toon",
  src: "/cards/ghost.jpg",
  letter: "G",
  model: "https://sketchfab.com/models/14c0146dbbfc42238aabb6b6a19cb842/embed?autospin=1&autostart=1&preload=1",
};

export const GIFT_CARDS: GiftCard[] = [GHOST, ...ROTATION, RICK];

export function cardForLevel(levelId: number): GiftCard {
  if (levelId === 1) return GHOST;
  if (levelId === 2) return RICK;
  const index = (Math.max(1, Math.floor(levelId)) - 1) % ROTATION.length;
  return ROTATION[index]!;
}

export function rememberGift(owned: string[] | undefined, id: string): string[] {
  const next = owned ? [...owned] : [];
  if (!next.includes(id)) next.push(id);
  return next;
}
