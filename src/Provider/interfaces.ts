import { Agent, HttpAgent, ActorSubclass } from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

import { CreateAgentParams } from "../utils/agent";

export interface TransactionPrevResponse {
  transactionIndex: number;
  response: any;
}
  
export interface Transaction<SuccessResponse = unknown[]> {
  idl: IDL.InterfaceFactory;
  canisterId: string;
  methodName: string;
  args: (responses?: TransactionPrevResponse[]) => any[] | any[];
  onSuccess: (res: SuccessResponse) => Promise<any>;
  onFail: (err: any, responses?: TransactionPrevResponse[]) => Promise<void>;
}
  
export interface RequestConnectInput {
  canisters?: Principal[];
  timeout?: number;
}
  
export interface TimeStamp {
  timestamp_nanos: bigint;
}
  
export interface SendOpts {
  fee?: bigint;
  memo?: bigint;
  from_subaccount?: number;
  created_at_time?: TimeStamp;
}
  
  // The amount in e8s (ICPs)
export interface RequestTransferParams {
  to: string;
  amount: bigint;
  opts?: SendOpts;
}

// Fee and Memo is a bigint casted to string
export interface SendOptsToken {
  fee?: string;
  memo?: string;
  from_subaccount?: number;
  created_at_time?: TimeStamp;
}

// The amount is a string with comma
  export interface RequestTransTokenferParams {
    to: string;
    strAmount: string;
    opts?: SendOpts;
    token?: string;
  }
  
export interface CreateActor<T> {
  agent: HttpAgent;
  actor: ActorSubclass<ActorSubclass<T>>;
  canisterId: string;
  interfaceFactory: IDL.InterfaceFactory;
}
  
export interface RequestBurnXTCParams {
  to: string;
  amount: bigint;
}
  
export interface RequestConnectParams extends CreateAgentParams {
  timeout?: number;
}
  
export interface ProviderInterfaceVersions {
  provider: string;
  extension: string;
}

export interface ICNSInfo {
  names: Array<string>;
  reverseResolvedName?: string;
}
  
export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
  batchTransactions(transactions: Transaction[]): Promise<boolean>;
  requestBalance(accountId?: number | null): Promise<bigint>;
  requestTransfer(params: RequestTransferParams): Promise<bigint>;
  requestConnect(params: RequestConnectParams): Promise<any>;
  createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>>;
  createAgent(params: CreateAgentParams): Promise<boolean>;
  requestBurnXTC(params: RequestBurnXTCParams): Promise<any>;
  getPrincipal: () => Promise<Principal | string>;
  versions: ProviderInterfaceVersions;
  agent?: Agent | null;
  principal?: string;
  accountId?: string;
  getICNSInfo: () => Promise<ICNSInfo>;
}