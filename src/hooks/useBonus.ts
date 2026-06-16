import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth';
import type { BonusConfig } from '@/lib/types';

export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  taxRatePct: 23,
  minNetProfit: 0,
  distributePct: 0,
  maxDistribute: 0,
  workers: [],
};

const SAVE_DEBOUNCE_MS = 600;

interface UseBonusReturn {
  config: BonusConfig;
  loading: boolean;
  saving: boolean;
  /** Merge a partial change and schedule a debounced persist. */
  update: (patch: Partial<BonusConfig>) => void;
}

/**
 * Loads the admin-only bonus config from the server and autosaves edits
 * (debounced). The bonus document is fully independent of the dataset and of
 * saved scenarios — editing it never touches any other view.
 */
export function useBonus(): UseBonusReturn {
  const [config, setConfig] = useState<BonusConfig>(DEFAULT_BONUS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/bonus');
        if (cancelled) return;
        if (res.ok) {
          const { config: c } = (await res.json()) as { config: BonusConfig };
          setConfig({ ...DEFAULT_BONUS_CONFIG, ...c });
        }
      } catch {
        // keep defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: BonusConfig) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await authFetch('/api/bonus', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(next),
        });
      } catch {
        // best-effort; UI keeps the local value
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const update = useCallback(
    (patch: Partial<BonusConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // Flush a pending save on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { config, loading, saving, update };
}
