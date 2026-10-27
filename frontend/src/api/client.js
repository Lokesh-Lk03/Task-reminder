const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
let tasksWrite = Promise.resolve();

async function request(path, options) {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Taskly API returned HTTP ${response.status}.`);
  }
  return payload;
}

export function getTasks() {
  return request("/api/tasks");
}

export function saveTasks(tasks) {
  tasksWrite = tasksWrite.catch(() => {}).then(() =>
    request("/api/tasks", { method: "PUT", body: JSON.stringify(tasks) }),
  );
  return tasksWrite;
}

export function getSettings() {
  return request("/api/settings");
}

export function saveSettings(settings) {
  return request("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
}
