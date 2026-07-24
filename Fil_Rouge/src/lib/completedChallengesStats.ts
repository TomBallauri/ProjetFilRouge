// Bucketing logic for the "Completed challenges" chart (see CompletedChallengesChart.tsx).
// Extracted to a plain module so the trickiest part — calendar math for week/month/year
// navigation — is unit-testable without rendering the component.

export type RangeMode = 'week' | 'month' | 'year';
export type CompletedEntry = { completedAt: string };
export type Bucket = { label: string; fullLabel: string; value: number; showLabel: boolean };
export type View = { buckets: Bucket[]; periodLabel: string; periodStart: Date };

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Semaine calendaire commençant le lundi (comportement standard en France).
export const startOfWeek = (d: Date): Date => {
  const s = startOfDay(d);
  const day = s.getDay(); // 0=dim..6=sam
  s.setDate(s.getDate() + (day === 0 ? -6 : 1 - day));
  return s;
};

// `offset` = nombre de périodes en arrière par rapport à la période courante (0 = semaine/mois/
// année en cours). Les bornes sont calendaires (semaine du lundi, mois civil, année civile) plutôt
// que des fenêtres glissantes, pour que "précédent/suivant" navigue entre périodes cohérentes.
// `now` est injectable (par défaut Date actuelle) pour pouvoir écrire des tests déterministes.
export function computeView(items: CompletedEntry[], mode: RangeMode, offset: number, lang: string, now: Date = new Date()): View {
  if (mode === 'week') {
    const weekStart = startOfWeek(now);
    weekStart.setDate(weekStart.getDate() - offset * 7);
    const buckets: Bucket[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      return {
        label: d.toLocaleDateString(lang, { weekday: 'short' }),
        fullLabel: d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }),
        value: items.filter(it => sameDay(new Date(it.completedAt), d)).length,
        showLabel: true,
      };
    });
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const periodLabel = `${weekStart.toLocaleDateString(lang, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(lang, { day: 'numeric', month: 'short' })}`;
    return { buckets, periodLabel, periodStart: weekStart };
  }
  if (mode === 'month') {
    let y = now.getFullYear();
    let m = now.getMonth() - offset;
    while (m < 0) { m += 12; y--; }
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const buckets: Bucket[] = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const d = new Date(y, m, day);
      return {
        label: String(day),
        fullLabel: d.toLocaleDateString(lang, { day: 'numeric', month: 'long' }),
        value: items.filter(it => sameDay(new Date(it.completedAt), d)).length,
        showLabel: true,
      };
    });
    const periodLabel = new Date(y, m, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    return { buckets, periodLabel, periodStart: new Date(y, m, 1) };
  }
  const year = now.getFullYear() - offset;
  const buckets: Bucket[] = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(year, m, 1);
    return {
      label: d.toLocaleDateString(lang, { month: 'short' }),
      fullLabel: d.toLocaleDateString(lang, { month: 'long', year: 'numeric' }),
      value: items.filter(it => { const id = new Date(it.completedAt); return id.getFullYear() === year && id.getMonth() === m; }).length,
      showLabel: true,
    };
  });
  return { buckets, periodLabel: String(year), periodStart: new Date(year, 0, 1) };
}
