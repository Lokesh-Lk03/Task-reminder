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

export async function initializeStore() {
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dataFile, `${JSON.stringify(defaultData, null, 2)}\n`, { flag: "wx" })
      .catch((writeError) => {
        if (writeError.code !== "EEXIST") throw writeError;
      });
  }
  await readStore();
}

export async function readStore() {
  await writeQueue;
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
    const current = await readStoreFile();
    const next = update(current);
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
