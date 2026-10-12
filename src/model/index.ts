import type { Data } from '../data';
import type { DataState, Screen, SetUiState, UiState } from '../types';
import { buildScreens } from './screens';
import { buildShell } from './shell';

type ScreensModel = ReturnType<typeof buildScreens>;

/**
 * Screen view models are only built once data has loaded; screens render only in the Populated
 * state, which App never selects without data.
 */
export function buildModel(screen: Screen, dataState: DataState, st: UiState, setState: SetUiState, go: (s: Screen) => void, data: Data | null, retry: () => void) {
  return { ...buildShell(screen, dataState, go, data), retry, ...(data ? buildScreens(st, setState, go, data) : ({} as ScreensModel)) };
}

export type Model = ReturnType<typeof buildModel>;
