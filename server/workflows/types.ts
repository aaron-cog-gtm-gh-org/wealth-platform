export type RiskProfile = 'Conservative' | 'Moderate' | 'Growth';
export type KycStatus = 'Current' | 'Review due';
export type OrderSide = 'Buy' | 'Sell';
export type OrderStatus = 'Open' | 'Cancelled';
export type ExceptionStatus = 'Open' | 'In progress' | 'Resolved';
export type AssetClass = 'Equity' | 'Fixed income' | 'Cash';

export interface WorkflowClient {
  id: string;
  name: string;
  riskProfile: RiskProfile;
  kycStatus: KycStatus;
}

export interface WorkflowAccount {
  id: string;
  clientId: string;
  name: string;
  currency: 'CAD' | 'USD';
  cash: number;
}

export interface WorkflowPosition {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
}

export interface WorkflowOrder {
  id: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  status: OrderStatus;
}

export interface WorkflowTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  status: 'Completed';
  reference: string | null;
}

export interface WorkflowException {
  id: string;
  accountId: string;
  reason: string;
  status: ExceptionStatus;
  owner: string | null;
  note: string | null;
}

export interface WorkflowAllocation {
  assetClass: AssetClass;
  currentWeight: number;
  targetWeight: number;
}

export interface WorkflowAudit {
  id: string;
  action: string;
  entityId: string;
  detail: string;
  createdAt: string;
}

export interface WorkflowBootstrap {
  clients: WorkflowClient[];
  accounts: WorkflowAccount[];
  positions: WorkflowPosition[];
  orders: WorkflowOrder[];
  transfers: WorkflowTransfer[];
  exceptions: WorkflowException[];
  allocations: WorkflowAllocation[];
  audit: WorkflowAudit[];
}
