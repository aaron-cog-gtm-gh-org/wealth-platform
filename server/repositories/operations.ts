import { query } from '../db/pool';
import type { SettlementExceptionsDto } from '../../src/api/types';

export async function getSettlementExceptions(queueName: string): Promise<SettlementExceptionsDto | null> {
  const [queue] = await query<SettlementExceptionsDto['queue']>(
    `SELECT queue_name AS "name", opened_today AS "openedToday", cleared_today AS "clearedToday",
            median_resolve_minutes AS "medianResolveMinutes", auto_assign_time AS "autoAssignTime", buy_in_day AS "buyInDay"
       FROM ops_queues WHERE queue_name = :queueName`, { queueName });
  if (!queue) return null;
  const [causes, exceptions] = await Promise.all([
    query<SettlementExceptionsDto['causes'][number]>(
      `SELECT cause_name AS "name", suggested_action AS "suggestedAction", action_short AS "actionShort", explanation AS "explanation"
         FROM settlement_exception_causes ORDER BY display_order`),
    query<SettlementExceptionsDto['exceptions'][number]>(
      `SELECT exception_id AS "id", age_days AS "ageDays", settlement_value AS "value", instrument_name AS "instrument", side AS "side",
              account_no AS "accountNo", counterparty AS "counterparty", cause_name AS "cause", owner_name AS "owner"
         FROM settlement_exceptions WHERE queue_name = :queueName
        ORDER BY age_days DESC, settlement_value DESC, exception_id`, { queueName }),
  ]);
  return { queue, causes, exceptions };
}
