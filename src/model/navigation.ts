import { clientParam } from '../api/client';
import type { ClientSelection } from '../api/client';
import type { Screen } from '../types';

const CLIENT_SCOPE_PARAMS = ['acct', 'safe', 'message', 'messageId', 'page', 'date', 'account', 'from', 'to'];

export function clientSwitchLocation(search: string, selection: ClientSelection, screen: Screen): { search: string; screen: Screen } {
  const params = new URLSearchParams(search);
  if (selection.kind === 'household' && selection.id === 'HH-WHITFIELD') params.delete('client');
  else params.set('client', clientParam(selection));

  const nextScreen = screen === 'custody-holdings' && selection.kind === 'household' ? 'c360' : screen;
  params.set('screen', nextScreen);
  for (const name of CLIENT_SCOPE_PARAMS) params.delete(name);

  return { search: params.toString(), screen: nextScreen };
}
