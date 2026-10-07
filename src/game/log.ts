export interface Note {
  at: string;
  title: string;
  detail: string;
}

const notes: Note[] = [];
const listeners = new Set<() => void>();
let installed = false;

function textOf(detail: unknown): string {
  if (detail instanceof Error) return `${detail.message}${detail.stack ? `\n${detail.stack}` : ""}`;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function readNotes(): Note[] {
  return notes.slice();
}

export function note(title: string, detail: unknown = "") {
  const body = textOf(detail).slice(0, 700);
  notes.unshift({ at: new Date().toISOString().slice(11, 19), title, detail: body });
  if (notes.length > 20) notes.pop();
  try {
    sessionStorage.setItem("sweet-care-log", JSON.stringify(notes));
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeNotes(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function installErrorLog() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    const raw = sessionStorage.getItem("sweet-care-log");
    if (raw) {
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.title === "string") notes.push(item);
        }
      }
    }
  } catch {
    /* ignore a bad log */
  }
  window.addEventListener("error", (event) => {
    note("Error", event.error instanceof Error ? event.error : event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    note("Promise", event.reason);
  });
}
