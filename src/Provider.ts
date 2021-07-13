import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Actor, Principal } from '@dfinity/agent';
import getDomainMetadata from './utils/domain-metadata';

export type ProxyDankCallback = <T extends Actor>(actor: T) => void;

export type WithDankProxy = <T extends Actor>(
  actor: T,
  cb: (actor: T) => void,
  cycles: number,
) => void;

export interface RequestConnectInput {
  canisters?: Principal[];
  timeout?: number;
}

export interface TimeStamp { 'timestamp_nanos' : bigint }

export interface SendOpts {
  fee?: bigint;
  memo?: bigint;
  from_subaccount?: number;
  created_at_time?: TimeStamp;
}

interface SendICPArgs {
  to: string;
  amount: bigint;
  opts?: SendOpts;
}

export interface RequestCycleWithdrawal {
  canisterId: string;
  methodName: string;
  parameters: string;
  cycles: number;
}

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  principal: Principal;
  withDankProxy: WithDankProxy;
  requestBalance(accountId: number): Promise<bigint>;
  requestTransfer(args: SendICPArgs): Promise<bigint>;
  requestConnect(): Promise<any>; // input: RequestConnectInput // should return Promise<Agent>
  requestCycleWithdrawal(requests: RequestCycleWithdrawal[]): Promise<any>;
};

export default class Provider implements ProviderInterface {
  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;

  constructor(clientRPC: BrowserRPC) {
    this.clientRPC = clientRPC;
  }

  public async isConnected(): Promise<boolean> {
    const metadata = getDomainMetadata();
    return await this.clientRPC.call('isConnected', [metadata.url], {
      timeout: 0,
      target: "",
    });
  };

  // @ts-ignore
  public async requestConnect(): Promise<any> {
    const metadata = getDomainMetadata();
    const icon = metadata.icons[0] || null;

    return await this.clientRPC.call('requestConnect', [metadata.url, metadata.name, icon], {
      timeout: 0,
      target: "",
    });
  };

  public async requestCycleWithdrawal(requests: RequestCycleWithdrawal[]): Promise<any> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestCycleWithdrawal', [metadata, requests], {
      timeout: 0,
      target: "",
    });
  };

  public async requestBalance(accountId: number): Promise<bigint> {
    return await this.clientRPC.call('requestBalance', [accountId], {
      timeout: 0,
      target: "",
    })
  }

  public async requestTransfer(args: SendICPArgs): Promise<bigint> {
    return await this.clientRPC.call('requestTransfer', [args], {
      timeout: 0,
      target: "",
    })
  }

  public withDankProxy<T extends Actor>(
    actor: T,
    cb: (actor: T) => void,
    cycles: number,
  ): void { }

  public test(name: string): Promise<any> {
    return this.clientRPC.call('test', [name]);
  }
};
