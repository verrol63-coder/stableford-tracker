import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Save,
  Trash2,
  FileText,
  Flag,
  History,
  Settings,
  Users,
  Copy,
  LogOut,
  Wifi,
  WifiOff,
  Edit3,
  Award,
  RefreshCw,
} from "lucide-react";
import {
  strokesOnHole,
  stablefordPoints,
  playingHandicap,
  netLabel,
  uid,
  makeRoundCode,
  makeCourse,
  SUGGESTED_PLAYERS,
  WREXHAM_COURSE,
  WREXHAM_FOURBALL,
  WREXHAM_TEE_TIME,
  VALE_ROYAL_ABBEY_COURSE,
  nextSundayISO,
} from "./stableford";

// ---------- Personal, per-device storage (not shared) ----------
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ---------- Remembered handicaps (per device, keyed by player name) ----------
// Once a real handicap is entered anywhere for a named player, this device
// remembers it so future rounds (including the Wrexham quick-start) pre-fill
// the real number instead of resetting to the generic default. Stored as
// { [lowercaseName]: { name: "Display Case Name", handicap: 12.4 } } so the
// standalone management screen has a real name to show, not just a key.
function getKnownHandicap(name) {
  const known = loadLocal("stableford-known-handicaps", {});
  const entry = known[name.trim().toLowerCase()];
  return entry != null ? entry.handicap : null;
}
function rememberHandicap(name, value) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const num = Number(value);
  if (!Number.isFinite(num)) return;
  const known = loadLocal("stableford-known-handicaps", {});
  known[trimmed.toLowerCase()] = { name: trimmed, handicap: num };
  saveLocal("stableford-known-handicaps", known);
}
function getAllKnownPlayers() {
  const known = loadLocal("stableford-known-handicaps", {});
  return Object.values(known).sort((a, b) => a.name.localeCompare(b.name));
}
function removeKnownPlayer(name) {
  const known = loadLocal("stableford-known-handicaps", {});
  delete known[name.trim().toLowerCase()];
  saveLocal("stableford-known-handicaps", known);
}

export default function App() {
  // session = which shared round (if any) this device is currently in
  const [session, setSession] = useState(() => loadLocal("stableford-session", null));
  const [history, setHistory] = useState(() => loadLocal("stableford-history", []));
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  useEffect(() => saveLocal("stableford-session", session), [session]);
  useEffect(() => saveLocal("stableford-history", history), [history]);

  if (!session) {
    return (
      <Shell online={online} toast={toast}>
        <Home onCreate={(s) => setSession(s)} onJoin={(s) => setSession(s)} showToast={showToast} />
      </Shell>
    );
  }

  return (
    <Shell
      online={online}
      toast={toast}
      onHome={() => {
        if (window.confirm("Back to home? Your scores are saved and you can rejoin with the round code any time.")) {
          setSession(null);
        }
      }}
    >
      <ActiveRound
        session={session}
        setSession={setSession}
        history={history}
        setHistory={setHistory}
        showToast={showToast}
      />
    </Shell>
  );
}

function Shell({ children, online, toast, onHome }) {
  return (
    <div className="min-h-screen bg-emerald-50 text-slate-800 font-sans pb-24">
      <header className="bg-emerald-700 text-white px-4 py-4 shadow-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onHome}
            disabled={!onHome}
            className="flex items-center gap-2 disabled:cursor-default"
            title={onHome ? "Back to home" : undefined}
          >
            <Flag size={22} />
            <h1 className="font-bold text-lg leading-tight">Stableford Tracker</h1>
          </button>
          <div className="flex items-center gap-1 text-xs text-emerald-100">
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? "Live" : "Offline"}
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pt-4">{children}</main>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-30">
          {toast}
        </div>
      )}
    </div>
  );
}

// ==================== HOME ====================
function Home({ onCreate, onJoin, showToast }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join' | 'players' | 'hostComp' | 'viewComp'

  if (mode === "create") return <SetupScreen onStarted={onCreate} showToast={showToast} onBack={() => setMode(null)} />;
  if (mode === "join") return <JoinScreen onJoined={onJoin} showToast={showToast} onBack={() => setMode(null)} />;
  if (mode === "players") return <ManagePlayersScreen showToast={showToast} onBack={() => setMode(null)} />;
  if (mode === "hostComp") return <HostCompetitionScreen onOpenRound={onJoin} showToast={showToast} onBack={() => setMode(null)} />;
  if (mode === "viewComp") return <CompetitionLeaderboardScreen showToast={showToast} onBack={() => setMode(null)} />;

  return (
    <div className="space-y-4 mt-2">
      <button
        onClick={() => setMode("create")}
        className="w-full bg-emerald-700 text-white rounded-2xl shadow-sm p-5 text-left"
      >
        <p className="font-bold text-lg flex items-center gap-2"><Flag size={20} /> Start a new round</p>
        <p className="text-emerald-100 text-sm mt-1">Set up the course & players, get a code to share.</p>
      </button>
      <button
        onClick={() => setMode("join")}
        className="w-full bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 text-left"
      >
        <p className="font-bold text-lg flex items-center gap-2 text-emerald-800"><Users size={20} /> Join a round</p>
        <p className="text-slate-500 text-sm mt-1">Got a round code from someone? Enter it here.</p>
      </button>

      <div className="pt-2 pb-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Club competitions</p>
      </div>
      <button
        onClick={() => setMode("hostComp")}
        className="w-full bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 text-left"
      >
        <p className="font-bold text-lg flex items-center gap-2 text-emerald-800"><Award size={20} /> Host a competition</p>
        <p className="text-slate-500 text-sm mt-1">One shared course & date, many groups, one combined leaderboard.</p>
      </button>
      <button
        onClick={() => setMode("viewComp")}
        className="w-full bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 text-left"
      >
        <p className="font-bold text-lg flex items-center gap-2 text-emerald-800"><Trophy size={20} /> Competition leaderboard</p>
        <p className="text-slate-500 text-sm mt-1">Got a competition code? See everyone's combined results.</p>
      </button>

      <button
        onClick={() => setMode("players")}
        className="w-full bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 text-left"
      >
        <p className="font-bold text-lg flex items-center gap-2 text-emerald-800"><Edit3 size={20} /> Manage players & handicaps</p>
        <p className="text-slate-500 text-sm mt-1">Set everyone's real handicap once — future rounds on this device pre-fill it.</p>
      </button>
      <HistoryScreen embedded />
    </div>
  );
}

// ==================== MANAGE PLAYERS (standalone, no round needed) ====================
function ManagePlayersScreen({ showToast, onBack }) {
  const [players, setPlayers] = useState(() => getAllKnownPlayers());
  const [newName, setNewName] = useState("");
  const [newHandicap, setNewHandicap] = useState("");

  function refresh() {
    setPlayers(getAllKnownPlayers());
  }

  function updateOne(name, value) {
    rememberHandicap(name, value);
    refresh();
  }

  function removeOne(name) {
    removeKnownPlayer(name);
    refresh();
    showToast(`Removed ${name}`);
  }

  function addOne() {
    if (!newName.trim()) return showToast("Enter a name");
    if (newHandicap === "" || Number.isNaN(Number(newHandicap))) return showToast("Enter a handicap");
    rememberHandicap(newName, newHandicap);
    setNewName("");
    setNewHandicap("");
    refresh();
    showToast(`Saved ${newName.trim()}`);
  }

  return (
    <div className="space-y-4 mt-2">
      <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
        <ChevronLeft size={16} /> Back
      </button>

      <Card
        title="Players & handicaps"
        subtitle="Saved on this device only. Anyone whose real Course Handicap is entered here pre-fills automatically next time you create or join a round — including the Wrexham quick-start."
      >
        {players.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No players saved yet — add one below.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.name.toLowerCase()} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium text-slate-700">{p.name}</span>
                <input
                  type="number"
                  step="0.1"
                  className="input w-20 text-center"
                  defaultValue={p.handicap}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => updateOne(p.name, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                />
                <span className="text-[10px] text-slate-400 w-24 shrink-0">
                  95%→{playingHandicap(p.handicap, 95)} · 100%→{playingHandicap(p.handicap, 100)}
                </span>
                <button onClick={() => removeOne(p.name)} className="text-slate-400 hover:text-red-500 p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-emerald-100">
          <p className="text-xs text-slate-400 mb-2">Add a player</p>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input
              type="number"
              step="0.1"
              className="input w-20 text-center"
              placeholder="HCP"
              value={newHandicap}
              onChange={(e) => setNewHandicap(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOne()}
            />
            <button onClick={addOne} className="btn-secondary whitespace-nowrap">
              <Plus size={14} className="inline -mt-0.5" /> Add
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ==================== HOST COMPETITION ====================
// A competition is a shared course/date/allowance that many independent
// "groups" (each a normal round, same as before) attach themselves to via
// a competitionCode field. The combined leaderboard reads across all of
// them by querying rounds where competitionCode == this competition's code.
function HostCompetitionScreen({ onOpenRound, showToast, onBack }) {
  const [competition, setCompetition] = useState(null); // { code, name, ... } once created
  const [course, setCourse] = useState(makeCourse(18));
  const [name, setName] = useState("");
  const [compDate, setCompDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [handicapAllowance, setHandicapAllowance] = useState(95);
  const [creating, setCreating] = useState(false);
  const parBulkRef = useRef(null);
  const siBulkRef = useRef(null);

  function updatePar(idx, val) {
    const v = Math.max(3, Math.min(6, parseInt(val) || 4));
    setCourse((c) => {
      const par = [...c.par];
      par[idx] = v;
      return { ...c, par };
    });
  }
  function updateSI(idx, val) {
    const v = Math.max(1, Math.min(course.holeCount, parseInt(val) || 1));
    setCourse((c) => {
      const si = [...c.si];
      si[idx] = v;
      return { ...c, si };
    });
  }
  function bulkFillPar() {
    const nums = (parBulkRef.current.value.match(/\d+/g) || []).map(Number);
    if (nums.length !== course.holeCount) return showToast(`Need ${course.holeCount} numbers`);
    setCourse((c) => ({ ...c, par: nums }));
  }
  function bulkFillSI() {
    const nums = (siBulkRef.current.value.match(/\d+/g) || []).map(Number);
    if (nums.length !== course.holeCount) return showToast(`Need ${course.holeCount} numbers`);
    setCourse((c) => ({ ...c, si: nums }));
  }
  function loadWrexhamPreset() {
    setCourse({ ...WREXHAM_COURSE, par: [...WREXHAM_COURSE.par], si: [...WREXHAM_COURSE.si] });
    setName((n) => n || "Wrexham GC Competition");
    showToast("Wrexham course loaded");
  }
  function loadValeRoyalAbbeyPreset() {
    setCourse({ ...VALE_ROYAL_ABBEY_COURSE, par: [...VALE_ROYAL_ABBEY_COURSE.par], si: [...VALE_ROYAL_ABBEY_COURSE.si] });
    setName((n) => n || "Vale Royal Abbey Competition");
    showToast("Vale Royal Abbey course loaded");
  }

  async function createCompetition() {
    if (!name.trim()) return showToast("Give the competition a name");
    setCreating(true);
    try {
      const code = makeRoundCode();
      await setDoc(doc(db, "competitions", code), {
        name: name.trim(),
        courseName: course.name || "Unnamed course",
        holeCount: course.holeCount,
        par: course.par,
        si: course.si,
        date: compDate,
        handicapAllowance: Number(handicapAllowance) || 100,
        createdAt: serverTimestamp(),
      });
      setCompetition({ code, name: name.trim(), courseName: course.name, holeCount: course.holeCount, par: course.par, si: course.si, date: compDate, handicapAllowance: Number(handicapAllowance) || 100 });
    } catch (e) {
      showToast("Couldn't create the competition — check your connection");
    } finally {
      setCreating(false);
    }
  }

  if (competition) {
    return <ManageCompetitionScreen competition={competition} onOpenRound={onOpenRound} showToast={showToast} onBack={onBack} />;
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="bg-emerald-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">Quick start</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Wrexham Golf Club course</p>
            <p className="text-xs text-emerald-100">Yellow tees par/stroke-index, loaded in one tap</p>
          </div>
          <button onClick={loadWrexhamPreset} className="bg-white text-emerald-700 text-sm font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
            Load
          </button>
        </div>
      </div>

      <div className="bg-emerald-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">Quick start</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Vale Royal Abbey Golf Club course</p>
            <p className="text-xs text-emerald-100">Men's Par/SI, all tees, loaded in one tap</p>
          </div>
          <button onClick={loadValeRoyalAbbeyPreset} className="bg-white text-emerald-700 text-sm font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
            Load
          </button>
        </div>
      </div>

      <Card title="Competition details">
        <Field label="Competition name">
          <input className="input" placeholder="e.g. July Medal Stableford" value={name} onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Course name">
            <input className="input" placeholder="e.g. Wrexham Golf Club" value={course.name} onFocus={(e) => e.target.select()} onChange={(e) => setCourse((c) => ({ ...c, name: e.target.value }))} />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={compDate} onChange={(e) => setCompDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Handicap allowance (%)">
            <input type="number" className="input" value={handicapAllowance} onChange={(e) => setHandicapAllowance(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          {[9, 18].map((n) => (
            <button
              key={n}
              onClick={() => setCourse(makeCourse(n))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                course.holeCount === n ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-emerald-700 border-emerald-200"
              }`}
            >
              {n} holes
            </button>
          ))}
        </div>
      </Card>

      <Card title="Par & Stroke Index" subtitle="Shared by every group in this competition">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="label">Paste Par</label>
            <div className="flex gap-1">
              <input ref={parBulkRef} className="input flex-1" placeholder={course.par.join(",")} />
              <button onClick={bulkFillPar} className="btn-secondary px-3">Fill</button>
            </div>
          </div>
          <div>
            <label className="label">Paste Stroke Index</label>
            <div className="flex gap-1">
              <input ref={siBulkRef} className="input flex-1" placeholder={course.si.join(",")} />
              <button onClick={bulkFillSI} className="btn-secondary px-3">Fill</button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium py-1 px-1">Hole</th>
                {course.par.map((_, i) => <th key={i} className="font-medium py-1 px-1 text-center w-8">{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 px-1 font-medium text-slate-500">Par</td>
                {course.par.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <input type="number" value={v} onChange={(e) => updatePar(i, e.target.value)} className="w-8 text-center text-xs border border-slate-200 rounded py-1" />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 px-1 font-medium text-slate-500">S.I.</td>
                {course.si.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <input type="number" value={v} onChange={(e) => updateSI(i, e.target.value)} className="w-8 text-center text-xs border border-slate-200 rounded py-1" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <button onClick={createCompetition} disabled={creating} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
        <Award size={18} /> {creating ? "Creating..." : "Create competition & add groups"}
      </button>
    </div>
  );
}

// ==================== MANAGE COMPETITION (add groups, share codes) ====================
function ManageCompetitionScreen({ competition, onOpenRound, showToast, onBack }) {
  const [groups, setGroups] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [mode, setMode] = useState("manage"); // 'manage' | 'leaderboard'

  useEffect(() => {
    const q = query(collection(db, "rounds"), where("competitionCode", "==", competition.code));
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ code: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [competition.code]);

  function copyCode() {
    navigator.clipboard?.writeText(competition.code).then(() => showToast("Competition code copied"));
  }

  if (mode === "leaderboard") {
    return (
      <CompetitionLeaderboardScreen
        showToast={showToast}
        onBack={() => setMode("manage")}
        initialCode={competition.code}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
        <ChevronLeft size={16} /> Back to home
      </button>

      <div className="bg-emerald-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">Competition code — for the combined leaderboard</p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold tracking-[0.2em]">{competition.code}</p>
          <button onClick={copyCode} className="bg-white text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
            <Copy size={14} /> Copy
          </button>
        </div>
        <p className="text-xs text-emerald-100 mt-1">{competition.name} · {competition.courseName || "Course"} · {competition.date}</p>
      </div>

      <Card title={`Groups (${groups.length})`} subtitle="Each group gets its own code for players to join and enter scores — separate from the competition code above.">
        {groups.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No groups yet — add the first four-ball below.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => (
              <div key={g.code} className="flex items-center justify-between border border-emerald-100 rounded-lg px-3 py-2">
                <div>
                  <p className="font-semibold text-sm text-slate-700">Group {i + 1} <span className="font-mono text-emerald-700">{g.code}</span></p>
                  <p className="text-xs text-slate-400">{g.teeTime ? `${g.teeTime} tee` : "No tee time set"}</p>
                </div>
                <button onClick={() => onOpenRound({ code: g.code, mePlayerId: null })} className="btn-secondary text-xs">
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowAddGroup(true)} className="btn-secondary mt-3 w-full flex items-center justify-center gap-1">
          <Plus size={16} /> Add group
        </button>
      </Card>

      <button
        onClick={() => setMode("leaderboard")}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
      >
        <Trophy size={18} /> View combined leaderboard
      </button>

      {showAddGroup && (
        <AddGroupModal
          competition={competition}
          onClose={() => setShowAddGroup(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function AddGroupModal({ competition, onClose, showToast }) {
  const [players, setPlayers] = useState([{ id: uid(), name: "", handicap: 18 }]);
  const [teeTime, setTeeTime] = useState("");
  const [creating, setCreating] = useState(false);

  function addPlayer(name = "") {
    const known = name ? getKnownHandicap(name) : null;
    setPlayers((ps) => [...ps, { id: uid(), name, handicap: known != null ? known : 18 }]);
  }
  function removePlayer(id) {
    setPlayers((ps) => ps.filter((p) => p.id !== id));
  }
  function updatePlayer(id, field, value) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function createGroup() {
    if (players.some((p) => !p.name.trim())) return showToast("Give every player a name");
    setCreating(true);
    try {
      const code = makeRoundCode();
      players.forEach((p) => rememberHandicap(p.name, p.handicap));
      await setDoc(doc(db, "rounds", code), {
        courseName: competition.courseName || "Unnamed course",
        holeCount: competition.holeCount,
        par: competition.par,
        si: competition.si,
        date: competition.date,
        teeTime,
        handicapAllowance: competition.handicapAllowance,
        competitionCode: competition.code,
        createdAt: serverTimestamp(),
      });
      await Promise.all(
        players.map((p) =>
          setDoc(doc(db, "rounds", code, "players", p.id), {
            name: p.name.trim(),
            handicap: Number(p.handicap) || 0,
            scores: {},
            updatedAt: serverTimestamp(),
          })
        )
      );
      showToast(`Group created — code ${code}`);
      onClose();
    } catch (e) {
      showToast("Couldn't create the group — check your connection");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-3">Add a group</h3>
        <Field label="Tee time (optional)">
          <input className="input" placeholder="e.g. 09:10" value={teeTime} onChange={(e) => setTeeTime(e.target.value)} />
        </Field>
        <div className="mt-3 space-y-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Player name" value={p.name} onChange={(e) => updatePlayer(p.id, "name", e.target.value)} />
              <input
                type="number"
                step="0.1"
                className="input w-16 text-center"
                value={p.handicap}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updatePlayer(p.id, "handicap", parseFloat(e.target.value) || 0)}
              />
              <button onClick={() => removePlayer(p.id)} className="text-slate-400 hover:text-red-500 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addPlayer("")} className="btn-secondary mt-2 w-full flex items-center justify-center gap-1">
          <Plus size={16} /> Add player
        </button>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {WREXHAM_FOURBALL.filter((n) => !players.some((p) => p.name === n)).map((n) => (
            <button key={n} onClick={() => addPlayer(n)} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
              + {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={createGroup} disabled={creating} className="btn-primary flex-1">
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== COMPETITION LEADERBOARD (combined across groups) ====================
function CompetitionLeaderboardScreen({ showToast, onBack, initialCode }) {
  const [code, setCode] = useState(initialCode || "");
  const [competition, setCompetition] = useState(null);
  const [rows, setRows] = useState([]); // flattened players across all groups
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialCode) load(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function load(codeOverride) {
    const c = (codeOverride ?? code).trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      const compSnap = await getDoc(doc(db, "competitions", c));
      if (!compSnap.exists()) {
        showToast("No competition found with that code");
        setCompetition(null);
        return;
      }
      const comp = { code: c, ...compSnap.data() };
      setCompetition(comp);
      await refresh(comp);
    } catch (e) {
      showToast("Couldn't reach the competition — check your connection");
    } finally {
      setLoading(false);
    }
  }

  async function refresh(comp = competition) {
    if (!comp) return;
    setLoading(true);
    try {
      const roundsSnap = await getDocs(query(collection(db, "rounds"), where("competitionCode", "==", comp.code)));
      const allRows = [];
      for (const roundDoc of roundsSnap.docs) {
        const round = roundDoc.data();
        const playersSnap = await getDocs(collection(db, "rounds", roundDoc.id, "players"));
        playersSnap.docs.forEach((pd) => {
          const p = pd.data();
          let total = 0;
          let holesPlayed = 0;
          const ph = playingHandicap(p.handicap, comp.handicapAllowance);
          for (let i = 0; i < comp.holeCount; i++) {
            const gross = p.scores?.[i];
            if (gross == null || gross === "") continue;
            const sr = strokesOnHole(ph, comp.si[i], comp.holeCount);
            total += stablefordPoints(gross, comp.par[i], sr);
            holesPlayed++;
          }
          allRows.push({ name: p.name, handicap: p.handicap, total, holesPlayed, groupCode: roundDoc.id });
        });
      }
      allRows.sort((a, b) => b.total - a.total);
      setRows(allRows);
    } catch (e) {
      showToast("Couldn't refresh — check your connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 mt-2">
      <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
        <ChevronLeft size={16} /> Back
      </button>

      <Card title="Enter competition code">
        <div className="flex gap-2">
          <input
            className="input flex-1 uppercase tracking-widest text-center font-semibold text-lg"
            placeholder="ABCDE"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button onClick={load} disabled={loading} className="btn-primary px-4">{loading ? "..." : "Find"}</button>
        </div>
      </Card>

      {competition && (
        <Card title={competition.name} subtitle={`${competition.courseName || "Course"} · ${competition.date} · ${rows.length} players across ${new Set(rows.map((r) => r.groupCode)).size} group(s)`}>
          <button onClick={() => refresh()} disabled={loading} className="btn-secondary mb-3 flex items-center gap-1">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No scores entered yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((p, i) => (
                <div key={`${p.groupCode}-${p.name}`} className="flex items-center gap-3">
                  <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>
                    {i === 0 ? <Trophy size={16} className="inline" /> : i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-400 ml-1.5">hcp {p.handicap} · {p.holesPlayed}/{competition.holeCount} holes</span>
                  </span>
                  <span className="text-lg font-bold text-emerald-700">{p.total} pts</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">This doesn't auto-refresh — tap Refresh to pull the latest scores from every group.</p>
        </Card>
      )}
    </div>
  );
}

// ==================== JOIN ====================
function JoinScreen({ onJoined, showToast, onBack }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null); // { meta, players }
  const [editedHandicaps, setEditedHandicaps] = useState({}); // playerId -> string
  const [newName, setNewName] = useState("");
  const [newHandicap, setNewHandicap] = useState(18);

  async function findRound() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      const roundSnap = await getDoc(doc(db, "rounds", c));
      if (!roundSnap.exists()) {
        showToast("No round found with that code");
        setFound(null);
        return;
      }
      // players are read live once here just to build the picker list;
      // ActiveRound takes over with a live listener after joining.
      const playersSnap = await getDocs(collection(db, "rounds", c, "players"));
      const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFound({ code: c, meta: roundSnap.data(), players });
      // Pre-fill with what this device remembers for each name, if the
      // round still has them at the generic default (18) — i.e. probably
      // never corrected by whoever set the round up.
      setEditedHandicaps(
        Object.fromEntries(
          players.map((p) => {
            const known = getKnownHandicap(p.name);
            const value = known != null && Number(p.handicap) === 18 ? known : p.handicap;
            return [p.id, value];
          })
        )
      );
    } catch (e) {
      showToast("Couldn't reach the round — check your connection");
    } finally {
      setLoading(false);
    }
  }

  async function joinAs(playerId, handicapValue, playerName) {
    // Push their corrected handicap (if changed) before joining.
    await setDoc(
      doc(db, "rounds", found.code, "players", playerId),
      { handicap: Number(handicapValue) || 0, updatedAt: serverTimestamp() },
      { merge: true }
    );
    if (playerName) rememberHandicap(playerName, handicapValue);
    onJoined({ code: found.code, mePlayerId: playerId });
  }

  async function joinAsNew() {
    if (!newName.trim()) {
      showToast("Enter your name");
      return;
    }
    const id = uid();
    await setDoc(doc(db, "rounds", found.code, "players", id), {
      name: newName.trim(),
      handicap: Number(newHandicap) || 0,
      scores: {},
      updatedAt: serverTimestamp(),
    });
    rememberHandicap(newName, newHandicap);
    onJoined({ code: found.code, mePlayerId: id });
  }

  return (
    <div className="space-y-4 mt-2">
      <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
        <ChevronLeft size={16} /> Back
      </button>
      <Card title="Enter round code">
        <div className="flex gap-2">
          <input
            className="input flex-1 uppercase tracking-widest text-center font-semibold text-lg"
            placeholder="ABCDE"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button onClick={findRound} disabled={loading} className="btn-primary px-4">
            {loading ? "..." : "Find"}
          </button>
        </div>
      </Card>

      {found && (
        <Card title={found.meta.courseName || "Round found"} subtitle={`${found.meta.date} · ${found.meta.holeCount} holes`}>
          <p className="text-sm text-slate-500 mb-2">Which one are you? Check/fix your Course Handicap here before joining.</p>
          <div className="space-y-2">
            {found.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-emerald-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm">{p.name}</span>
                <input
                  type="number"
                  step="0.1"
                  className="input w-16 text-center"
                  value={editedHandicaps[p.id] ?? p.handicap}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditedHandicaps((h) => ({ ...h, [p.id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => joinAs(p.id, editedHandicaps[p.id] ?? p.handicap, p.name)}
                  className="btn-secondary whitespace-nowrap"
                >
                  This is me
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100">
            <p className="text-xs text-slate-400 mb-2">Not listed? Add yourself:</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Your name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input
                type="number"
                step="0.1"
                className="input w-20 text-center"
                value={newHandicap}
                onChange={(e) => setNewHandicap(e.target.value)}
              />
              <button onClick={joinAsNew} className="btn-secondary">Join</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ==================== SETUP (create) ====================
function SetupScreen({ onStarted, showToast, onBack }) {
  const [course, setCourse] = useState(makeCourse(18));
  const [players, setPlayers] = useState([{ id: uid(), name: "", handicap: 18 }]);
  const [mePlayerId, setMePlayerId] = useState(players[0].id);
  const [roundDate, setRoundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [teeTime, setTeeTime] = useState("");
  const [handicapAllowance, setHandicapAllowance] = useState(95);
  const [creating, setCreating] = useState(false);
  const parBulkRef = useRef(null);
  const siBulkRef = useRef(null);

  function updatePar(idx, val) {
    const v = Math.max(3, Math.min(6, parseInt(val) || 4));
    setCourse((c) => {
      const par = [...c.par];
      par[idx] = v;
      return { ...c, par };
    });
  }
  function updateSI(idx, val) {
    const v = Math.max(1, Math.min(course.holeCount, parseInt(val) || 1));
    setCourse((c) => {
      const si = [...c.si];
      si[idx] = v;
      return { ...c, si };
    });
  }
  function bulkFillPar() {
    const nums = (parBulkRef.current.value.match(/\d+/g) || []).map(Number);
    if (nums.length !== course.holeCount) return showToast(`Need ${course.holeCount} numbers`);
    setCourse((c) => ({ ...c, par: nums }));
  }
  function bulkFillSI() {
    const nums = (siBulkRef.current.value.match(/\d+/g) || []).map(Number);
    if (nums.length !== course.holeCount) return showToast(`Need ${course.holeCount} numbers`);
    setCourse((c) => ({ ...c, si: nums }));
  }
  function setHoleCount(n) {
    const c = makeCourse(n);
    setCourse(c);
  }
  function addPlayer(name = "") {
    const known = name ? getKnownHandicap(name) : null;
    const p = { id: uid(), name, handicap: known != null ? known : 18 };
    setPlayers((ps) => [...ps, p]);
    return p;
  }
  function removePlayer(id) {
    setPlayers((ps) => ps.filter((p) => p.id !== id));
    if (mePlayerId === id) setMePlayerId(null);
  }
  function updatePlayer(id, field, value) {
    setPlayers((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        // If they've just typed a name we recognise and haven't touched the
        // handicap yet (still at the generic default), apply what we know.
        if (field === "name") {
          const known = getKnownHandicap(value);
          if (known != null && Number(p.handicap) === 18) updated.handicap = known;
        }
        return updated;
      })
    );
    if (field === "handicap") {
      const player = players.find((p) => p.id === id);
      if (player?.name) rememberHandicap(player.name, value);
    }
  }

  function loadWrexhamPreset() {
    setCourse({ ...WREXHAM_COURSE, par: [...WREXHAM_COURSE.par], si: [...WREXHAM_COURSE.si] });
    const newPlayers = WREXHAM_FOURBALL.map((n) => {
      const known = getKnownHandicap(n);
      return { id: uid(), name: n, handicap: known != null ? known : 18 };
    });
    setPlayers(newPlayers);
    setMePlayerId(newPlayers[0].id);
    setRoundDate(nextSundayISO());
    setTeeTime(WREXHAM_TEE_TIME);
    const anyKnown = newPlayers.some((p) => getKnownHandicap(p.name) != null);
    showToast(
      anyKnown
        ? "Loaded Sunday four-ball @ Wrexham (remembered handicaps applied)"
        : "Loaded Sunday four-ball @ Wrexham — check everyone's handicap below"
    );
  }

  function loadValeRoyalAbbeyPreset() {
    setCourse({ ...VALE_ROYAL_ABBEY_COURSE, par: [...VALE_ROYAL_ABBEY_COURSE.par], si: [...VALE_ROYAL_ABBEY_COURSE.si] });
    showToast("Vale Royal Abbey course loaded");
  }

  async function startRound() {
    if (players.length === 0) return showToast("Add at least one player");
    if (players.some((p) => !p.name.trim())) return showToast("Give every player a name");
    if (!mePlayerId) return showToast("Pick which player is you");

    players.forEach((p) => rememberHandicap(p.name, p.handicap));

    setCreating(true);
    try {
      const code = makeRoundCode();
      await setDoc(doc(db, "rounds", code), {
        courseName: course.name || "Unnamed course",
        holeCount: course.holeCount,
        par: course.par,
        si: course.si,
        date: roundDate,
        teeTime,
        handicapAllowance: Number(handicapAllowance) || 100,
        createdAt: serverTimestamp(),
      });
      await Promise.all(
        players.map((p) =>
          setDoc(doc(db, "rounds", code, "players", p.id), {
            name: p.name.trim(),
            handicap: Number(p.handicap) || 0,
            scores: {},
            updatedAt: serverTimestamp(),
          })
        )
      );
      onStarted({ code, mePlayerId });
    } catch (e) {
      showToast("Couldn't create the round — check your connection");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1">
          <ChevronLeft size={16} /> Back
        </button>
      )}

      <div className="bg-emerald-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">Quick start</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Sunday four-ball @ Wrexham</p>
            <p className="text-xs text-emerald-100">Same roster & tee times as your booking bot, yellow tees, next Sunday</p>
          </div>
          <button onClick={loadWrexhamPreset} className="bg-white text-emerald-700 text-sm font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
            Load
          </button>
        </div>
      </div>

      <div className="bg-emerald-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">Quick start</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Vale Royal Abbey Golf Club course</p>
            <p className="text-xs text-emerald-100">Men's Par/SI, all tees, loaded in one tap</p>
          </div>
          <button onClick={loadValeRoyalAbbeyPreset} className="bg-white text-emerald-700 text-sm font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
            Load
          </button>
        </div>
      </div>

      <Card title="Round details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Course name">
            <input className="input" placeholder="e.g. Wrexham Golf Club" value={course.name} onFocus={(e) => e.target.select()} onChange={(e) => setCourse((c) => ({ ...c, name: e.target.value }))} />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Tee time (optional)">
            <input className="input" placeholder="e.g. 07:50" value={teeTime} onChange={(e) => setTeeTime(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Handicap allowance (%)">
            <input
              type="number"
              className="input"
              value={handicapAllowance}
              onChange={(e) => setHandicapAllowance(e.target.value)}
            />
          </Field>
          <p className="text-xs text-slate-400 mt-1">
            Applied to each player's Course Handicap to get their Playing Handicap. WHS individual Stableford is commonly 95% — check what your club/competition uses.
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          {[9, 18].map((n) => (
            <button
              key={n}
              onClick={() => setHoleCount(n)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                course.holeCount === n ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-emerald-700 border-emerald-200"
              }`}
            >
              {n} holes
            </button>
          ))}
        </div>
      </Card>

      <Card title="Par & Stroke Index" subtitle="Copy these straight off any scorecard, anywhere in the world">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="label">Paste Par</label>
            <div className="flex gap-1">
              <input ref={parBulkRef} className="input flex-1" placeholder={course.par.join(",")} />
              <button onClick={bulkFillPar} className="btn-secondary px-3">Fill</button>
            </div>
          </div>
          <div>
            <label className="label">Paste Stroke Index</label>
            <div className="flex gap-1">
              <input ref={siBulkRef} className="input flex-1" placeholder={course.si.join(",")} />
              <button onClick={bulkFillSI} className="btn-secondary px-3">Fill</button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium py-1 px-1">Hole</th>
                {course.par.map((_, i) => (
                  <th key={i} className="font-medium py-1 px-1 text-center w-8">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 px-1 font-medium text-slate-500">Par</td>
                {course.par.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <input type="number" value={v} onChange={(e) => updatePar(i, e.target.value)} className="w-8 text-center text-xs border border-slate-200 rounded py-1" />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 px-1 font-medium text-slate-500">S.I.</td>
                {course.si.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <input type="number" value={v} onChange={(e) => updateSI(i, e.target.value)} className="w-8 text-center text-xs border border-slate-200 rounded py-1" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Players & handicaps" subtitle="Course Handicap already adjusted for this course. Tap a name to mark it as you.">
        <div className="space-y-3">
          {players.map((p) => (
            <div key={p.id}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMePlayerId(p.id)}
                  title="This is me"
                  className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${
                    mePlayerId === p.id ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-300 border-slate-200"
                  }`}
                >
                  Me
                </button>
                <input className="input flex-1" placeholder="Player name" value={p.name} onChange={(e) => updatePlayer(p.id, "name", e.target.value)} />
                <input
                  type="number"
                  step="0.1"
                  className="input w-16 text-center"
                  value={p.handicap}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updatePlayer(p.id, "handicap", parseFloat(e.target.value) || 0)}
                />
                <button onClick={() => removePlayer(p.id)} className="text-slate-400 hover:text-red-500 p-2">
                  <Trash2 size={16} />
                </button>
              </div>
              {p.name && Number(p.handicap) !== 0 && (
                <p className="text-[10px] text-slate-400 pl-9 mt-0.5">
                  Playing HCP — 100%: <span className="font-semibold text-slate-500">{playingHandicap(p.handicap, 100)}</span> · 95%: <span className="font-semibold text-slate-500">{playingHandicap(p.handicap, 95)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => addPlayer("")} className="btn-secondary mt-3 w-full flex items-center justify-center gap-1">
          <Plus size={16} /> Add player
        </button>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTED_PLAYERS.filter((n) => !players.some((p) => p.name === n)).map((n) => (
            <button key={n} onClick={() => addPlayer(n)} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
              + {n}
            </button>
          ))}
        </div>
      </Card>

      <button onClick={startRound} disabled={creating} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
        <Flag size={18} /> {creating ? "Creating..." : "Start round & get code"}
      </button>
      <p className="text-xs text-center text-slate-400">
        This creates a shareable round code. Anyone with the code can view and add scores to this round — don't post it publicly.
      </p>
    </div>
  );
}

// ==================== ACTIVE ROUND (live) ====================
function ActiveRound({ session, setSession, history, setHistory, showToast }) {
  const { code, mePlayerId } = session;
  const [tab, setTab] = useState("play");
  const [meta, setMeta] = useState(null);
  const [players, setPlayers] = useState([]); // [{id, name, handicap, scores}]
  const [currentHole, setCurrentHole] = useState(0);
  const [connError, setConnError] = useState(false);
  const [finished, setFinished] = useState(false);
  const pendingWrites = useRef({}); // playerId -> timeout id

  useEffect(() => {
    const unsubMeta = onSnapshot(
      doc(db, "rounds", code),
      (snap) => {
        setConnError(false);
        if (snap.exists()) setMeta(snap.data());
      },
      () => setConnError(true)
    );
    const unsubPlayers = onSnapshot(
      collection(db, "rounds", code, "players"),
      (snap) => {
        setConnError(false);
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setConnError(true)
    );
    return () => {
      unsubMeta();
      unsubPlayers();
    };
  }, [code]);

  function leaveRound() {
    setSession(null);
  }

  async function setHandicap(playerId, value) {
    setPlayers((ps) => ps.map((p) => (p.id === playerId ? { ...p, handicap: value } : p)));
    try {
      await setDoc(
        doc(db, "rounds", code, "players", playerId),
        { handicap: Number(value) || 0, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      showToast("Couldn't sync handicap — will retry when back online");
    }
  }

  function setScore(playerId, holeIdx, value) {
    // optimistic local update
    setPlayers((ps) =>
      ps.map((p) => (p.id === playerId ? { ...p, scores: { ...(p.scores || {}), [holeIdx]: value } } : p))
    );
    clearTimeout(pendingWrites.current[playerId]);
    pendingWrites.current[playerId] = setTimeout(async () => {
      const player = players.find((p) => p.id === playerId);
      const scores = { ...(player?.scores || {}), [holeIdx]: value };
      try {
        await setDoc(
          doc(db, "rounds", code, "players", playerId),
          { scores, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {
        showToast("Couldn't sync that score — will retry when back online");
      }
    }, 600);
  }

  function playerTotal(player) {
    if (!meta) return { total: 0, holesPlayed: 0 };
    let total = 0;
    let holesPlayed = 0;
    const ph = playingHandicap(player.handicap, meta.handicapAllowance);
    for (let i = 0; i < meta.holeCount; i++) {
      const gross = player.scores?.[i];
      if (gross == null || gross === "") continue;
      const sr = strokesOnHole(ph, meta.si[i], meta.holeCount);
      total += stablefordPoints(gross, meta.par[i], sr);
      holesPlayed++;
    }
    return { total, holesPlayed };
  }

  const leaderboard = useMemo(
    () => players.map((p) => ({ ...p, ...playerTotal(p) })).sort((a, b) => b.total - a.total),
    [players, meta]
  );

  function finishRound() {
    if (!meta) return;
    const entry = {
      id: uid(),
      code,
      date: meta.date,
      courseName: meta.courseName,
      teeTime: meta.teeTime,
      holeCount: meta.holeCount,
      players: leaderboard.map((p) => ({ id: p.id, name: p.name, handicap: p.handicap, total: p.total, holesPlayed: p.holesPlayed })),
    };
    setHistory((h) => [entry, ...h]);
    setFinished(true);
    showToast("Saved to your history");
  }

  if (!meta) {
    return (
      <div className="mt-6 text-center text-slate-400 text-sm">
        {connError ? "Can't reach the round — check your connection." : "Loading round…"}
      </div>
    );
  }

  if (finished) {
    return (
      <ResultsScreen
        meta={meta}
        leaderboard={leaderboard}
        code={code}
        onReview={() => {
          setTab("card");
          setFinished(false);
        }}
        onDone={() => setSession(null)}
      />
    );
  }

  return (
    <div className="pb-4">
      <RoundCodeBar code={code} onLeave={leaveRound} showToast={showToast} allowance={meta.handicapAllowance} />

      {tab === "play" && (
        <PlayScreen
          meta={meta}
          players={players}
          setScore={setScore}
          setHandicap={setHandicap}
          mePlayerId={mePlayerId}
          currentHole={currentHole}
          setCurrentHole={setCurrentHole}
          finishRound={finishRound}
        />
      )}
      {tab === "card" && <ScorecardScreen meta={meta} players={players} setScore={setScore} setHandicap={setHandicap} leaderboard={leaderboard} />}
      {tab === "history" && <HistoryScreen />}

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-emerald-100 shadow-lg z-20">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          <TabButton icon={<Flag size={18} />} label="Play" active={tab === "play"} onClick={() => setTab("play")} />
          <TabButton icon={<FileText size={18} />} label="Card" active={tab === "card"} onClick={() => setTab("card")} />
          <TabButton icon={<History size={18} />} label="History" active={tab === "history"} onClick={() => setTab("history")} />
        </div>
      </nav>
    </div>
  );
}

function RoundCodeBar({ code, onLeave, showToast, allowance }) {
  function copy() {
    navigator.clipboard?.writeText(code).then(() => showToast("Code copied"));
  }
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-emerald-100 p-3 mb-4">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Round code — share with your group</p>
        <p className="text-2xl font-bold tracking-[0.2em] text-emerald-700">{code}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{allowance ?? 100}% handicap allowance</p>
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="btn-secondary flex items-center gap-1"><Copy size={14} /> Copy</button>
        <button onClick={onLeave} className="text-slate-400 hover:text-red-500 p-2" title="Leave round">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}

// ==================== RESULTS (shown after "Finish round") ====================
function ResultsScreen({ meta, leaderboard, code, onReview, onDone }) {
  return (
    <div className="space-y-4 mt-2">
      <div className="bg-emerald-700 rounded-2xl shadow-sm p-5 text-white text-center">
        <Trophy size={28} className="mx-auto mb-2 text-amber-300" />
        <p className="font-bold text-lg">Round complete</p>
        <p className="text-emerald-100 text-sm mt-0.5">{meta.courseName} · {meta.date}</p>
      </div>

      <Card title="Final points">
        <div className="space-y-2">
          {leaderboard.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 ${i === 0 ? "bg-amber-50" : ""}`}>
              <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>
                {i === 0 ? <Trophy size={16} className="inline" /> : i + 1}
              </span>
              <span className="flex-1">
                <span className="font-semibold text-slate-800">{p.name}</span>
                <span className="text-xs text-slate-400 ml-1.5">hcp {p.handicap} · {p.holesPlayed}/{meta.holeCount} holes</span>
              </span>
              <span className="text-xl font-bold text-emerald-700">{p.total} pts</span>
            </div>
          ))}
        </div>
        {leaderboard.some((p) => p.holesPlayed < meta.holeCount) && (
          <p className="text-xs text-amber-600 mt-3">
            Heads up — not everyone has all {meta.holeCount} holes entered yet. This is the leaderboard so far; check back on the Card tab once everyone's finished.
          </p>
        )}
      </Card>

      <p className="text-xs text-center text-slate-400">
        This result is saved on your device. Others in the round (code <span className="font-mono font-semibold">{code}</span>) can see the same live totals from the Card tab any time — they don't need to "finish" for the numbers to be accurate.
      </p>

      <div className="space-y-2 pt-2">
        <button onClick={onReview} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
          <FileText size={16} /> Review full scorecard
        </button>
        <button onClick={onDone} className="btn-primary w-full py-3">
          Done — back to home
        </button>
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium ${active ? "text-emerald-700" : "text-slate-400"}`}>
      {icon}
      {label}
    </button>
  );
}

// ==================== PLAY (hole by hole) ====================
function PlayScreen({ meta, players, setScore, setHandicap, mePlayerId, currentHole, setCurrentHole, finishRound }) {
  const isLast = currentHole === meta.holeCount - 1;
  const isFirst = currentHole === 0;
  const holePar = meta.par[currentHole];
  const holeSI = meta.si[currentHole];
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [simple, setSimple] = useState(true);

  function startEdit(p) {
    setEditingId(p.id);
    setEditValue(String(p.handicap));
  }
  function confirmEdit(playerId, playerName) {
    setHandicap(playerId, editValue);
    rememberHandicap(playerName, editValue);
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setCurrentHole((h) => Math.max(0, h - 1))} disabled={isFirst} className="p-2 rounded-full disabled:opacity-30 bg-emerald-50 text-emerald-700">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Hole</p>
            <p className="text-3xl font-bold text-emerald-800 leading-none">{currentHole + 1}</p>
            <p className="text-xs text-slate-500 mt-1">Par {holePar} · S.I. {holeSI}</p>
          </div>
          <button onClick={() => setCurrentHole((h) => Math.min(meta.holeCount - 1, h + 1))} disabled={isLast} className="p-2 rounded-full disabled:opacity-30 bg-emerald-50 text-emerald-700">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex justify-center gap-1 mt-2 flex-wrap">
          {meta.par.map((_, i) => (
            <button key={i} onClick={() => setCurrentHole(i)} className={`w-6 h-6 text-[10px] rounded-full flex items-center justify-center ${i === currentHole ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700"}`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-400">{simple ? "Simple scoring — for one scorer entering everyone" : "Detailed view — handicap breakdown per player"}</p>
        <button onClick={() => setSimple((s) => !s)} className="text-xs font-semibold text-emerald-700 underline underline-offset-2 whitespace-nowrap ml-2">
          {simple ? "Show details" : "Simple view"}
        </button>
      </div>

      {simple ? (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 divide-y divide-emerald-50">
          {players.map((p) => {
            const gross = p.scores?.[currentHole];
            const ph = playingHandicap(p.handicap, meta.handicapAllowance);
            const sr = strokesOnHole(ph, holeSI, meta.holeCount);
            const pts = stablefordPoints(gross, holePar, sr);
            const isMe = p.id === mePlayerId;
            return (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-1">
                    {p.name}
                    {sr !== 0 && <span className="text-[10px] font-normal text-slate-400">{sr > 0 ? `+${sr}` : sr}</span>}
                  </p>
                  {gross != null && gross !== "" && (
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">{pts} pt{pts === 1 ? "" : "s"} · {netLabel(gross, holePar, sr)}</p>
                  )}
                </div>
                <button onClick={() => setScore(p.id, currentHole, Math.max(1, (gross || holePar) - 1))} className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Minus size={16} />
                </button>
                <div className="w-8 text-center shrink-0">
                  <p className="text-xl font-bold text-slate-800">{gross ?? "–"}</p>
                </div>
                <button onClick={() => setScore(p.id, currentHole, (gross || holePar - 1) + 1)} className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {players.map((p) => {
            const gross = p.scores?.[currentHole];
            const ph = playingHandicap(p.handicap, meta.handicapAllowance);
            const sr = strokesOnHole(ph, holeSI, meta.holeCount);
            const pts = stablefordPoints(gross, holePar, sr);
            const isMe = p.id === mePlayerId;
            return (
              <div key={p.id} className={`bg-white rounded-2xl shadow-sm border p-4 ${isMe ? "border-emerald-400 ring-1 ring-emerald-200" : "border-emerald-100"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {p.name}
                      {isMe && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">You</span>}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                      {editingId === p.id ? (
                        <>
                          <span>Course HCP</span>
                          <input
                            type="number"
                            step="0.1"
                            autoFocus
                            value={editValue}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && confirmEdit(p.id, p.name)}
                            className="w-14 border border-emerald-300 rounded px-1 py-0.5 text-xs text-center"
                          />
                          <button onClick={() => confirmEdit(p.id, p.name)} className="text-emerald-700 font-semibold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400">Cancel</button>
                        </>
                      ) : (
                        <>
                          <span>
                            Course HCP {p.handicap} → Playing {ph} ({meta.handicapAllowance ?? 100}%) · {sr > 0 ? `+${sr} shot${sr > 1 ? "s" : ""} here` : sr < 0 ? `${sr} shot here` : "no shot here"}
                          </span>
                          <button onClick={() => startEdit(p)} className="text-emerald-600 underline underline-offset-2">edit</button>
                        </>
                      )}
                    </p>
                  </div>
                  {gross != null && gross !== "" && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-700 leading-none">{pts}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{netLabel(gross, holePar, sr)}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setScore(p.id, currentHole, Math.max(1, (gross || holePar) - 1))} className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Minus size={18} />
                  </button>
                  <div className="w-16 text-center">
                    <p className="text-3xl font-bold text-slate-800">{gross ?? "–"}</p>
                    <p className="text-[10px] text-slate-400">strokes</p>
                  </div>
                  <button onClick={() => setScore(p.id, currentHole, (gross || holePar - 1) + 1)} className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLast && (
        <button onClick={finishRound} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Save size={18} /> Finish & save to my history
        </button>
      )}
    </div>
  );
}

// ==================== SCORECARD (full grid) ====================
function ScorecardScreen({ meta, players, setScore, setHandicap, leaderboard }) {
  const [selectedId, setSelectedId] = useState(players[0]?.id ?? "");
  const [handicapInput, setHandicapInput] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedPlayer = players.find((p) => p.id === selectedId) ?? players[0];

  useEffect(() => {
    if (selectedPlayer) setHandicapInput(String(selectedPlayer.handicap));
  }, [selectedPlayer?.id, selectedPlayer?.handicap]);

  function update() {
    if (!selectedPlayer) return;
    setHandicap(selectedPlayer.id, handicapInput);
    rememberHandicap(selectedPlayer.name, handicapInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-4">
      <Card title="Player handicaps" subtitle="Select a player, set their Course Handicap, and the scorecard updates immediately.">
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (currently {p.handicap})</option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            className="input w-20 text-center"
            value={handicapInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setHandicapInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update()}
          />
          <button onClick={update} className="btn-primary px-4 whitespace-nowrap">
            {saved ? "Saved ✓" : "Update"}
          </button>
        </div>
        {handicapInput && Number(handicapInput) !== 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Playing HCP for this hcp — 100%: <span className="font-semibold text-slate-600">{playingHandicap(handicapInput, 100)}</span> · 95%: <span className="font-semibold text-slate-600">{playingHandicap(handicapInput, 95)}</span> · this round's allowance ({meta.handicapAllowance ?? 100}%): <span className="font-semibold text-emerald-700">{playingHandicap(handicapInput, meta.handicapAllowance)}</span>
          </p>
        )}
      </Card>

      <Card title="Leaderboard">
        <div className="space-y-2">
          {leaderboard.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>
                {i === 0 ? <Trophy size={16} className="inline" /> : i + 1}
              </span>
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="text-xs text-slate-400">hcp {p.handicap} · {p.holesPlayed}/{meta.holeCount} holes</span>
              <span className="text-lg font-bold text-emerald-700">{p.total} pts</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Full scorecard" subtitle="Everyone's live gross strokes — points calculated automatically">
        <div className="overflow-x-auto -mx-1">
          <table className="text-sm min-w-[600px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left px-1 py-1">Hole</th>
                {meta.par.map((_, i) => <th key={i} className="px-1 py-1 w-7 text-center">{i + 1}</th>)}
                <th className="px-2 text-center">Tot</th>
              </tr>
              <tr className="text-slate-400 text-xs">
                <td className="px-1">Par</td>
                {meta.par.map((v, i) => <td key={i} className="text-center">{v}</td>)}
                <td className="text-center">{meta.par.reduce((a, b) => a + b, 0)}</td>
              </tr>
              <tr className="text-slate-400 text-xs">
                <td className="px-1">S.I.</td>
                {meta.si.map((v, i) => <td key={i} className="text-center">{v}</td>)}
                <td />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                let total = 0;
                return (
                  <React.Fragment key={p.id}>
                    <tr className="border-t border-emerald-50">
                      <td className="px-1 py-1 font-medium text-slate-700">{p.name}</td>
                      {meta.par.map((par, i) => {
                        const g = p.scores?.[i];
                        return (
                          <td key={i} className="text-center p-0.5">
                            <input
                              type="number"
                              value={g ?? ""}
                              onChange={(e) => setScore(p.id, i, e.target.value === "" ? "" : parseInt(e.target.value))}
                              className="w-7 text-center text-xs border border-slate-200 rounded py-1"
                            />
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                    <tr className="text-emerald-700 text-xs">
                      <td className="px-1 pb-2">pts</td>
                      {meta.par.map((par, i) => {
                        const g = p.scores?.[i];
                        const ph = playingHandicap(p.handicap, meta.handicapAllowance);
                        const sr = strokesOnHole(ph, meta.si[i], meta.holeCount);
                        const pts = stablefordPoints(g, par, sr);
                        if (pts != null) total += pts;
                        return <td key={i} className="text-center pb-2 font-semibold">{pts ?? "–"}</td>;
                      })}
                      <td className="text-center pb-2 font-bold">{total}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== HISTORY (local to this device) ====================
function HistoryScreen({ embedded = false }) {
  const [history] = useState(() => loadLocal("stableford-history", []));
  if (history.length === 0) {
    if (embedded) return null;
    return (
      <Card title="Round history">
        <p className="text-sm text-slate-400 py-6 text-center">No finished rounds on this device yet.</p>
      </Card>
    );
  }
  return (
    <div className={embedded ? "space-y-3 mt-2" : "space-y-3"}>
      {embedded && <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Recent rounds on this device</p>}
      {history.map((h) => {
        const sorted = [...h.players].sort((a, b) => b.total - a.total);
        return (
          <Card key={h.id}>
            <p className="font-semibold text-slate-800">{h.courseName}</p>
            <p className="text-xs text-slate-400">{h.date} · {h.holeCount} holes{h.teeTime ? ` · ${h.teeTime} tee` : ""}</p>
            <div className="mt-3 space-y-1">
              {sorted.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 text-center ${i === 0 ? "text-amber-500 font-bold" : "text-slate-400"}`}>
                    {i === 0 ? <Trophy size={14} className="inline" /> : i + 1}
                  </span>
                  <span className="flex-1">{p.name} <span className="text-xs text-slate-400">(hcp {p.handicap})</span></span>
                  <span className="font-bold text-emerald-700">{p.total} pts</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ==================== Shared UI bits ====================
function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4">
      {title && <h2 className="font-semibold text-slate-800 mb-0.5">{title}</h2>}
      {subtitle && <p className="text-xs text-slate-400 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
