import { createContext, useContext } from 'react';
import type { Bootstrap } from './api';
import type { Area, Lookups } from './model';

export interface WorkspaceCtx {
  data: Bootstrap;
  lk: Lookups;
  /** Refetches bootstrap; resolves once fresh state is on screen. */
  reload: () => Promise<void>;
  go: (area: Area, extra?: Record<string, string>) => void;
  params: URLSearchParams;
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside the Wealth workspace');
  return ctx;
}
