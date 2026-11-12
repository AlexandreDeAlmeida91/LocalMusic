// Rejections never poison the queue. Each task reads current state inside the lock.
export function serialQueue() {
  let tail = Promise.resolve();
  return task => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
}

export async function runWorkers(items, count, work, signal) {
  let cursor = 0;
  const results = await Promise.allSettled(Array.from({length: Math.min(count, items.length)}, async () => {
    while (!signal?.aborted && cursor < items.length) {
      const index = cursor++;
      await work(items[index], index);
    }
  }));
  const failed = results.find(r => r.status === 'rejected');
  if (failed) throw failed.reason;
}

export function pendingImportRows(rows) {
  return rows.filter(row => !['Ajouté ✓', 'Déjà présent — ignoré', 'Déjà dans la bibliothèque', 'Ignoré'].includes(row.status));
}
