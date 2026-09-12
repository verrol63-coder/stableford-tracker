// ---------- Handicap / Stableford math ----------
// Distributes a Course Handicap across the holes using Stroke Index (1 = hardest).
// Positive handicaps add strokes starting at SI 1; handicaps above the hole
// count wrap around for a second stroke. Negative ("plus") handicaps remove
// strokes starting at the easiest hole (highest SI).
export function strokesOnHole(courseHandicap, strokeIndex, totalHoles) {
  const H = Math.round(courseHandicap);
  if (H >= 0) {
    const base = Math.floor(H / totalHoles);
    const extra = H % totalHoles;
    return base + (strokeIndex <= extra ? 1 : 0);
  }
  const Habs = Math.abs(H);
  const base = Math.floor(Habs / totalHoles);
  const extra = Habs % totalHoles;
  const cutoff = totalHoles - extra + 1; // remove from SI = totalHoles, totalHoles-1, ...
  return -base - (strokeIndex >= cutoff ? 1 : 0);
}

export function stablefordPoints(gross, par, strokesReceived) {
  if (gross == null || gross === "") return null;
  const net = gross - strokesReceived;
  const pts = 2 - (net - par);
  return Math.max(0, pts);
}

// WHS: Playing Handicap = Course Handicap x allowance% (rounded to nearest
// whole stroke). Individual Stableford is commonly played at 95%; some
// clubs/societies use 100% or another figure, so this is configurable per
// round rather than hard-coded.
export function playingHandicap(courseHandicap, allowancePct) {
  const pct = allowancePct == null ? 100 : allowancePct;
  return Math.round(Number(courseHandicap || 0) * (pct / 100));
}

export function netLabel(gross, par, strokesReceived) {
  if (gross == null || gross === "") return "";
  const net = gross - strokesReceived;
  const diff = net - par;
  if (diff <= -3) return "Albatross+";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return "Blob (0 pts)";
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// Round codes: short, spoken/typed easily, avoids ambiguous chars (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeRoundCode(len = 5) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

const defaultPars9 = [4, 4, 3, 5, 4, 4, 3, 5, 4];
const defaultSI9 = [7, 3, 15, 1, 11, 5, 17, 9, 13];
const defaultPars18 = [...defaultPars9, ...defaultPars9];
const defaultSI18 = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 12, 6, 18, 10, 14];

export function makeCourse(holeCount) {
  return {
    name: "",
    holeCount,
    par: holeCount === 9 ? [...defaultPars9] : [...defaultPars18],
    si: holeCount === 9 ? [...defaultSI9] : [...defaultSI18],
  };
}

export const SUGGESTED_PLAYERS = ["Verrol Skerritt", "Richard Roberts", "Dean Holmes", "Eddie Buckley"];

// Wrexham Golf Club, yellow tees. Par & Stroke Index are the club's single
// handicap table (shared across white/yellow tees) — only yardage differs
// by tee, which this tracker doesn't need. Mirrors the four-ball roster and
// tee times used by the Wrexham-golf-club-Tee-booking GitHub Action.
export const WREXHAM_COURSE = {
  name: "Wrexham Golf Club (Yellow tees)",
  holeCount: 18,
  par: [5, 4, 4, 3, 4, 5, 4, 3, 4, 3, 4, 5, 4, 3, 4, 4, 3, 4],
  si: [12, 5, 9, 17, 3, 7, 1, 18, 11, 16, 8, 2, 10, 13, 14, 4, 15, 6],
};
export const WREXHAM_FOURBALL = ["Verrol Skerritt", "Richard Roberts", "Dean Holmes", "Eddie Buckley"];
export const WREXHAM_TEE_TIME = "07:50 (fallback 08:30)";

// Vale Royal Abbey Golf Club, Whitegate, Cheshire. Men's card — Burgundy,
// Gold and Green tees share the same Par & Stroke Index; only yardage
// differs by tee, which this tracker doesn't need.
export const VALE_ROYAL_ABBEY_COURSE = {
  name: "Vale Royal Abbey Golf Club (Men's, all tees)",
  holeCount: 18,
  par: [4, 5, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 5, 3, 4, 5],
  si: [12, 10, 18, 4, 8, 16, 2, 14, 6, 11, 13, 1, 7, 15, 5, 17, 3, 9],
};

// Quinta do Lago South, Almancil, Algarve. Par & SI shared across Black/
// Gold/Silver/Green tees — only yardage differs by tee.
export const QUINTA_DO_LAGO_SOUTH_COURSE = {
  name: "Quinta do Lago South (all tees)",
  holeCount: 18,
  par: [4, 5, 4, 3, 5, 4, 3, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4],
  si: [13, 7, 5, 17, 1, 9, 15, 3, 11, 6, 16, 12, 18, 2, 8, 14, 4, 10],
};

// Quinta do Lago North, Almancil, Algarve. Par & SI shared across Black/
// Gold/Silver/Green tees — only yardage differs by tee.
export const QUINTA_DO_LAGO_NORTH_COURSE = {
  name: "Quinta do Lago North (all tees)",
  holeCount: 18,
  par: [4, 3, 5, 4, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 3, 4, 5],
  si: [15, 11, 9, 1, 5, 13, 7, 17, 3, 12, 10, 4, 6, 16, 2, 18, 14, 8],
};

// Vale do Lobo Royal, Vale do Lobo, Algarve. Par & SI shared across White/
// Yellow/Red tees — only yardage differs by tee.
export const VALE_DO_LOBO_ROYAL_COURSE = {
  name: "Vale do Lobo Royal (all tees)",
  holeCount: 18,
  par: [5, 4, 4, 4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 4, 3, 4, 4],
  si: [15, 13, 3, 11, 7, 1, 17, 5, 9, 16, 2, 12, 4, 6, 18, 10, 8, 14],
};

export function nextSundayISO() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
