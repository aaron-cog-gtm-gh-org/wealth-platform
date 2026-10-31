import { badRequest } from './errors';
import type { AssetClass, ExceptionStatus, KycStatus, RiskProfile } from './types';

const RISK_PROFILES: RiskProfile[] = ['Conservative', 'Moderate', 'Growth'];
const KYC_STATUSES: KycStatus[] = ['Current', 'Review due'];
const EXCEPTION_STATUSES: ExceptionStatus[] = ['Open', 'In progress', 'Resolved'];
const ALLOCATION_CLASSES: AssetClass[] = ['Equity', 'Fixed income', 'Cash'];
export const REBALANCE_TOLERANCE_PTS = 1;

export type Body = Record<string, unknown>;

export function bodyObject(value: unknown): Body {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) badRequest('Request body must be a JSON object.');
  return value as Body;
}

export function rejectUnknownFields(body: Body, allowed: string[]) {
  const unknown = Object.keys(body).find(key => !allowed.includes(key));
  if (unknown) badRequest(`Unknown field "${unknown}".`);
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) badRequest(`${field} is required.`);
  return value.trim();
}

export function validateClientPatch(body: Body) {
  rejectUnknownFields(body, ['riskProfile', 'kycStatus']);
  if (!('riskProfile' in body) && !('kycStatus' in body)) badRequest('At least one field is required.');
  if ('riskProfile' in body && !RISK_PROFILES.includes(body.riskProfile as RiskProfile)) {
    badRequest('Risk profile must be Conservative, Moderate, or Growth.');
  }
  if ('kycStatus' in body && !KYC_STATUSES.includes(body.kycStatus as KycStatus)) {
    badRequest('KYC status must be Current or Review due.');
  }
  return body as { riskProfile?: RiskProfile; kycStatus?: KycStatus };
}

export function parseQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
    badRequest('Quantity must be a positive whole number no greater than 1,000,000.');
  }
  return value;
}

export function parseAmount(value: unknown): string {
  if (typeof value !== 'number' && typeof value !== 'string') badRequest('Amount must be a positive number with up to 2 decimal places.');
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) badRequest('Amount must be a positive number with up to 2 decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n) badRequest('Amount must be greater than 0.');
  if (cents > 1_000_000_000n) badRequest('Amount must not exceed 10,000,000.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function parseReference(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') badRequest('Reference must be a string.');
  const reference = value.trim();
  if (reference.length > 80) badRequest('Reference must be 80 characters or fewer.');
  return reference || null;
}

export interface AllocationInput {
  assetClass: AssetClass;
  targetWeight: number;
}

export function validateAllocations(value: unknown): AllocationInput[] {
  if (!Array.isArray(value) || value.length !== 3) badRequest('Allocations must contain exactly 3 entries.');
  const seen = new Set<string>();
  const parsed = value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) badRequest('Each allocation must be an object.');
    const item = entry as Record<string, unknown>;
    rejectUnknownFields(item, ['assetClass', 'targetWeight']);
    if (typeof item.assetClass !== 'string' || !ALLOCATION_CLASSES.includes(item.assetClass as AssetClass)) {
      badRequest('Allocation asset class is invalid.');
    }
    if (seen.has(item.assetClass)) badRequest(`Duplicate allocation asset class "${item.assetClass}".`);
    seen.add(item.assetClass);
    if (typeof item.targetWeight !== 'number' || !Number.isFinite(item.targetWeight)) {
      badRequest('Every asset class needs a numeric target.');
    }
    if (item.targetWeight < 0 || item.targetWeight > 100
      || !/^\d+(\.\d{1,2})?$/.test(String(item.targetWeight))) {
      badRequest('Target weight must be a number from 0 to 100 with at most 2 decimal places.');
    }
    return { assetClass: item.assetClass as AssetClass, targetWeight: item.targetWeight };
  });
  if (ALLOCATION_CLASSES.some(assetClass => !seen.has(assetClass))) badRequest('Each allocation asset class must appear exactly once.');
  const total = parsed.reduce((sum, allocation) => sum + Math.round(allocation.targetWeight * 100), 0);
  if (total !== 10_000) badRequest('Target weights must sum to 100.');
  return parsed;
}

export function validateExceptionPatch(body: Body) {
  rejectUnknownFields(body, ['owner', 'note', 'status']);
  if (!('owner' in body) && !('note' in body) && !('status' in body)) badRequest('At least one field is required.');
  let owner: string | undefined;
  if ('owner' in body) {
    if (typeof body.owner !== 'string') badRequest('Owner must be A. Nguyen or S. Patel.');
    owner = (body.owner as string).trim();
    if (!owner) badRequest('Owner is required.');
    if (owner !== 'A. Nguyen' && owner !== 'S. Patel') badRequest('Owner must be A. Nguyen or S. Patel.');
  }
  let note: string | undefined;
  if ('note' in body) {
    if (typeof body.note !== 'string') badRequest('Note must be a string.');
    note = (body.note as string).trim();
    if (note.length < 10) badRequest('Add a note of at least 10 characters.');
    if (note.length > 500) badRequest('Note must be 500 characters or fewer.');
  }
  if ('status' in body && !EXCEPTION_STATUSES.includes(body.status as ExceptionStatus)) {
    badRequest('Status must be Open, In progress, or Resolved.');
  }
  return { owner, note, status: body.status as ExceptionStatus | undefined };
}

export function validateExceptionTransition(
  current: { status: ExceptionStatus; owner: string | null; note: string | null },
  patch: { owner?: string; note?: string; status?: ExceptionStatus },
) {
  if (current.status === 'Resolved') return { httpStatus: 409, message: 'resolved' } as const;
  const owner = patch.owner ?? current.owner;
  const note = patch.note ?? current.note;
  const status = patch.status ?? current.status;
  if (status === 'Resolved' && !owner) return { httpStatus: 400, message: 'Owner is required.' } as const;
  if (status === 'Resolved' && (!note || note.trim().length < 10)) {
    return { httpStatus: 400, message: 'Add a note of at least 10 characters.' } as const;
  }
  return { httpStatus: 200, owner, note, status: status as ExceptionStatus } as const;
}

export function computeDrifts(items: { assetClass: AssetClass; currentWeight: number; targetWeight: number }[]) {
  const trades = items.map(({ assetClass, currentWeight, targetWeight }) => {
    const drift = Math.round((currentWeight - targetWeight) * 100) / 100 || 0;
    return { assetClass, currentWeight, targetWeight, drift };
  });
  return {
    trades,
    status: trades.some(item => Math.abs(item.drift) > REBALANCE_TOLERANCE_PTS) ? 'Ready' as const : 'Within tolerance' as const,
  };
}
