import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Principal, Agent, HttpAgent, DerEncodedBlob } from '@dfinity/agent';
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
  agent: Agent;
};

export default class Provider implements ProviderInterface {

  // @ts-ignore
  public agent: Agent;

  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;

  constructor(clientRPC: BrowserRPC, publicKey: DerEncodedBlob) {
    this.clientRPC = clientRPC;

    const identity = new PlugIdentity(publicKey, this.sign);

    this.agent = new HttpAgent({
      identity,
      host: "https://mainnet.dfinity.network",
    });

    this.clientRPC.start();
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
    return await this.clientRPC.call('sign', [metadata.url, payload], {
      timeout: 0,
      target: "",
    });
  };
};
