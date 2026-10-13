export const SCREENS = ['c360', 'portfolio', 'orders', 'alts', 'exceptions', 'home', 'activity', 'money', 'custody-holdings', 'custody-settlements', 'position-check', 'message-browser', 'custody-admin'] as const;
export type Screen = (typeof SCREENS)[number];

export const DATA_STATES = ['Populated', 'Loading', 'Empty', 'Error'] as const;
export type DataState = (typeof DATA_STATES)[number];

export type Period = '1M' | '3M' | 'YTD' | '1Y' | '3Y' | 'Since inception';
export type Rail = 'Wire' | 'EFT' | 'Interac e-Transfer';

export interface UiState {
  cls: string;
  period: Period;
  excluded: Record<number, boolean>;
  approved: boolean;
  exSel: string | null;
  exCause: string;
  mStep: 1 | 2 | 3;
  amount: string;
  bene: number;
  rail: Rail;
}

export const INITIAL_UI_STATE: UiState = {
  cls: 'All',
  period: '1Y',
  excluded: {},
  approved: false,
  exSel: null,
  exCause: 'All',
  mStep: 1,
  amount: '40000',
  bene: 0,
  rail: 'Wire',
};

export type SetUiState = (patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void;
