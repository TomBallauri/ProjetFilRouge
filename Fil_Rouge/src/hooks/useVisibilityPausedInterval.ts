import { useEffect, useRef } from 'react';

// Même correctif que useNotificationPolling : sans pause sur visibilitychange, un chat/groupe
// ouvert dans un onglet en arrière-plan continue de fetcher en boucle indéfiniment. On relance
// immédiatement un appel au retour au premier plan pour rattraper ce qui a été manqué.
export function useVisibilityPausedInterval(callback: () => void, intervalMs: number, enabled: boolean) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(() => callbackRef.current(), intervalMs); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVisibilityChange = () => {
      if (document.hidden) { stop(); return; }
      callbackRef.current();
      start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
