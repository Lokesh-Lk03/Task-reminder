import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  ArrowDownUp,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileJson,
  FileText,
  Kanban,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  ListTodo,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  dateKey,
  formatDue,
  getTaskFilter,
  loadSettings,
  loadTasks,
  REMINDER_OPTIONS,
  REMINDERS_KEY,
  saveJSON,
  SETTINGS_KEY,
  sortTasks,
  taskDueAt,
  taskReminderAt,
  TASKS_KEY,
} from "./utils/tasks";
import { getSettings, getTasks, saveSettings, saveTasks } from "./api/client";
import { triggerConfetti } from "./utils/confetti";

// ─── Supabase Auth (browser-side) ────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://fwbhnvjfisoedhvcjevd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3YmhudmpmaXNvZWRodmNqZXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTk5MDUsImV4cCI6MjEwODYzNTkwNX0.folZ8AjR51-wldA7qGHhwl-cKT0ULs6FHhKMBGKeofE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Demo Tasks ───────────────────────────────────────────────────────────────
function makeDemoTasks() {
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86400000));
  const nextWeek = dateKey(new Date(Date.now() + 7 * 86400000));
  return [
    {
      id: crypto.randomUUID(), title: "Review Q4 project roadmap", description: "Go through the roadmap doc and add comments for the team.",
      dueDate: today, dueTime: "14:00", priority: "High", category: "Work", reminder: "1h", completed: false, createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(), title: "Morning workout", description: "30-minute run, then stretching.",
      dueDate: today, dueTime: "07:00", priority: "Medium", category: "Personal", reminder: "at-time", completed: false, createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(), title: "Read chapter 5 of Clean Code", description: "Take notes on the key principles discussed.",
      dueDate: tomorrow, dueTime: "", priority: "Medium", category: "Study", reminder: "1d", completed: false, createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(), title: "Pay utility bills", description: "Electricity, internet, and water.",
      dueDate: nextWeek, dueTime: "", priority: "High", category: "Personal", reminder: "1d", completed: false, createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(), title: "Prepare weekly standup notes", description: "List blockers and progress updates for Monday's standup.",
      dueDate: nextWeek, dueTime: "09:00", priority: "Low", category: "Work", reminder: "15m", completed: false, createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(), title: "Fix login page bug (already done!)", description: "Resolved the OAuth redirect issue — just marking for reference.",
      dueDate: today, dueTime: "", priority: "High", category: "Work", reminder: "at-time", completed: true, createdAt: new Date().toISOString(),
    },
  ];
}

const MIGRATION_KEY = "taskly.api-migrated.v1";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "all", label: "All tasks", icon: ListTodo },
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "upcoming", label: "Upcoming", icon: Clock3 },
  { id: "completed", label: "Completed", icon: CheckCheck },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  dueDate: "",
  dueTime: "",
  priority: "Medium",
  category: "Personal",
  reminder: "at-time",
};

// ─── Keyboard Shortcut Badge ──────────────────────────────────────────────────
function KbdBadge({ children }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "1px 6px", borderRadius: 5, background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.18)", fontSize: 11, fontFamily: "monospace",
      color: "#94a3b8", letterSpacing: ".03em",
    }}>{children}</kbd>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    try {
      if (mode === "login") {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        onLogin(data.user);
      } else {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        setMsg("Account created! Check your email for a confirmation link, then sign in.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <span className="brand-mark"><Check size={20} strokeWidth={3} /></span>
          <span>taskly</span>
        </div>
        <div className="login-eyebrow">{mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}</div>
        <h1 className="login-title">{mode === "login" ? "Sign in to your workspace" : "Join Taskly"}</h1>
        <p className="login-sub">
          {mode === "login"
            ? "Access your tasks, reminders and cloud sync."
            : "Create an account to start managing your tasks."}
        </p>

        {error && <div className="login-error"><span>!</span> {error}</div>}
        {msg && <div className="login-success"><span>✓</span> {msg}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Email address
            <input
              type="email" autoComplete="email" autoFocus required
              placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required
              placeholder={mode === "login" ? "Your password" : "At least 6 characters"}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary-button login-btn" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="login-switch">
          {mode === "login" ? (
            <span>New to Taskly? <button onClick={() => { setMode("signup"); setError(""); setMsg(""); }}>Create an account</button></span>
          ) : (
            <span>Already have an account? <button onClick={() => { setMode("login"); setError(""); setMsg(""); }}>Sign in</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Task / app state
  const [tasks, setTasks] = useState(loadTasks);
  const [settings, setSettings] = useState(loadSettings);
  const [page, setPage] = useState("dashboard");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("due");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [apiStatus, setApiStatus] = useState("connecting");
  const [apiError, setApiError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [viewMode, setViewMode] = useState("list"); // "list" | "board"

  const remindedRef = useRef(new Set(readReminded()));
  const offlineChangesRef = useRef(false);
  const searchRef = useRef(null);

  // ── Auth: check session on mount ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Persist tasks ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saveJSON(TASKS_KEY, tasks)) setStorageWarning(true);
    if (apiStatus === "offline") offlineChangesRef.current = true;
    if (apiStatus === "connected") {
      saveTasks(tasks).catch((error) => {
        offlineChangesRef.current = true;
        setApiError(error.message);
        setApiStatus("offline");
      });
    }
  }, [tasks, apiStatus]);

  useEffect(() => {
    if (!saveJSON(SETTINGS_KEY, settings)) setStorageWarning(true);
    if (apiStatus === "offline") offlineChangesRef.current = true;
    if (apiStatus === "connected") {
      saveSettings(settings).catch((error) => {
        offlineChangesRef.current = true;
        setApiError(error.message);
        setApiStatus("offline");
      });
    }
  }, [settings, apiStatus]);

  // ── Backend connect ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function connectToBackend() {
      setApiStatus("connecting");
      try {
        const [serverTasks, serverSettings] = await Promise.all([getTasks(), getSettings()]);
        let initialTasks = serverTasks;
        let initialSettings = serverSettings;
        const cachedTasks = loadTasks();
        const cachedSettings = loadSettings();
        let migrated = false;
        try { migrated = localStorage.getItem(MIGRATION_KEY) === "1"; } catch { setStorageWarning(true); }
        if (offlineChangesRef.current) {
          initialTasks = await saveTasks(cachedTasks);
          initialSettings = await saveSettings(cachedSettings);
        } else if (!migrated && serverTasks.length === 0) {
          if (cachedTasks.length > 0) initialTasks = await saveTasks(cachedTasks);
          initialSettings = await saveSettings(cachedSettings);
        } else if (serverTasks.length === 0 && cachedTasks.length > 0) {
          initialTasks = await saveTasks(cachedTasks);
        }
        if (!migrated) { try { localStorage.setItem(MIGRATION_KEY, "1"); } catch { setStorageWarning(true); } }
        if (cancelled) return;
        setTasks(initialTasks);
        setSettings(initialSettings);
        offlineChangesRef.current = false;
        setApiError("");
        setApiStatus("connected");
      } catch (error) {
        if (cancelled) return;
        setApiError(error.message);
        setApiStatus("offline");
      }
    }
    connectToBackend();
    return () => { cancelled = true; };
  }, [retryCount]);

  // ── Timers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ── Reminders ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;
        const reminderAt = taskReminderAt(task);
        const dueAt = taskDueAt(task);
        if (!reminderAt || !dueAt || reminderAt > now || dueAt.getTime() + 60_000 < now.getTime()) continue;
        const reminderId = `${task.id}:${task.reminder}:${task.dueDate}:${task.dueTime}`;
        if (remindedRef.current.has(reminderId)) continue;
        remindedRef.current.add(reminderId);
        saveJSON(REMINDERS_KEY, [...remindedRef.current]);
        const dueFormatted = formatDue(task);
        const reminderText = task.reminder === "1d"
          ? `Reminder: "${task.title}" is due tomorrow (${dueFormatted})`
          : `Reminder: "${task.title}" (Due: ${dueFormatted})`;
        setToast({ type: "reminder", message: reminderText });
        if (settings.notifications && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Taskly reminder", { body: reminderText, tag: reminderId, icon: "/favicon.svg" });
          } catch {
            setToast({ type: "error", message: "The browser couldn't display a notification. The in-app reminder is still shown." });
          }
        }
      }
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 15_000);
    return () => window.clearInterval(timer);
  }, [tasks, settings.notifications]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      // Escape — close modals / menus
      if (e.key === "Escape") {
        if (modal) { setModal(null); return; }
        if (menuId) { setMenuId(null); return; }
        if (mobileMenu) { setMobileMenu(false); return; }
      }
      // Cmd/Ctrl + K — focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      // Skip if user is typing in an input
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // N — new task
      if (e.key === "n" || e.key === "N") { e.preventDefault(); openCreate(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, menuId, mobileMenu]);

  // ── Derived values ────────────────────────────────────────────────────────
  const today = dateKey(now);
  const counts = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const overdue = pending.filter((t) => { const d = taskDueAt(t); return d && d < now; });
    return {
      total: tasks.length, pending: pending.length,
      completed: tasks.length - pending.length, overdue: overdue.length,
      today: pending.filter((t) => t.dueDate === today).length,
    };
  }, [tasks, today, now]);

  const completionRate = tasks.length ? Math.round((counts.completed / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => {
    let selected;
    if (page === "dashboard") selected = tasks.filter((t) => !t.completed);
    else if (page === "settings") selected = [];
    else if (page === "all") selected = tasks;
    else selected = tasks.filter((t) => getTaskFilter(t, page, now));
    if (page === "all" && filter !== "all") selected = tasks.filter((t) => getTaskFilter(t, filter, now));
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      selected = selected.filter((t) => t.title.toLowerCase().includes(needle));
    }
    return sortTasks(selected, sort);
  }, [tasks, page, filter, query, sort, now]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function notify(message, type = "success") { setToast({ message, type }); }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, priority: settings.defaultPriority });
    setModal("form");
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, dueDate: task.dueDate, dueTime: task.dueTime, priority: task.priority, category: task.category, reminder: task.reminder });
    setModal("form");
    setMenuId(null);
  }

  function saveTask(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { notify("Enter a task title to continue.", "error"); return; }
    if (form.dueTime && !form.dueDate) { notify("Select a due date before entering a due time.", "error"); return; }
    if (form.dueDate && Number.isNaN(new Date(`${form.dueDate}T${form.dueTime || "23:59"}`).getTime())) {
      notify("Enter a valid due date and time.", "error"); return;
    }
    const existing = tasks.find((t) => t.id === editingId);
    const nextTask = { ...form, title, description: form.description.trim(), id: editingId ?? crypto.randomUUID(), completed: existing?.completed ?? false, createdAt: existing?.createdAt ?? new Date().toISOString() };
    offlineChangesRef.current = true;
    setTasks((cur) => editingId ? cur.map((t) => (t.id === editingId ? nextTask : t)) : [nextTask, ...cur]);
    setModal(null);
    notify(editingId ? "Task updated successfully." : "Task created successfully.");
  }

  function toggleComplete(task) {
    // 🎉 Confetti on task completion
    if (!task.completed) triggerConfetti();
    offlineChangesRef.current = true;
    setTasks((cur) => cur.map((item) => (item.id === task.id ? { ...item, completed: !item.completed } : item)));
    notify(task.completed ? "Task reopened." : "Task marked as completed! 🎉");
    setMenuId(null);
  }

  function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"? This action cannot be undone.`)) return;
    offlineChangesRef.current = true;
    setTasks((cur) => cur.filter((item) => item.id !== task.id));
    setModal(null);
    setMenuId(null);
    notify("Task deleted successfully.");
  }

  function updateSetting(key, value) {
    offlineChangesRef.current = true;
    setSettings((cur) => ({ ...cur, [key]: value }));
  }

  async function toggleNotifications(enabled) {
    if (!enabled) { updateSetting("notifications", false); notify("Browser notifications turned off."); return; }
    if (!("Notification" in window)) { notify("Browser notifications are not supported in this browser.", "error"); return; }
    let permission;
    try {
      permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    } catch { updateSetting("notifications", false); notify("Notification permission could not be requested.", "error"); return; }
    if (permission !== "granted") { updateSetting("notifications", false); notify("Notification permission was not granted.", "error"); return; }
    updateSetting("notifications", true);
    notify("Browser notifications enabled.");
  }

  function clearTasks() {
    if (!window.confirm("Delete all tasks? This action cannot be undone.")) return;
    offlineChangesRef.current = true;
    setTasks([]);
    setModal(null);
    notify("All tasks deleted.");
  }

  function loadDemoTasks() {
    if (tasks.length > 0 && !window.confirm("This will add demo tasks alongside your existing tasks. Continue?")) return;
    offlineChangesRef.current = true;
    setTasks((cur) => [...makeDemoTasks(), ...cur]);
    notify("6 demo tasks loaded successfully! 🎉");
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportTasks(format) {
    if (tasks.length === 0) { notify("No tasks to export.", "error"); return; }
    let content, mime, ext;
    if (format === "json") {
      content = JSON.stringify(tasks, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = ["id", "title", "description", "dueDate", "dueTime", "priority", "category", "reminder", "completed", "createdAt"];
      const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = tasks.map((t) => headers.map((h) => escape(t[h])).join(","));
      content = [headers.join(","), ...rows].join("\n");
      mime = "text/csv";
      ext = "csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskly-export-${dateKey(new Date())}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify(`Exported ${tasks.length} tasks as ${ext.toUpperCase()}.`);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    setFilter("all");
    setQuery("");
    setMobileMenu(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    notify("Signed out successfully.");
  }

  const pageTitle = page === "dashboard" ? "Your dashboard"
    : page === "settings" ? "Settings"
      : NAV.find((item) => item.id === page)?.label ?? "All tasks";

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Check size={22} strokeWidth={3} />
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading taskly…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser} />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Check size={19} strokeWidth={3} /></span><span>taskly</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => changePage(id)}>
              <Icon size={18} /><span>{label}</span>
              {id === "today" && counts.today > 0 && <span className="nav-count">{counts.today}</span>}
            </button>
          ))}
        </nav>

        {/* Shortcuts hint */}
        <div className="sidebar-shortcuts">
          <div className="shortcuts-title"><Zap size={13} /> Keyboard shortcuts</div>
          <div className="shortcut-row"><KbdBadge>N</KbdBadge><span>New task</span></div>
          <div className="shortcut-row"><KbdBadge>⌘K</KbdBadge><span>Search</span></div>
          <div className="shortcut-row"><KbdBadge>Esc</KbdBadge><span>Close dialog</span></div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={17} /><p><strong>Personal workspace</strong><br />Plan and track your tasks.</p></div>
          <button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => changePage("settings")}><SettingsIcon size={18} /><span>Settings</span></button>
          <div className="profile-row">
            <div className="avatar">{user.email?.[0]?.toUpperCase() ?? "U"}</div>
            <div><strong style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{user.email}</strong><small>Personal workspace</small></div>
            <button className="signout-btn" aria-label="Sign out" title="Sign out" onClick={handleSignOut}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <div className="today-date"><CalendarDays size={16} />{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
            <button className="icon-button help-button" aria-label="About reminders" onClick={() => setModal("about")}><CircleHelp size={19} /></button>
            <div className={`bell-status ${settings.notifications ? "bell-on" : ""}`} title={settings.notifications ? "Browser notifications are enabled" : "Browser notifications are off"}><Bell size={17} /></div>
          </div>
        </header>

        <div className="content">
          {apiStatus !== "connected" && <div className={`backend-banner ${apiStatus}`} role="status"><span>{apiStatus === "connecting" ? "Connecting to the Taskly server…" : `Taskly server is unavailable${apiError ? `: ${apiError}` : "."} Changes are saved in this browser until the connection is restored.`}</span>{apiStatus === "offline" && <button onClick={() => setRetryCount((c) => c + 1)}>Retry connection</button>}</div>}
          {storageWarning && <div className="storage-warning">Your browser storage may be full or unavailable. Changes may not persist after closing this page.</div>}

          {page === "settings" ? (
            <>
              <PageHero page="settings" counts={counts} onAdd={openCreate} />
              <SettingsPage
                settings={settings}
                onToggleNotifications={toggleNotifications}
                onChangeDefault={(value) => updateSetting("defaultPriority", value)}
                onClear={clearTasks}
                onLoadDemo={loadDemoTasks}
                onExportCSV={() => exportTasks("csv")}
                onExportJSON={() => exportTasks("json")}
              />
            </>
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  <section className="welcome-row">
                    <div className="welcome-copy">
                      <div className="eyebrow"><span className="live-dot" /> YOUR DAILY BRIEFING</div>
                      <div className="hero-date">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
                      <h1>Plan with clarity.<br />Execute with focus.</h1>
                      <p>Review priorities, manage deadlines, and track progress.</p>
                      <button className="primary-button" onClick={openCreate}><Plus size={18} /> Add a task</button>
                    </div>
                    <div className="progress-card" aria-label={`${completionRate}% of tasks completed`}>
                      <div className="progress-copy"><span>OVERALL COMPLETION</span><strong>{counts.completed}<small> / {counts.total} tasks</small></strong><p>Tasks completed</p></div>
                      <div className="progress-ring" style={{ "--progress": `${completionRate}%` }}><div><strong>{completionRate}<small>%</small></strong></div></div>
                    </div>
                  </section>
                  <section className="stat-grid" aria-label="Task summary">
                    <StatCard label="Total tasks" number={counts.total} icon={ListTodo} color="blue" foot="All tasks in your workspace" />
                    <StatCard label="Due today" number={counts.today} icon={CalendarDays} color="violet" foot={counts.today ? "Scheduled for today" : "No tasks due today"} />
                    <StatCard label="Pending" number={counts.pending} icon={Clock3} color="orange" foot="Awaiting completion" />
                    <StatCard label="Completed" number={counts.completed} icon={CheckCheck} color="green" foot="Marked as complete" />
                    <StatCard label="Overdue" number={counts.overdue} icon={AlarmClock} color="red" foot={counts.overdue ? "Requires attention" : "No overdue tasks"} />
                  </section>
                  <section className="dashboard-heading">
                    <div><h2>Today's priorities <span className="today-pill">{counts.today} {counts.today === 1 ? "task" : "tasks"}</span></h2><p>Tasks scheduled for completion today.</p></div>
                    <button className="text-button" onClick={() => changePage("today")}>View today's tasks <span>→</span></button>
                  </section>
                </>
              )}
              {page !== "dashboard" && <PageHero page={page} counts={counts} onAdd={openCreate} />}

              {/* View mode toggle (non-dashboard, non-settings pages) */}
              {page !== "dashboard" && (
                <div className="view-toggle-row">
                  <button
                    className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <LayoutList size={16} /> List
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === "board" ? "active" : ""}`}
                    onClick={() => setViewMode("board")}
                    aria-label="Board view"
                  >
                    <Kanban size={16} /> Board
                  </button>
                </div>
              )}

              {viewMode === "board" && page !== "dashboard" ? (
                <KanbanBoard tasks={visibleTasks} now={now} onEdit={openEdit} onDelete={deleteTask} onToggle={toggleComplete} onCreate={openCreate} />
              ) : (
                <TaskList
                  tasks={visibleTasks} page={page} filter={filter} setFilter={setFilter}
                  query={query} setQuery={setQuery} sort={sort} setSort={setSort}
                  onCreate={openCreate} onEdit={openEdit} onDelete={deleteTask}
                  onToggle={toggleComplete} onDetails={(task) => setModal({ type: "details", task })}
                  menuId={menuId} setMenuId={setMenuId} now={now}
                  searchRef={searchRef}
                  onLoadDemo={loadDemoTasks}
                />
              )}
            </>
          )}
          <footer className="footer">Taskly · Personal task management · Logged in as {user.email}</footer>
        </div>
      </main>

      {modal === "form" && <TaskModal form={form} setForm={setForm} editing={Boolean(editingId)} onSubmit={saveTask} onClose={() => setModal(null)} />}
      {modal?.type === "details" && <DetailsModal task={modal.task} onClose={() => setModal(null)} onEdit={openEdit} onToggle={toggleComplete} />}
      {modal === "about" && <AboutModal onClose={() => setModal(null)} />}
      {modal === "shortcuts" && <ShortcutsModal onClose={() => setModal(null)} />}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <span className="toast-icon">{toast.type === "error" ? "!" : toast.type === "reminder" ? <Bell size={16} /> : <Check size={16} />}</span>
          {toast.message}
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readReminded() {
  try {
    const stored = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch { return []; }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, number, icon: Icon, color, foot }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17} /></span></div>
      <div className="stat-number">{number}</div>
      <div className="stat-foot">{foot}</div>
    </article>
  );
}

// ─── Task List (existing) ─────────────────────────────────────────────────────
function TaskList({ tasks, page, filter, setFilter, query, setQuery, sort, setSort, onCreate, onEdit, onDelete, onToggle, onDetails, menuId, setMenuId, now, searchRef, onLoadDemo }) {
  const filters = [
    ["all", "All tasks"], ["today", "Today"], ["upcoming", "Upcoming"], ["completed", "Completed"], ["overdue", "Overdue"],
  ];
  const activeFilter = page === "all" ? filter : page;
  const emptyTitle = query ? "No matching tasks"
    : activeFilter === "completed" ? "No completed tasks"
      : activeFilter === "today" ? "No tasks due today"
        : activeFilter === "upcoming" ? "No upcoming tasks"
          : activeFilter === "overdue" ? "No overdue tasks"
            : page === "dashboard" ? "No pending tasks" : "No tasks created";
  const emptyCopy = query ? "Adjust your search criteria and try again."
    : activeFilter === "completed" ? "Tasks marked as complete will appear here."
      : page === "dashboard" ? "All tasks are complete. Create a task to add new work."
        : "Create a task to organize and track your work.";

  return (
    <section className={`task-panel ${page === "dashboard" ? "dashboard-task-panel" : ""}`}>
      <div className="task-toolbar">
        {page === "all"
          ? <div className="filter-tabs">{filters.map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={filter === id ? "selected" : ""}>{label}</button>)}</div>
          : <h2>{page === "dashboard" ? "Pending tasks" : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}</h2>}
        <div className="toolbar-controls">
          <label className="search-box">
            <Search size={16} />
            <input
              ref={searchRef}
              aria-label="Search tasks by title"
              placeholder="Search… (⌘K)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
          </label>
          <label className="sort-select">
            <ArrowDownUp size={15} />
            <select aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>
      {tasks.length ? (
        <div className="task-list">
          {tasks.map((task) => <TaskRow key={task.id} task={task} now={now} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} onDetails={onDetails} menuId={menuId} setMenuId={setMenuId} />)}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-art"><span className="empty-sun">✳</span><ListTodo size={37} /></div>
          <h3>{emptyTitle}</h3>
          <p>{emptyCopy}</p>
          {!query && page !== "completed" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="primary-button" onClick={onCreate}><Plus size={17} /> Create task</button>
              <button className="secondary-button" onClick={onLoadDemo}><Sparkles size={16} /> Load demo tasks</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, now, onEdit, onDelete, onToggle, onDetails, menuId, setMenuId }) {
  const due = taskDueAt(task);
  const overdue = !task.completed && due && due < now;
  const reminderLabel = REMINDER_OPTIONS.find((o) => o.value === task.reminder)?.label;
  return (
    <article className={`task-row ${task.completed ? "task-complete" : ""}`}>
      <button className={`task-check ${task.completed ? "checked" : ""}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => onToggle(task)}>
        {task.completed && <Check size={14} strokeWidth={3} />}
      </button>
      <button className="task-main" onClick={() => onDetails(task)} aria-label={`View details for ${task.title}`}>
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-description">{task.description}</span>}
        <span className="task-meta">
          <span className={`due-label ${overdue ? "overdue-label" : ""}`}><CalendarDays size={13} />{overdue ? "Overdue · " : ""}{formatDue(task)}</span>
          <span className="meta-dot">·</span>
          <span className={`category-badge category-${task.category.toLowerCase()}`}>{task.category}</span>
          {due && <><span className="meta-dot">·</span><span className="reminder-meta"><Bell size={12} />{reminderLabel}</span></>}
        </span>
      </button>
      <div className="task-end">
        <span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span>
        <div className="task-menu-wrap">
          <button className="icon-button task-menu-trigger" aria-label={`More actions for ${task.title}`} onClick={() => setMenuId(menuId === task.id ? null : task.id)}><MoreHorizontal size={19} /></button>
          {menuId === task.id && (
            <div className="task-menu">
              <button onClick={() => onEdit(task)}><Pencil size={15} /> Edit task</button>
              <button onClick={() => onToggle(task)}><Check size={15} /> {task.completed ? "Reopen task" : "Mark complete"}</button>
              <button className="delete-action" onClick={() => onDelete(task)}><Trash2 size={15} /> Delete task</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
function KanbanBoard({ tasks, now, onEdit, onDelete, onToggle, onCreate }) {
  const pending = tasks.filter((t) => !t.completed && !(taskDueAt(t) && taskDueAt(t) < now));
  const overdue = tasks.filter((t) => !t.completed && taskDueAt(t) && taskDueAt(t) < now);
  const done = tasks.filter((t) => t.completed);

  const columns = [
    { id: "todo", label: "To Do", color: "#4f46e5", tasks: pending, icon: <Clock3 size={15} /> },
    { id: "overdue", label: "Overdue", color: "#ef4444", tasks: overdue, icon: <AlarmClock size={15} /> },
    { id: "done", label: "Completed", color: "#10b981", tasks: done, icon: <CheckCheck size={15} /> },
  ];

  return (
    <div className="kanban-board">
      {columns.map((col) => (
        <div key={col.id} className="kanban-col">
          <div className="kanban-col-header" style={{ borderColor: col.color }}>
            <span style={{ color: col.color }}>{col.icon}</span>
            <span className="kanban-col-title">{col.label}</span>
            <span className="kanban-col-count">{col.tasks.length}</span>
          </div>
          <div className="kanban-col-body">
            {col.tasks.length === 0 && (
              <div className="kanban-empty">
                {col.id === "todo" ? (
                  <button className="kanban-add-btn" onClick={onCreate}><Plus size={15} /> Add task</button>
                ) : (
                  <span>No tasks here</span>
                )}
              </div>
            )}
            {col.tasks.map((task) => (
              <KanbanCard key={task.id} task={task} now={now} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanCard({ task, now, onEdit, onDelete, onToggle }) {
  const due = taskDueAt(task);
  const overdue = !task.completed && due && due < now;
  return (
    <div className="kanban-card">
      <div className="kanban-card-top">
        <span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span>
        <span className={`category-badge category-${task.category.toLowerCase()}`}>{task.category}</span>
      </div>
      <div className="kanban-card-title">{task.title}</div>
      {task.description && <div className="kanban-card-desc">{task.description}</div>}
      {task.dueDate && (
        <div className={`kanban-card-due ${overdue ? "overdue-label" : ""}`}>
          <CalendarDays size={12} /> {formatDue(task)}
        </div>
      )}
      <div className="kanban-card-actions">
        <button className={`task-check ${task.completed ? "checked" : ""}`} style={{ width: 26, height: 26 }} aria-label={task.completed ? "Reopen" : "Complete"} onClick={() => onToggle(task)}>
          {task.completed && <Check size={12} strokeWidth={3} />}
        </button>
        <button className="icon-button" style={{ padding: 4 }} aria-label="Edit" onClick={() => onEdit(task)}><Pencil size={14} /></button>
        <button className="icon-button" style={{ padding: 4, color: "#ef4444" }} aria-label="Delete" onClick={() => onDelete(task)}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ form, setForm, editing, onSubmit, onClose }) {
  const update = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal-header">
          <div><div className="eyebrow">{editing ? "TASK MANAGEMENT" : "NEW TASK"}</div><h2 id="task-modal-title">{editing ? "Edit task" : "Create task"}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <label className="field-label">Task title <span>*</span><input autoFocus maxLength={120} required placeholder="Enter a task title" value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
          <label className="field-label">Description <small>Optional</small><textarea maxLength={500} rows={3} placeholder="Add task details" value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <div className="form-grid">
            <label className="field-label">Due date<input type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} /></label>
            <label className="field-label">Due time <small>Optional</small><input type="time" value={form.dueTime} onChange={(e) => update("dueTime", e.target.value)} /></label>
          </div>
          <div className="form-grid">
            <label className="field-label">Priority<select value={form.priority} onChange={(e) => update("priority", e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="field-label">Category<select value={form.category} onChange={(e) => update("category", e.target.value)}><option>Personal</option><option>Work</option><option>Study</option><option>Other</option></select></label>
          </div>
          <label className="field-label">Reminder<select value={form.reminder} onChange={(e) => update("reminder", e.target.value)}>{REMINDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {!form.dueDate && <div className="form-hint"><Bell size={14} /> A due date is required to schedule a reminder.</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={17} />{editing ? "Save changes" : "Create task"}</button></div>
        </form>
      </section>
    </div>
  );
}

// ─── Details Modal ────────────────────────────────────────────────────────────
function DetailsModal({ task, onClose, onEdit, onToggle }) {
  const overdue = !task.completed && taskDueAt(task) && taskDueAt(task) < new Date();
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-header"><span className="eyebrow">TASK DETAILS</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <h2 id="detail-title">{task.title}</h2>
        {task.description && <p className="detail-description">{task.description}</p>}
        <div className="detail-grid">
          <div><span>Due date</span><strong className={overdue ? "overdue-label" : ""}>{overdue ? "Overdue · " : ""}{formatDue(task)}</strong></div>
          <div><span>Priority</span><strong>{task.priority}</strong></div>
          <div><span>Category</span><strong>{task.category}</strong></div>
          <div><span>Reminder</span><strong>{task.dueDate ? REMINDER_OPTIONS.find((i) => i.value === task.reminder)?.label : "No reminder scheduled"}</strong></div>
          <div><span>Status</span><strong>{task.completed ? "Completed" : "Pending"}</strong></div>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => onToggle(task)}>{task.completed ? "Reopen task" : "Mark complete"}</button><button className="primary-button" onClick={() => onEdit(task)}><Pencil size={16} />Edit task</button></div>
      </section>
    </div>
  );
}

// ─── Shortcuts Modal ──────────────────────────────────────────────────────────
function ShortcutsModal({ onClose }) {
  const shortcuts = [
    { key: "N", desc: "Create a new task" },
    { key: "⌘ K", desc: "Focus search bar" },
    { key: "Esc", desc: "Close any open modal or menu" },
  ];
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal about-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <div className="modal-header">
          <div><div className="eyebrow">PRODUCTIVITY</div><h2 id="shortcuts-title">Keyboard shortcuts</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "8px 0 18px" }}>
          {shortcuts.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span style={{ color: "#475569", fontSize: 14 }}>{s.desc}</span>
              <kbd style={{ padding: "3px 10px", borderRadius: 7, background: "#1e293b", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", border: "1px solid #334155" }}>{s.key}</kbd>
            </div>
          ))}
        </div>
        <div className="modal-actions"><button className="primary-button" onClick={onClose}>Got it</button></div>
      </section>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ settings, onToggleNotifications, onChangeDefault, onClear, onLoadDemo, onExportCSV, onExportJSON }) {
  const unsupported = typeof window !== "undefined" && !("Notification" in window);
  return (
    <section className="settings-page">
      {/* Notifications */}
      <div className="settings-card">
        <div className="setting-row">
          <div className="setting-icon"><Bell size={19} /></div>
          <div className="setting-copy"><strong>Browser notifications</strong><p>Display browser notifications for reminders while Taskly is open.</p></div>
          <button className={`toggle ${settings.notifications ? "toggle-on" : ""}`} role="switch" aria-checked={settings.notifications} aria-label="Enable browser notifications" disabled={unsupported} onClick={() => onToggleNotifications(!settings.notifications)}><span /></button>
        </div>
        {unsupported && <p className="setting-note">Browser notifications are not supported by this browser.</p>}
        <div className="browser-note"><CircleHelp size={15} /><span>Reminders are checked while this page is open. Browser notifications may not be delivered if the site is closed, the browser is suspended, or permission is denied.</span></div>
        <div className="settings-divider" />
        <div className="setting-row">
          <div className="setting-icon priority-setting-icon"><Sparkles size={19} /></div>
          <div className="setting-copy"><strong>Default task priority</strong><p>Set the default priority for newly created tasks.</p></div>
          <select className="default-select" aria-label="Default task priority" value={settings.defaultPriority} onChange={(e) => onChangeDefault(e.target.value)}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </div>
      </div>

      {/* Demo Data */}
      <div className="settings-card">
        <div className="settings-card-header"><Sparkles size={17} /><span>Demo &amp; Sample Data</span></div>
        <div className="setting-row">
          <div className="setting-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}><Sparkles size={19} /></div>
          <div className="setting-copy">
            <strong>Load demo tasks</strong>
            <p>Populate your workspace with 6 realistic sample tasks to explore all features.</p>
          </div>
          <button className="secondary-button" onClick={onLoadDemo}><Sparkles size={15} /> Load demo</button>
        </div>
      </div>

      {/* Export */}
      <div className="settings-card">
        <div className="settings-card-header"><Download size={17} /><span>Export Data</span></div>
        <div className="setting-row">
          <div className="setting-icon" style={{ background: "#ecfdf5", color: "#059669" }}><FileText size={19} /></div>
          <div className="setting-copy">
            <strong>Export as CSV</strong>
            <p>Download all your tasks as a spreadsheet-compatible CSV file.</p>
          </div>
          <button className="secondary-button" onClick={onExportCSV}><FileText size={15} /> Export CSV</button>
        </div>
        <div className="settings-divider" />
        <div className="setting-row">
          <div className="setting-icon" style={{ background: "#eff6ff", color: "#2563eb" }}><FileJson size={19} /></div>
          <div className="setting-copy">
            <strong>Export as JSON</strong>
            <p>Download a full JSON backup of all your tasks including all metadata.</p>
          </div>
          <button className="secondary-button" onClick={onExportJSON}><FileJson size={15} /> Export JSON</button>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="settings-card">
        <div className="settings-card-header"><KeyRound size={17} /><span>Keyboard Shortcuts</span></div>
        <div className="settings-shortcuts-grid">
          {[
            { key: "N", desc: "Create new task" },
            { key: "⌘ K", desc: "Focus search bar" },
            { key: "Esc", desc: "Close modal / menu" },
          ].map((s) => (
            <div key={s.key} className="shortcut-item">
              <span>{s.desc}</span>
              <kbd>{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Danger */}
      <div className="settings-card danger-card">
        <div className="setting-row">
          <div className="setting-icon danger-icon"><Trash2 size={19} /></div>
          <div className="setting-copy"><strong>Delete all tasks</strong><p>Permanently remove all tasks stored in the cloud database.</p></div>
          <button className="danger-button" onClick={onClear}>Delete all</button>
        </div>
      </div>
    </section>
  );
}

// ─── Page Hero ────────────────────────────────────────────────────────────────
function PageHero({ page, counts, onAdd }) {
  const configs = {
    all: {
      badge: "TASK MANAGEMENT", title: "All Tasks",
      description: "Organize, track, and manage all your tasks across your workspace.",
      icon: ListTodo, iconColor: "blue", pill: `${counts.total} ${counts.total === 1 ? "task" : "tasks"}`,
      stats: [{ label: "Pending", value: counts.pending, color: "orange" }, { label: "Completed", value: counts.completed, color: "green" }],
    },
    today: {
      badge: "DAILY AGENDA", title: "Today's Priorities",
      description: "Focus on deliverables and milestones scheduled for today.",
      icon: CalendarDays, iconColor: "violet", pill: `${counts.today} scheduled`,
      stats: [{ label: "Due Today", value: counts.today, color: "violet" }, { label: "Overdue", value: counts.overdue, color: "red" }],
    },
    upcoming: {
      badge: "FUTURE SCHEDULE", title: "Upcoming Tasks",
      description: "Stay ahead of upcoming deadlines and plan future deliverables.",
      icon: Clock3, iconColor: "blue", pill: `${counts.pending} pending`,
      stats: [{ label: "Pending", value: counts.pending, color: "orange" }, { label: "Overdue", value: counts.overdue, color: "red" }],
    },
    completed: {
      badge: "TASK ARCHIVE", title: "Completed Tasks",
      description: "Review your accomplishments and closed tasks. Great progress!",
      icon: CheckCheck, iconColor: "green", pill: `${counts.completed} completed`,
      stats: [{ label: "Finished", value: counts.completed, color: "green" }, { label: "Total Handled", value: counts.total, color: "blue" }],
    },
    settings: {
      badge: "PREFERENCES & CLOUD", title: "Settings",
      description: "Configure notifications, reminder alerts, default priority, and database syncing.",
      icon: SettingsIcon, iconColor: "violet", pill: "Cloud Active",
      stats: [{ label: "Database", value: "Supabase", color: "green" }, { label: "Sync", value: "Online", color: "blue" }],
    },
  };

  const config = configs[page] ?? configs.all;
  const Icon = config.icon;

  return (
    <section className="page-hero">
      <div className="page-hero-main">
        <div className={`page-hero-icon ${config.iconColor}`}><Icon size={24} /></div>
        <div className="page-hero-copy">
          <div className="page-hero-eyebrow"><span className="hero-pill-badge">{config.badge}</span></div>
          <div className="page-hero-title-row"><h1>{config.title}</h1><span className="page-hero-pill">{config.pill}</span></div>
          <p>{config.description}</p>
        </div>
      </div>
      <div className="page-hero-actions">
        <div className="hero-stats-group">
          {config.stats.map((s, i) => (
            <div key={i} className="hero-stat-chip">
              <span className="hero-stat-chip-label">{s.label}</span>
              <span className={`hero-stat-chip-value ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
        {page !== "settings" && (
          <button className="primary-button hero-cta" onClick={onAdd}><Plus size={17} /> Add task</button>
        )}
      </div>
    </section>
  );
}

// ─── About Modal ──────────────────────────────────────────────────────────────
function AboutModal({ onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className="modal-header">
          <div className="brand about-brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span>taskly</span></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </div>
        <h2 id="about-title">About task reminders</h2>
        <p>Taskly checks for scheduled reminders while this page is open. When browser notifications are enabled and permission is granted, reminders can also appear as system notifications.</p>
        <div className="browser-note"><CircleHelp size={15} /><span>Browser limitation: reminders may not run when this website is closed or suspended. Reliable background delivery requires a backend or push-notification service.</span></div>
        <div className="modal-actions"><button className="primary-button" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

export default App;
