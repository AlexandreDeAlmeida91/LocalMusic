import {ROOT_DIR, ensureDirectories, readJsonWithBackup, writeJsonAtomic} from './storage';
import {serialQueue} from './workQueue';
const serialize = serialQueue();
const path = `${ROOT_DIR}import-queue.json`;
export async function readImportJournal() {
  const data = await readJsonWithBackup(path, null);
  return data?.version === 1 && Array.isArray(data.rows) ? data : null;
}
export const writeImportJournal = data => {
  const snapshot = JSON.parse(JSON.stringify(data));
  return serialize(async () => {
    await ensureDirectories([ROOT_DIR]);
    await writeJsonAtomic(path, {version:1, ...snapshot});
  });
};
