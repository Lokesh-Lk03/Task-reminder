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
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  X,
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

function App() {
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
  const remindedRef = useRef(new Set(readReminded()));
  const offlineChangesRef = useRef(false);

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
        try {
          migrated = localStorage.getItem(MIGRATION_KEY) === "1";
        } catch {
          setStorageWarning(true);
        }
        if (offlineChangesRef.current) {
          initialTasks = await saveTasks(cachedTasks);
          initialSettings = await saveSettings(cachedSettings);
        } else if (!migrated && serverTasks.length === 0) {
          if (cachedTasks.length > 0) initialTasks = await saveTasks(cachedTasks);
          initialSettings = await saveSettings(cachedSettings);
        } else if (serverTasks.length === 0 && cachedTasks.length > 0) {
          initialTasks = await saveTasks(cachedTasks);
        }
        if (!migrated) {
          try {
            localStorage.setItem(MIGRATION_KEY, "1");
          } catch {
            setStorageWarning(true);
          }
        }
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
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
        setToast({ type: "reminder", message: `Reminder: ${task.title}` });
        if (settings.notifications && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Taskly reminder", {
              body: task.title,
              tag: reminderId,
              icon: "/favicon.svg",
            });
          } catch {
            setToast({ type: "error", message: "The browser couldn’t display a notification. The in-app reminder is still shown." });
          }
        }
      }
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 15_000);
    return () => window.clearInterval(timer);
  }, [tasks, settings.notifications]);
  const today = dateKey(now);
  const counts = useMemo(() => {
    const pending = tasks.filter((task) => !task.completed);
    const overdue = pending.filter((task) => {
      const due = taskDueAt(task);
      return due && due < now;
    });
    return {
      total: tasks.length,
      pending: pending.length,
      completed: tasks.length - pending.length,
      overdue: overdue.length,
      today: pending.filter((task) => task.dueDate === today).length,
    };
  }, [tasks, today, now]);
  const completionRate = tasks.length ? Math.round((counts.completed / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => {
    let selected;
    if (page === "dashboard") selected = tasks.filter((task) => !task.completed);
    else if (page === "settings") selected = [];
    else if (page === "all") selected = tasks;
    else selected = tasks.filter((task) => getTaskFilter(task, page, now));
    if (page === "all" && filter !== "all") {
      selected = tasks.filter((task) => getTaskFilter(task, filter, now));
    }
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      selected = selected.filter((task) => task.title.toLowerCase().includes(needle));
    }
    return sortTasks(selected, sort);
  }, [tasks, page, filter, query, sort, now]);

  function notify(message, type = "success") {
    setToast({ message, type });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, priority: settings.defaultPriority });
    setModal("form");
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
      category: task.category,
      reminder: task.reminder,
    });
    setModal("form");
    setMenuId(null);
  }

  function saveTask(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      notify("Enter a task title to continue.", "error");
      return;
    }
    if (form.dueTime && !form.dueDate) {
      notify("Select a due date before entering a due time.", "error");
      return;
    }
    if (form.dueDate && Number.isNaN(new Date(`${form.dueDate}T${form.dueTime || "23:59"}`).getTime())) {
      notify("Enter a valid due date and time.", "error");
      return;
    }
    const existing = tasks.find((task) => task.id === editingId);
    const nextTask = {
      ...form,
      title,
      description: form.description.trim(),
      id: editingId ?? crypto.randomUUID(),
      completed: existing?.completed ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    offlineChangesRef.current = true;
    setTasks((current) =>
      editingId ? current.map((task) => (task.id === editingId ? nextTask : task)) : [nextTask, ...current],
    );
    setModal(null);
    notify(editingId ? "Task updated successfully." : "Task created successfully.");
  }

  function toggleComplete(task) {
    offlineChangesRef.current = true;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completed: !item.completed } : item)),
    );
    notify(task.completed ? "Task reopened." : "Task marked as completed.");
    setMenuId(null);
  }

  function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”? This action cannot be undone.`)) return;
    offlineChangesRef.current = true;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setModal(null);
    setMenuId(null);
    notify("Task deleted successfully.");
  }

  function updateSetting(key, value) {
    offlineChangesRef.current = true;
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function toggleNotifications(enabled) {
    if (!enabled) {
      updateSetting("notifications", false);
      notify("Browser notifications turned off.");
      return;
    }
    if (!("Notification" in window)) {
      notify("Browser notifications are not supported in this browser.", "error");
      return;
    }
    let permission;
    try {
      permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    } catch {
      updateSetting("notifications", false);
      notify("Notification permission could not be requested. Review your browser settings.", "error");
      return;
    }
    if (permission !== "granted") {
      updateSetting("notifications", false);
      notify("Notification permission was not granted. Update this setting in your browser preferences.", "error");
      return;
    }
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

  function changePage(nextPage) {
    setPage(nextPage);
    setFilter("all");
    setQuery("");
    setMobileMenu(false);
  }

  const pageTitle = page === "dashboard" ? "Your dashboard"
    : page === "settings" ? "Settings"
      : NAV.find((item) => item.id === page)?.label ?? "All tasks";

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
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={17} /><p><strong>Personal workspace</strong><br />Plan and track your tasks.</p></div>
          <button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => changePage("settings")}><SettingsIcon size={18} /><span>Settings</span></button>
          <div className="profile-row"><div className="avatar">T</div><div><strong>Task workspace</strong><small>Personal workspace</small></div><MoreHorizontal size={19} className="profile-more" /></div>
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
          {apiStatus !== "connected" && <div className={`backend-banner ${apiStatus}`} role="status"><span>{apiStatus === "connecting" ? "Connecting to the Taskly server…" : `Taskly server is unavailable${apiError ? `: ${apiError}` : "."} Changes are saved in this browser until the connection is restored.`}</span>{apiStatus === "offline" && <button onClick={() => setRetryCount((count) => count + 1)}>Retry connection</button>}</div>}
          {storageWarning && <div className="storage-warning">Your browser storage may be full or unavailable. Changes may not persist after closing this page.</div>}
          {page === "settings" ? (
            <SettingsPage settings={settings} onToggleNotifications={toggleNotifications} onChangeDefault={(value) => updateSetting("defaultPriority", value)} onClear={clearTasks} />
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
                  <section className="dashboard-heading"><div><h2>Today’s priorities <span className="today-pill">{counts.today} {counts.today === 1 ? "task" : "tasks"}</span></h2><p>Tasks scheduled for completion today.</p></div><button className="text-button" onClick={() => changePage("today")}>View today’s tasks <span>→</span></button></section>
                </>
              )}
              {page !== "dashboard" && (
                <section className="list-heading"><div><div className="eyebrow">{page === "all" ? "TASK MANAGEMENT" : "WORKSPACE OVERVIEW"}</div><h1>{pageTitle}</h1><p>{page === "today" ? "Review tasks scheduled for today." : page === "upcoming" ? "Review tasks with future due dates." : page === "completed" ? "Review tasks marked as complete." : "View and manage all tasks in your workspace."}</p></div><button className="primary-button" onClick={openCreate}><Plus size={18} /> Add task</button></section>
              )}
              <TaskList
                tasks={visibleTasks}
                page={page}
                filter={filter}
                setFilter={setFilter}
                query={query}
                setQuery={setQuery}
                sort={sort}
                setSort={setSort}
                onCreate={openCreate}
                onEdit={openEdit}
                onDelete={deleteTask}
                onToggle={toggleComplete}
                onDetails={(task) => setModal({ type: "details", task })}
                menuId={menuId}
                setMenuId={setMenuId}
                now={now}
              />
            </>
          )}
          <footer className="footer">Taskly · Personal task management</footer>
        </div>
      </main>

      {modal === "form" && <TaskModal form={form} setForm={setForm} editing={Boolean(editingId)} onSubmit={saveTask} onClose={() => setModal(null)} />}
      {modal?.type === "details" && <DetailsModal task={modal.task} onClose={() => setModal(null)} onEdit={openEdit} onToggle={toggleComplete} />}
      {modal === "about" && <AboutModal onClose={() => setModal(null)} />}
      {toast && <div className={`toast toast-${toast.type}`} role="status"><span className="toast-icon">{toast.type === "error" ? "!" : toast.type === "reminder" ? <Bell size={16} /> : <Check size={16} />}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

function readReminded() {
  try {
    const stored = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function StatCard({ label, number, icon: Icon, color, foot }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17} /></span></div><div className="stat-number">{number}</div><div className="stat-foot">{foot}</div></article>;
}

function TaskList({ tasks, page, filter, setFilter, query, setQuery, sort, setSort, onCreate, onEdit, onDelete, onToggle, onDetails, menuId, setMenuId, now }) {
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
        {page === "all" ? <div className="filter-tabs">{filters.map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={filter === id ? "selected" : ""}>{label}</button>)}</div> : <h2>{page === "dashboard" ? "Pending tasks" : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}</h2>}
        <div className="toolbar-controls">
          <label className="search-box"><Search size={16} /><input aria-label="Search tasks by title" placeholder="Search tasks..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
          <label className="sort-select"><ArrowDownUp size={15} /><select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value)}><option value="due">Due date</option><option value="priority">Priority</option></select><ChevronDown size={14} /></label>
        </div>
      </div>
      {tasks.length ? (
        <div className="task-list">
          {tasks.map((task) => <TaskRow key={task.id} task={task} now={now} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} onDetails={onDetails} menuId={menuId} setMenuId={setMenuId} />)}
        </div>
      ) : (
        <div className="empty-state"><div className="empty-art"><span className="empty-sun">✳</span><ListTodo size={37} /></div><h3>{emptyTitle}</h3><p>{emptyCopy}</p>{!query && page !== "completed" && <button className="primary-button" onClick={onCreate}><Plus size={17} /> Create task</button>}</div>
      )}
    </section>
  );
}

function TaskRow({ task, now, onEdit, onDelete, onToggle, onDetails, menuId, setMenuId }) {
  const due = taskDueAt(task);
  const overdue = !task.completed && due && due < now;
  const reminderLabel = REMINDER_OPTIONS.find((option) => option.value === task.reminder)?.label;
  return (
    <article className={`task-row ${task.completed ? "task-complete" : ""}`}>
      <button className={`task-check ${task.completed ? "checked" : ""}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => onToggle(task)}>{task.completed && <Check size={14} strokeWidth={3} />}</button>
      <button className="task-main" onClick={() => onDetails(task)} aria-label={`View details for ${task.title}`}>
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-description">{task.description}</span>}
        <span className="task-meta"><span className={`due-label ${overdue ? "overdue-label" : ""}`}><CalendarDays size={13} />{overdue ? "Overdue · " : ""}{formatDue(task)}</span><span className="meta-dot">·</span><span>{task.category}</span>{due && <><span className="meta-dot">·</span><span className="reminder-meta"><Bell size={12} />{reminderLabel}</span></>}</span>
      </button>
      <div className="task-end"><span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span><div className="task-menu-wrap"><button className="icon-button task-menu-trigger" aria-label={`More actions for ${task.title}`} onClick={() => setMenuId(menuId === task.id ? null : task.id)}><MoreHorizontal size={19} /></button>{menuId === task.id && <div className="task-menu"><button onClick={() => onEdit(task)}><Pencil size={15} /> Edit task</button><button onClick={() => onToggle(task)}><Check size={15} /> {task.completed ? "Reopen task" : "Mark complete"}</button><button className="delete-action" onClick={() => onDelete(task)}><Trash2 size={15} /> Delete task</button></div>}</div></div>
    </article>
  );
}

function TaskModal({ form, setForm, editing, onSubmit, onClose }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal-header"><div><div className="eyebrow">{editing ? "TASK MANAGEMENT" : "NEW TASK"}</div><h2 id="task-modal-title">{editing ? "Edit task" : "Create task"}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <form onSubmit={onSubmit}>
          <label className="field-label">Task title <span>*</span><input autoFocus maxLength={120} required placeholder="Enter a task title" value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
          <label className="field-label">Description <small>Optional</small><textarea maxLength={500} rows={3} placeholder="Add task details" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          <div className="form-grid">
            <label className="field-label">Due date<input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></label>
            <label className="field-label">Due time <small>Optional</small><input type="time" value={form.dueTime} onChange={(event) => update("dueTime", event.target.value)} /></label>
          </div>
          <div className="form-grid">
            <label className="field-label">Priority<select value={form.priority} onChange={(event) => update("priority", event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="field-label">Category<select value={form.category} onChange={(event) => update("category", event.target.value)}><option>Personal</option><option>Work</option><option>Study</option><option>Other</option></select></label>
          </div>
          <label className="field-label">Reminder<select value={form.reminder} onChange={(event) => update("reminder", event.target.value)}>{REMINDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {!form.dueDate && <div className="form-hint"><Bell size={14} /> A due date is required to schedule a reminder.</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={17} />{editing ? "Save changes" : "Create task"}</button></div>
        </form>
      </section>
    </div>
  );
}

function DetailsModal({ task, onClose, onEdit, onToggle }) {
  const overdue = !task.completed && taskDueAt(task) && taskDueAt(task) < new Date();
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="modal-header"><span className="eyebrow">TASK DETAILS</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><h2 id="detail-title">{task.title}</h2>{task.description && <p className="detail-description">{task.description}</p>}<div className="detail-grid"><div><span>Due date</span><strong className={overdue ? "overdue-label" : ""}>{overdue ? "Overdue · " : ""}{formatDue(task)}</strong></div><div><span>Priority</span><strong>{task.priority}</strong></div><div><span>Category</span><strong>{task.category}</strong></div><div><span>Reminder</span><strong>{task.dueDate ? REMINDER_OPTIONS.find((item) => item.value === task.reminder)?.label : "No reminder scheduled"}</strong></div><div><span>Status</span><strong>{task.completed ? "Completed" : "Pending"}</strong></div></div><div className="modal-actions"><button className="secondary-button" onClick={() => onToggle(task)}>{task.completed ? "Reopen task" : "Mark complete"}</button><button className="primary-button" onClick={() => onEdit(task)}><Pencil size={16} />Edit task</button></div></section></div>;
}

function SettingsPage({ settings, onToggleNotifications, onChangeDefault, onClear }) {
  const unsupported = typeof window !== "undefined" && !("Notification" in window);
  return <section className="settings-page"><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p className="settings-intro">Configure notifications, task defaults, and local data.</p><div className="settings-card"><div className="setting-row"><div className="setting-icon"><Bell size={19} /></div><div className="setting-copy"><strong>Browser notifications</strong><p>Display browser notifications for reminders while Taskly is open.</p></div><button className={`toggle ${settings.notifications ? "toggle-on" : ""}`} role="switch" aria-checked={settings.notifications} aria-label="Enable browser notifications" disabled={unsupported} onClick={() => onToggleNotifications(!settings.notifications)}><span /></button></div>{unsupported && <p className="setting-note">Browser notifications are not supported by this browser.</p>}<div className="browser-note"><CircleHelp size={15} /><span>Reminders are checked while this page is open. Browser notifications may not be delivered if the site is closed, the browser is suspended, or permission is denied. Reliable background reminders require a push-notification service.</span></div><div className="settings-divider" /><div className="setting-row"><div className="setting-icon priority-setting-icon"><Sparkles size={19} /></div><div className="setting-copy"><strong>Default task priority</strong><p>Set the default priority for newly created tasks.</p></div><select className="default-select" aria-label="Default task priority" value={settings.defaultPriority} onChange={(event) => onChangeDefault(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></div></div><div className="settings-card danger-card"><div className="setting-row"><div className="setting-icon danger-icon"><Trash2 size={19} /></div><div className="setting-copy"><strong>Delete all tasks</strong><p>Permanently remove all tasks stored by the backend.</p></div><button className="danger-button" onClick={onClear}>Delete all</button></div></div><p className="storage-note">Tasks and preferences are stored in the backend’s local JSON file, with a browser-local cache. No account or external database is configured.</p></section>;
}

function AboutModal({ onClose }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><div className="modal-header"><div className="brand about-brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span>taskly</span></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><h2 id="about-title">About task reminders</h2><p>Taskly checks for scheduled reminders while this page is open. When browser notifications are enabled and permission is granted, reminders can also appear as system notifications.</p><div className="browser-note"><CircleHelp size={15} /><span>Browser limitation: reminders may not run when this website is closed or suspended. Reliable background delivery requires a backend or push-notification service.</span></div><div className="modal-actions"><button className="primary-button" onClick={onClose}>Close</button></div></section></div>;
}

export default App;
