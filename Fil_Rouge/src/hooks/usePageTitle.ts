import { useEffect } from 'react';

const BASE = 'U-Quail';

export function usePageTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} — ${BASE}` : BASE;
    return () => { document.title = BASE; };
  }, [page]);
}
