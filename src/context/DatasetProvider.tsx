import { createContext, useContext, type ReactNode } from 'react';
import { useDataset, type UseDatasetReturn } from '@/hooks/useDataset';

const DatasetContext = createContext<UseDatasetReturn | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const ds = useDataset();
  return <DatasetContext.Provider value={ds}>{children}</DatasetContext.Provider>;
}

export function useDatasetCtx(): UseDatasetReturn {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDatasetCtx must be used inside <DatasetProvider>');
  return ctx;
}
