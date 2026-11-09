import type { Data } from '../data';
import type { DataState, Screen, SetUiState, UiState } from '../types';
import { buildScreens } from './screens';
import { buildShell } from './shell';
import type { PvModelInput } from './pv/slice';

/**
 * Mockup screen view models are only built once data has loaded; screens render only in the Populated
 * state, which App never selects without data. PV screens (spec 010+) are fed by `pv.slice` instead.
 */
export function buildModel(screen: Screen, dataState: DataState, st: UiState, setState: SetUiState, go: (s: Screen) => void, data: Data | null, retry: () => void, pv: PvModelInput | null = null) {
  return { ...buildShell(screen, dataState, go, data, pv), retry: pv?.slice ? pv.slice.retry : retry, ...buildScreens(st, setState, go, data, pv) };
}

export type Model = ReturnType<typeof buildModel>;
