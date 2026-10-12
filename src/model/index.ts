import type { DataState, Screen, SetUiState, UiState } from '../types';
import { buildScreens } from './screens';
import { buildShell } from './shell';

export function buildModel(screen: Screen, dataState: DataState, st: UiState, setState: SetUiState, go: (s: Screen) => void) {
  return { ...buildShell(screen, dataState, go), ...buildScreens(st, setState, go) };
}

export type Model = ReturnType<typeof buildModel>;
