import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { computeView, type CompletedEntry, type RangeMode } from '../lib/completedChallengesStats';

async function fetchAllCompleted(token: string): Promise<CompletedEntry[]> {
  const res = await fetch('/api/users/me/challenges/completed-dates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data: { dates: string[] } = await res.json();
  return data.dates.map(completedAt => ({ completedAt }));
}

const TABS: { mode: RangeMode; labelKey: string }[] = [
  { mode: 'week', labelKey: 'uquail.completedChart.week' },
  { mode: 'month', labelKey: 'uquail.completedChart.month' },
  { mode: 'year', labelKey: 'uquail.completedChart.year' },
];

const CompletedChallengesChart: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const [items, setItems] = useState<CompletedEntry[] | null>(null);
  const [mode, setMode] = useState<RangeMode>('week');
  const [offset, setOffset] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    let cancelled = false;
    fetchAllCompleted(token).then(res => { if (!cancelled) setItems(res); });
    return () => { cancelled = true; };
  }, [user]);

  const { buckets, periodLabel, periodStart } = useMemo(
    () => computeView(items ?? [], mode, offset, i18n.language),
    [items, mode, offset, i18n.language]
  );
  const total = useMemo(() => buckets.reduce((sum, b) => sum + b.value, 0), [buckets]);
  const maxValue = Math.max(1, ...buckets.map(b => b.value));
  const oldestDate = useMemo(() => {
    if (!items || items.length === 0) return null;
    return new Date(Math.min(...items.map(it => new Date(it.completedAt).getTime())));
  }, [items]);
  // On a tout l'historique (voir /api/users/me/challenges/completed-dates) — pas la peine de
  // laisser naviguer vers une période antérieure au tout premier défi complété, qui sera
  // toujours vide.
  const prevDisabled = oldestDate !== null && periodStart <= oldestDate;

  const switchMode = (next: RangeMode) => { setMode(next); setOffset(0); setActiveIdx(null); };

  // Vue mois : défile jusqu'aux jours les plus récents à l'ouverture plutôt que de laisser
  // l'utilisateur sur le 1er du mois — c'est la fin de la période qui est la plus pertinente.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode === 'month' && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [mode, offset, buckets.length]);

  if (!user) return null;

  if (items === null) {
    return (
      <div className="rounded-3xl p-4 mb-5 animate-pulse" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <div className="h-4 rounded-full w-1/3 mb-4" style={{ background: 'var(--q-line)' }} />
        <div className="h-3 rounded-full w-1/4 mb-4" style={{ background: 'var(--q-line)' }} />
        <div className="flex items-end gap-2.5" style={{ height: 108 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex-1 rounded-t-md" style={{ height: 20 + (i % 4) * 16, background: 'var(--q-line)' }} />
          ))}
        </div>
      </div>
    );
  }

  const activeBucket = activeIdx !== null ? buckets[activeIdx] : null;
  const readoutValue = activeBucket ? activeBucket.value : total;

  return (
    <div className="rounded-3xl p-4 mb-5" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold flex items-center gap-1.5" style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.2, color: 'var(--q-text)' }}>
          <BarChart3 size={16} style={{ color: 'var(--q-accent)' }} aria-hidden="true" />
          {t('uquail.completedChart.title')}
        </h2>
        <div className="flex items-center gap-1" role="tablist" aria-label={t('uquail.completedChart.title')}>
          {TABS.map(tab => (
            <button key={tab.mode} type="button" role="tab" aria-selected={mode === tab.mode}
              onClick={() => switchMode(tab.mode)}
              style={{
                padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: mode === tab.mode ? 'var(--q-accent)' : 'transparent',
                color: mode === tab.mode ? '#fff' : 'var(--q-text3)',
                transition: 'background 0.15s, color 0.15s',
              }}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <button type="button" onClick={() => { setOffset(o => o + 1); setActiveIdx(null); }} disabled={prevDisabled}
          aria-label={t('uquail.completedChart.prevPeriod')}
          style={{
            width: 26, height: 26, borderRadius: 8, border: 'none', flexShrink: 0,
            background: 'var(--q-bg-flat)', color: prevDisabled ? 'var(--q-line)' : 'var(--q-text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: prevDisabled ? 'default' : 'pointer',
          }}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="text-xs font-bold" style={{ color: 'var(--q-text)' }}>{periodLabel}</span>
        <button type="button" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}
          aria-label={t('uquail.completedChart.nextPeriod')}
          style={{
            width: 26, height: 26, borderRadius: 8, border: 'none', flexShrink: 0,
            background: 'var(--q-bg-flat)', color: offset === 0 ? 'var(--q-line)' : 'var(--q-text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: offset === 0 ? 'default' : 'pointer',
          }}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-4" style={{ minHeight: 46 }}>
        <div className="flex items-baseline gap-2">
          <span style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--q-display)', color: 'var(--q-text)', lineHeight: 1 }}>
            {readoutValue}
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--q-text2)' }}>
            {t('uquail.completedChart.unitLabel', { count: readoutValue })}
          </span>
        </div>
        <div className="text-xs font-bold mt-1" style={{ color: 'var(--q-accent)', visibility: activeBucket ? 'visible' : 'hidden' }}>
          {activeBucket ? activeBucket.fullLabel : ' '}
        </div>
      </div>

      {total === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: 'var(--q-text3)' }}>
          {t('uquail.completedChart.empty')}
        </p>
      ) : (
        <div ref={mode === 'month' ? scrollRef : undefined} className="q-hidescroll"
          style={{ overflowX: mode === 'month' ? 'auto' : 'hidden', paddingBottom: mode === 'month' ? 4 : 0 }}>
          <div className="flex items-end" style={{
            gap: mode === 'week' ? 8 : mode === 'month' ? 10 : 2, height: 96,
            width: mode === 'month' ? buckets.length * 30 : '100%',
          }}>
            {buckets.map((b, i) => (
              <button key={i} type="button"
                onClick={() => setActiveIdx(prev => prev === i ? null : i)}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(prev => prev === i ? null : prev)}
                onFocus={() => setActiveIdx(i)}
                onBlur={() => setActiveIdx(prev => prev === i ? null : prev)}
                aria-label={t('uquail.completedChart.barAriaLabel', { label: b.fullLabel, count: b.value })}
                aria-pressed={activeIdx === i}
                className={mode === 'month' ? 'flex flex-col items-center justify-end h-full' : 'flex-1 flex flex-col items-center justify-end h-full'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 0,
                  width: mode === 'month' ? 20 : undefined, flexShrink: mode === 'month' ? 0 : undefined,
                }}>
                <div style={{
                  width: '100%', maxWidth: mode === 'week' ? 26 : mode === 'year' ? 18 : 20,
                  height: Math.max(4, (b.value / maxValue) * 72),
                  borderRadius: '4px 4px 2px 2px',
                  background: activeIdx === i ? 'var(--q-accent-deep)' : b.value > 0 ? 'var(--q-accent)' : 'var(--q-line)',
                  transition: 'height 0.25s ease, background 0.15s ease',
                }} />
                <span className="mt-1.5 text-[9px] font-semibold" style={{ color: 'var(--q-text3)', visibility: b.showLabel ? 'visible' : 'hidden' }}>
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedChallengesChart;
