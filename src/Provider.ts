import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Principal } from '@dfinity/agent';
import getDomainMetadata from './utils/domain-metadata';

export interface RequestConnectInput {
  canisters?: Principal[];
  timeout?: number;
}

export interface TimeStamp { 'timestamp_nanos': bigint }

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

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  principal: Principal;
  requestBalance(accountId?: number): Promise<bigint>;
  requestTransfer(args: SendICPArgs): Promise<bigint>;
  requestConnect(): Promise<any>;
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

  public async requestBalance(accountId = 0): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestBalance', [metadata, accountId], {
      timeout: 0,
      target: "",
    })
  }

  public async requestTransfer(args: SendICPArgs): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestTransfer', [metadata, args], {
      timeout: 0,
      target: "",
    })
  }
};
