import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataFile = join(dirname(fileURLToPath(import.meta.url)), "data", "taskly.json");
const dataFile = process.env.DATA_FILE || (process.env.DATA_DIR ? join(process.env.DATA_DIR, "taskly.json") : defaultDataFile);

const defaultData = {
  tasks: [],
  settings: { notifications: false, defaultPriority: "Medium" },
};

let writeQueue = Promise.resolve();

// Supabase configuration
const supabaseUrl = (process.env.SUPABASE_URL || "https://fwbhnvjfisoedhvcjevd.supabase.co").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3YmhudmpmaXNvZWRodmNqZXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTk5MDUsImV4cCI6MjEwODYzNTkwNX0.folZ8AjR51-wldA7qGHhwl-cKT0ULs6FHhKMBGKeofE";
let isSupabaseActive = Boolean(supabaseUrl && supabaseKey);
let supabaseClient = null;

function getSupabaseHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function toDbTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    due_date: task.dueDate ?? "",
    due_time: task.dueTime ?? "",
    priority: task.priority ?? "Medium",
    category: task.category ?? "Personal",
    reminder: task.reminder ?? "at-time",
    completed: Boolean(task.completed),
    created_at: task.createdAt ?? new Date().toISOString(),
  };
}

function fromDbTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    dueDate: row.due_date ?? row.dueDate ?? "",
    dueTime: row.due_time ?? row.dueTime ?? "",
    priority: row.priority ?? "Medium",
    category: row.category ?? "Personal",
    reminder: row.reminder ?? "at-time",
    completed: Boolean(row.completed),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function toDbSettings(settings) {
  return {
    id: 1,
    notifications: Boolean(settings.notifications),
    default_priority: settings.defaultPriority ?? "Medium",
  };
}

function fromDbSettings(row) {
  if (!row) return defaultData.settings;
  return {
    notifications: Boolean(row.notifications),
    defaultPriority: row.default_priority ?? row.defaultPriority ?? "Medium",
  };
}

export async function initializeStore() {
  await mkdir(dirname(dataFile), { recursive: true });

  // Initialize local JSON backup file
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dataFile, `${JSON.stringify(defaultData, null, 2)}\n`, { flag: "wx" })
      .catch((writeError) => {
        if (writeError.code !== "EEXIST") throw writeError;
      });
  }

  // Try to initialize Supabase if credentials are provided
  if (isSupabaseActive) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      console.log("Supabase client initialized with @supabase/supabase-js.");
    } catch {
      console.log("Using native fetch for Supabase REST API.");
    }

    // Verify Supabase connectivity
    try {
      await readFromSupabase();
      console.log("Taskly successfully connected to Supabase database.");
    } catch (err) {
      console.warn("Could not connect to Supabase (check credentials and tables). Falling back to local file store:", err.message);
      isSupabaseActive = false;
    }
  } else {
    console.log("Supabase credentials not detected. Using local file persistence.");
  }
}

async function readFromSupabase() {
  if (supabaseClient) {
    const [{ data: tasksData, error: tasksErr }, { data: settingsData, error: settingsErr }] = await Promise.all([
      supabaseClient.from("tasks").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (tasksErr) throw tasksErr;
    if (settingsErr) throw settingsErr;

    return {
      tasks: (tasksData || []).map(fromDbTask),
      settings: fromDbSettings(settingsData),
    };
  }

  // Native fetch fallback via PostgREST
  const [tasksRes, settingsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/tasks?select=*&order=created_at.asc`, {
      headers: getSupabaseHeaders(),
    }),
    fetch(`${supabaseUrl}/rest/v1/settings?id=eq.1&select=*`, {
      headers: getSupabaseHeaders(),
    }),
  ]);

  if (!tasksRes.ok) {
    const errText = await tasksRes.text();
    throw new Error(`Failed to fetch tasks from Supabase: ${errText}`);
  }
  if (!settingsRes.ok) {
    const errText = await settingsRes.text();
    throw new Error(`Failed to fetch settings from Supabase: ${errText}`);
  }

  const tasksData = await tasksRes.json();
  const settingsRows = await settingsRes.json();

  return {
    tasks: (tasksData || []).map(fromDbTask),
    settings: fromDbSettings(settingsRows?.[0]),
  };
}

async function writeToSupabase(next) {
  if (supabaseClient) {
    if (Array.isArray(next.tasks)) {
      if (next.tasks.length > 0) {
        const rows = next.tasks.map(toDbTask);
        const { error: upsertErr } = await supabaseClient.from("tasks").upsert(rows);
        if (upsertErr) throw upsertErr;

        const ids = next.tasks.map((t) => `"${t.id}"`);
        const { error: delErr } = await supabaseClient.from("tasks").delete().not("id", "in", `(${ids.join(",")})`);
        if (delErr) console.warn("Supabase cleanup error:", delErr.message);
      } else {
        const { error: clearErr } = await supabaseClient.from("tasks").delete().neq("id", "___none___");
        if (clearErr) console.warn("Supabase clear error:", clearErr.message);
      }
    }

    if (next.settings) {
      const { error: setErr } = await supabaseClient.from("settings").upsert(toDbSettings(next.settings));
      if (setErr) throw setErr;
    }
    return;
  }

  // Native fetch fallback
  if (Array.isArray(next.tasks)) {
    if (next.tasks.length > 0) {
      const rows = next.tasks.map(toDbTask);
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
        method: "POST",
        headers: {
          ...getSupabaseHeaders(),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows),
      });
      if (!upsertRes.ok) throw new Error(await upsertRes.text());

      const inList = next.tasks.map((t) => `"${t.id}"`).join(",");
      await fetch(`${supabaseUrl}/rest/v1/tasks?id=not.in.(${inList})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/tasks?id=neq.___none___`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      });
    }
  }

  if (next.settings) {
    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/settings`, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(toDbSettings(next.settings)),
    });
    if (!settingsRes.ok) throw new Error(await settingsRes.text());
  }
}

export async function readStore() {
  await writeQueue;
  if (isSupabaseActive) {
    try {
      return await readFromSupabase();
    } catch (err) {
      console.warn("Error reading from Supabase, falling back to local file:", err.message);
    }
  }
  return readStoreFile();
}

async function readStoreFile() {
  const content = await readFile(dataFile, "utf8");
  const data = JSON.parse(content);
  if (!data || !Array.isArray(data.tasks) || !isSettings(data.settings)) {
    throw new Error("Taskly data file has an invalid structure.");
  }
  return data;
}

export function updateStore(update) {
  const operation = writeQueue.then(async () => {
    const current = isSupabaseActive
      ? await readFromSupabase().catch(() => readStoreFile())
      : await readStoreFile();

    const next = update(current);

    // Save to Supabase if active
    if (isSupabaseActive) {
      try {
        await writeToSupabase(next);
      } catch (err) {
        console.error("Failed to write to Supabase:", err.message);
      }
    }

    // Always maintain local file backup
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(temporaryFile, dataFile);

    return next;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export function isSettings(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.notifications === "boolean" &&
    ["Low", "Medium", "High"].includes(value.defaultPriority),
  );
}
