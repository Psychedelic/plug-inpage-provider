import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Agent, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import getDomainMetadata from './utils/domain-metadata';
import { PlugIdentity } from './identity';

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

// The amount in e8s (ICPs)
interface SendICPTsArgs {
  to: string;
  amount: bigint;
  opts?: SendOpts;
}

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  principal: Principal;
  requestBalance(accountId?: number): Promise<bigint>;
  requestTransfer(args: SendICPTsArgs): Promise<bigint>;
  requestConnect(): Promise<any>;
  createAgent(): Promise<any>;
  agent: Agent | null;
};

export default class Provider implements ProviderInterface {
  public agent: Agent | null;
  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;
  constructor(clientRPC: BrowserRPC) {
    this.clientRPC = clientRPC;
    this.clientRPC.start();
    this.agent = null;
  }

  public async createAgent() {
    const metadata = getDomainMetadata();
    const publicKey = await this.clientRPC.call('getPublicKey', [metadata.url], {
      timeout: 0,
      target: "",
    });
    const identity = new PlugIdentity(publicKey, this.sign.bind(this));
    console.log('created identity', identity);
    this.agent = new HttpAgent({
      identity,
      host: "https://mainnet.dfinity.network",
    });
    console.log('created agent', this.agent);
    return;
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

  public async requestTransfer(args: SendICPTsArgs): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestTransfer', [metadata, args], {
      timeout: 0,
      target: "",
    })
  }

  public async sign(payload: ArrayBuffer): Promise<ArrayBuffer> {
    const metadata = getDomainMetadata();
    console.log('calling sign on the inpage', payload);
    const res = await this.clientRPC.call('sign', [metadata.url, payload], {
      timeout: 0,
      target: "",
    });
    console.log('inpage res', res) 
    return new Uint8Array(res);
  };
};
