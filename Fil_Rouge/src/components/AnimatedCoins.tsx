import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';

type Props = { value: number; className?: string };

// Décompte/recompte fluide du solde de pièces, avec un petit "+N"/"-N" flottant qui apparaît
// puis s'efface — plutôt qu'un saut instantané qui passe facilement inaperçu (ex: un achat en
// boutique qui débite le solde). Respecte le réglage global "réduire les animations".
const AnimatedCoins: React.FC<Props> = ({ value, className }) => {
  const { reduceMotion } = useStore();
  const [displayed, setDisplayed] = useState(value);
  const [delta, setDelta] = useState<number | null>(null);
  const prevRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);
  const deltaTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;

    if (reduceMotion) { setDisplayed(to); return; }

    setDelta(to - from);
    clearTimeout(deltaTimeoutRef.current);
    deltaTimeoutRef.current = setTimeout(() => setDelta(null), 1200);

    const duration = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, reduceMotion]);

  useEffect(() => () => clearTimeout(deltaTimeoutRef.current), []);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className={className}>
      <span aria-live="polite">{displayed.toLocaleString('fr-FR')}</span>
      {delta !== null && (
        // Pastille avec son propre fond opaque (pas juste du texte coloré) : sinon la
        // lisibilité dépend totalement de ce qu'il y a derrière (illisible sur le fond orange
        // de la boutique par ex.) — là, elle reste lisible peu importe où le compteur s'affiche.
        <span aria-hidden="true" className="q-coin-delta" style={{
          position: 'absolute', left: '50%', bottom: '100%', marginBottom: 6,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', fontSize: 12, fontWeight: 800,
          padding: '2px 8px', borderRadius: 999,
          background: delta < 0 ? '#DC2626' : '#16A34A',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  );
};

export default AnimatedCoins;
