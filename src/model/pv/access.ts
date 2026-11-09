import type { PvRole } from '../../api/pv-types';
import type { Screen } from '../../types';
import type { PvContextPatch } from './context';

/** One legacy PV page: Site.Master nav link + BasePage.RequiredRoles (null = any signed-in user). */
export interface PvPage {
  page: string;
  label: string;
  roles: readonly PvRole[] | null;
  /** Migrated screen id; null until that page's screen spec (005–009) lands. */
  screen: Screen | null;
  /** Context the nav link sets on top of the kept PV context. */
  params?: PvContextPatch;
}

/** Site.Master.cs navigation + each page's RequiredRoles (legacy Q17). Order = legacy nav order. */
export const PV_PAGES: readonly PvPage[] = [
  { page: 'ClientSearch.aspx', label: 'Client search', roles: null, screen: 'clients' },
  { page: 'ClientSummary.aspx', label: 'Client summary', roles: null, screen: 'c360' },
  { page: 'Holdings.aspx', label: 'Holdings', roles: null, screen: null },
  { page: 'Settlements.aspx', label: 'Settlements', roles: null, screen: 'settlements' },
  { page: 'PositionCheck.aspx', label: 'Position check', roles: ['OPS', 'ADMIN'], screen: 'exceptions', params: { pc: '1' } },
  { page: 'MessageBrowser.aspx', label: 'Message browser', roles: ['OPS', 'ADMIN'], screen: null },
  { page: 'Admin.aspx', label: 'Admin', roles: ['ADMIN'], screen: 'admin' },
];

/** BasePage.OnInit: exact, case-sensitive match of the session role against RequiredRoles. */
export function canAccess(roles: readonly string[] | null, role: string | null | undefined): boolean {
  if (role == null) return false;
  return !roles || roles.length === 0 || roles.some(r => r === role);
}

export const pvPageForScreen = (screen: Screen) => PV_PAGES.find(p => p.screen === screen) ?? null;

/** Site.Master nav entries visible to a role (only pages that already have a migrated screen). */
export const pvNavFor = (role: string | null | undefined) =>
  PV_PAGES.filter((p): p is PvPage & { screen: Screen } => p.screen !== null && canAccess(p.roles, role));

export const rolesLabel = (roles: readonly string[] | null) => (roles && roles.length ? roles.join(' or ') : 'any signed-in role');
