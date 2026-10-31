import { query } from '../db/pool';
import { isoDate } from './advisor';
import type { ActivityDto, PaymentsDto } from '../../src/api/types';

export async function getActivity(clientId: string): Promise<ActivityDto> {
  const [feed, pending, steps, transactions] = await Promise.all([
    query<ActivityDto['feed'][number]>(
      `SELECT ${isoDate('activity_date', 'date')}, description AS "description", account_label AS "account", amount AS "amount"
         FROM portal_activity_feed WHERE client_id = $1 ORDER BY display_order`, [clientId]),
    query<Omit<ActivityDto['pending'][number], 'steps'> & { requestId: number }>(
      `SELECT request_id AS "requestId", title AS "title", amount AS "amount", status_text AS "status", eta_text AS "eta",
              current_step AS "currentStep"
         FROM pending_requests WHERE client_id = $1 ORDER BY display_order`, [clientId]),
    query<{ requestId: number; name: string; time: string | null }>(
      `SELECT s.request_id AS "requestId", s.step_name AS "name", s.step_time_label AS "time"
         FROM pending_request_steps s JOIN pending_requests r ON r.request_id = s.request_id
        WHERE r.client_id = $1 ORDER BY s.request_id, s.step_no`, [clientId]),
    query<ActivityDto['transactions'][number]>(
      `SELECT ${isoDate('trade_date', 'tradeDate')}, ${isoDate('settle_date', 'settleDate')}, description AS "description",
              detail AS "detail", account_key AS "accountKey", amount AS "amount", status AS "status", next_step AS "nextStep"
         FROM transactions WHERE client_id = $1 ORDER BY display_order`, [clientId]),
  ]);
  return {
    feed,
    pending: pending.map(({ requestId, ...p }) => ({ ...p, steps: steps.filter(s => s.requestId === requestId).map(({ name, time }) => ({ name, time })) })),
    transactions,
  };
}

export async function getPayments(clientId: string): Promise<PaymentsDto> {
  const [payees, rails] = await Promise.all([
    query<Omit<PaymentsDto['payees'][number], 'isNew'> & { isNew: number }>(
      `SELECT payee_name AS "name", description AS "description", history_label AS "history", is_new AS "isNew"
         FROM payees WHERE client_id = $1 ORDER BY display_order`, [clientId]),
    query<PaymentsDto['rails'][number]>(
      `SELECT rail_name AS "name", daily_limit AS "dailyLimit", fee AS "fee", speed_label AS "speed", arrival_label AS "arrival"
         FROM payment_rails ORDER BY display_order`),
  ]);
  return { payees: payees.map(p => ({ ...p, isNew: p.isNew === 1 })), rails };
}
