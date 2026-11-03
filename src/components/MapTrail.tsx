import { MAP_SPOTS } from "@/game/levels";

const MAIN_PATH = MAP_SPOTS.filter((spot) => spot.id >= 1 && spot.id <= 15).sort((a, b) => a.id - b.id);

function lengthOf(spots: { x: number; y: number }[]) {
  let total = 0;
  for (let i = 1; i < spots.length; i++) total += Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
  return total;
}

/**
 * Candy-dot trail joining the main path pins (1 to 15) on the island.
 * Sits inside the island frame, so it pans and zooms with the camera.
 * The cleared stretch, up to `reached`, is drawn in gold.
 */
export function MapTrail({ reached }: { reached: number }) {
  const all = MAIN_PATH.map((spot) => `${spot.x},${spot.y}`).join(" ");
  const doneSpots = MAIN_PATH.filter((spot) => spot.id <= reached);
  const allLength = lengthOf(MAIN_PATH);
  const doneLength = lengthOf(doneSpots) || 1;
  const done = MAIN_PATH.filter((spot) => spot.id <= reached).map((spot) => `${spot.x},${spot.y}`).join(" ");
  return (
    <svg className="map-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polyline className="map-trail-base" points={all} />
      <polyline className="map-trail-todo" points={all} pathLength={100} />
      {done.includes(" ") ? <polyline className="map-trail-done" points={done} pathLength={100 * (doneLength / allLength)} /> : null}
    </svg>
  );
}
