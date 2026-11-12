import {ROOT_DIR, ensureDirectories, readJsonWithBackup, writeJsonAtomic} from './storage';
import {serialQueue} from './workQueue';
const serialize = serialQueue();
const path = `${ROOT_DIR}preferences.json`;
export const readPreferences = () => readJsonWithBackup(path, {});
export const updatePreferences = patch => serialize(async () => {
  await ensureDirectories([ROOT_DIR]);
  const current = await readPreferences();
  await writeJsonAtomic(path, {...current, ...patch});
});
