export const SCREENS = ['c360', 'portfolio', 'orders', 'alts', 'exceptions', 'home', 'activity', 'money', 'admin', 'settlements', 'messages'] as const;
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
  /** Admin (spec 010): reload confirmation open / reload in flight / last notice. */
  adminConfirm: boolean;
  adminBusy: boolean;
  adminNotice: string | null;
  /** Settlements (spec 007): From / To input drafts (null = show the loaded window) and validation message. */
  stlFrom: string | null;
  stlTo: string | null;
  stlMsg: string | null;
  /** Position check (spec 006): picked-but-not-run dates, row in edit, edit fields, save in flight, lblMsg override. */
  pcDate: string | null;
  pcAllDate: string | null;
  pcEdit: string | null;
  pcEditStatus: string;
  pcEditNote: string;
  pcBusy: boolean;
  pcNotice: string | null;
  pcError: string | null;
  /** Message Browser (spec 009): current page of the file list (50 rows). */
  msgPage: number;
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
  adminConfirm: false,
  adminBusy: false,
  adminNotice: null,
  stlFrom: null,
  stlTo: null,
  stlMsg: null,
  pcDate: null,
  pcAllDate: null,
  pcEdit: null,
  pcEditStatus: 'OPEN',
  pcEditNote: '',
  pcBusy: false,
  pcNotice: null,
  pcError: null,
  msgPage: 0,
};

export type SetUiState = (patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void;
