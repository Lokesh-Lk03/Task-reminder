export const TASKS_KEY = "taskly.tasks.v1";
export const SETTINGS_KEY = "taskly.settings.v1";
export const REMINDERS_KEY = "taskly.reminded.v1";

export const REMINDER_OPTIONS = [
  { value: "at-time", label: "At the due time", minutes: 0 },
  { value: "5m", label: "5 minutes before", minutes: 5 },
  { value: "15m", label: "15 minutes before", minutes: 15 },
  { value: "1h", label: "1 hour before", minutes: 60 },
  { value: "1d", label: "1 day before", minutes: 1440 },
];

const priorities = ["Low", "Medium", "High"];
const categories = ["Personal", "Work", "Study", "Other"];
const reminders = REMINDER_OPTIONS.map((option) => option.value);

function readJSON(key, fallback, validate) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function loadTasks() {
  return readJSON(TASKS_KEY, [], (value) => Array.isArray(value))
    .filter((task) => task && typeof task.id === "string" && typeof task.title === "string")
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: typeof task.description === "string" ? task.description : "",
      dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
      dueTime: typeof task.dueTime === "string" ? task.dueTime : "",
      priority: priorities.includes(task.priority) ? task.priority : "Medium",
      category: categories.includes(task.category) ? task.category : "Personal",
      reminder: reminders.includes(task.reminder) ? task.reminder : "at-time",
      completed: task.completed === true,
      createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    }));
}

export function loadSettings() {
  const value = readJSON(SETTINGS_KEY, {}, (item) => item && typeof item === "object");
  return {
    notifications: value.notifications === true,
    defaultPriority: priorities.includes(value.defaultPriority) ? value.defaultPriority : "Medium",
  };
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function taskDueAt(task) {
  if (!task.dueDate) return null;
  const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
  return Number.isNaN(due.getTime()) ? null : due;
}

export function taskReminderAt(task) {
  const due = taskDueAt(task);
  if (!due) return null;
  const minutes = REMINDER_OPTIONS.find((option) => option.value === task.reminder)?.minutes ?? 0;
  return new Date(due.getTime() - minutes * 60_000);
}

export function formatDue(task, options = { dateStyle: "medium", timeStyle: "short" }) {
  const due = taskDueAt(task);
  if (!due) return "No due date";
  if (!task.dueTime) {
    return due.toLocaleDateString(undefined, { dateStyle: options.dateStyle ?? "medium" });
  }
  return due.toLocaleString(undefined, options);
}

export function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getTaskFilter(task, filter, now = new Date()) {
  const due = taskDueAt(task);
  const today = dateKey(now);
  if (filter === "completed") return task.completed;
  if (filter === "overdue") return !task.completed && due && due < now;
  if (filter === "today") return !task.completed && task.dueDate === today;
  if (filter === "upcoming") return !task.completed && due && task.dueDate > today;
  return !task.completed;
}

export function sortTasks(tasks, sort) {
  return [...tasks].sort((a, b) => {
    if (sort === "priority") {
      const rank = { High: 0, Medium: 1, Low: 2 };
      return rank[a.priority] - rank[b.priority] || compareDue(a, b);
    }
    return compareDue(a, b);
  });
}

function compareDue(a, b) {
  const first = taskDueAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const second = taskDueAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return first - second || new Date(a.createdAt) - new Date(b.createdAt);
}
