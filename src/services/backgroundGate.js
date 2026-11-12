// No polling and no artificial audio playback to keep iOS awake.
export function createBackgroundGate(initialState = 'active') {
  let state = initialState;
  let granted = false;
  const listeners = new Set();
  return {
    setState(value) { state = value; for (const wake of [...listeners]) wake(); },
    setGranted(value) { granted = value; for (const wake of [...listeners]) wake(); },
    wait(signal, foregroundOnly = false) {
      return new Promise((resolve,reject) => {
        const cleanup = () => {listeners.delete(wake);signal?.removeEventListener('abort',wake);};
        const wake = () => {
          if (signal?.aborted) {cleanup();reject(new Error('Annulé'));}
          else if (state === 'active' || (!foregroundOnly && granted)) {cleanup();resolve();}
        };
        listeners.add(wake);signal?.addEventListener('abort',wake);wake();
      });
    }
  };
}
