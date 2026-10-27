import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isSettings, initializeStore, readStore, updateStore } from "./store.mjs";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "dist");
const maxBodySize = 1_000_000;
const priorities = new Set(["Low", "Medium", "High"]);
const categories = new Set(["Personal", "Work", "Study", "Other"]);
const reminders = new Set(["at-time", "5m", "15m", "1h", "1d"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function send(response, status, data) {
  setCorsHeaders(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodySize) throw new HttpError(413, "Request body exceeds the 1 MB limit.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must contain valid JSON.");
  }
}

function validateTasks(value) {
  if (!Array.isArray(value)) throw new HttpError(400, "Tasks must be provided as an array.");
  return value.map((task, index) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      throw new HttpError(400, `Task ${index + 1} must be an object.`);
    }
    if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 120) {
      throw new HttpError(400, `Task ${index + 1} must have a title between 1 and 120 characters.`);
    }
    if (typeof task.description !== "string" || task.description.length > 500) {
      throw new HttpError(400, `Task ${index + 1} has an invalid description.`);
    }
    if (typeof task.dueDate !== "string" || (task.dueDate && !isDate(task.dueDate))) {
      throw new HttpError(400, `Task ${index + 1} has an invalid due date.`);
    }
    if (typeof task.dueTime !== "string" || (task.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime))) {
      throw new HttpError(400, `Task ${index + 1} has an invalid due time.`);
    }
    if (task.dueTime && !task.dueDate) throw new HttpError(400, `Task ${index + 1} cannot have a due time without a due date.`);
    if (!priorities.has(task.priority)) throw new HttpError(400, `Task ${index + 1} has an invalid priority.`);
    if (!categories.has(task.category)) throw new HttpError(400, `Task ${index + 1} has an invalid category.`);
    if (!reminders.has(task.reminder)) throw new HttpError(400, `Task ${index + 1} has an invalid reminder setting.`);
    if (typeof task.completed !== "boolean") throw new HttpError(400, `Task ${index + 1} has an invalid completion status.`);
    if (typeof task.createdAt !== "string" || Number.isNaN(Date.parse(task.createdAt))) {
      throw new HttpError(400, `Task ${index + 1} has an invalid creation date.`);
    }
    return {
      id: typeof task.id === "string" && task.id ? task.id : randomUUID(),
      title: task.title.trim(),
      description: task.description,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
      category: task.category,
      reminder: task.reminder,
      completed: task.completed,
      createdAt: task.createdAt,
    };
  });
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("allow", "GET, HEAD");
    throw new HttpError(405, "Method not allowed.");
  }

  // Prevent directory traversal
  const safePath = resolve(distDir, `.${pathname}`);
  if (!safePath.startsWith(distDir)) {
    throw new HttpError(403, "Forbidden.");
  }

  let filePath = safePath;
  let fileStat = null;
  try {
    fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
  } catch {
    // SPA fallback: routes without a file extension resolve to index.html
    if (!extname(pathname)) {
      filePath = join(distDir, "index.html");
      try {
        fileStat = await stat(filePath);
      } catch {
        fileStat = null;
      }
    }
  }

  if (!fileStat || !fileStat.isFile()) {
    throw new HttpError(404, "Frontend file not found. Ensure you have run 'npm run build'.");
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] ?? "application/octet-stream";
  const isHashedAsset = pathname.startsWith("/assets/");

  response.writeHead(200, {
    "content-type": contentType,
    "content-length": fileStat.size,
    "cache-control": isHashedAsset
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const content = await readFile(filePath);
  response.end(content);
}

async function handleRequest(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

  if (!url.pathname.startsWith("/api")) {
    return serveStatic(request, response, url.pathname);
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    return send(response, 200, { status: "ok" });
  }
  if (url.pathname === "/api/tasks") {
    if (request.method === "GET") {
      const data = await readStore();
      return send(response, 200, data.tasks);
    }
    if (request.method === "PUT") {
      const tasks = validateTasks(await readBody(request));
      const data = await updateStore((current) => ({ ...current, tasks }));
      return send(response, 200, data.tasks);
    }
    response.setHeader("allow", "GET, PUT");
    throw new HttpError(405, "Method not allowed.");
  }
  if (url.pathname === "/api/settings") {
    if (request.method === "GET") {
      const data = await readStore();
      return send(response, 200, data.settings);
    }
    if (request.method === "PUT") {
      const settings = await readBody(request);
      if (!isSettings(settings)) throw new HttpError(400, "Settings must include a notification preference and a valid default priority.");
      const data = await updateStore((current) => ({ ...current, settings }));
      return send(response, 200, data.settings);
    }
    response.setHeader("allow", "GET, PUT");
    throw new HttpError(405, "Method not allowed.");
  }
  throw new HttpError(404, "API endpoint not found.");
}

await initializeStore();
const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    if (error instanceof HttpError) {
      send(response, error.status, { error: error.message });
      return;
    }
    console.error("Taskly API request failed:", error);
    send(response, 500, { error: "The server could not complete the request." });
  });
});

server.listen(port, host, () => {
  console.log(`Taskly server listening at http://${host}:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Taskly API could not start: port ${port} is already in use. Stop the existing Taskly server or set PORT to a different port.`);
  } else {
    console.error("Taskly API failed to start:", error);
  }
  process.exitCode = 1;
});
