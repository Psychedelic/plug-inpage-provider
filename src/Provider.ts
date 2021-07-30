import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Agent, HttpAgent, Actor, ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
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

interface CreateActor<T> {
  agent: HttpAgent;
  actor: ActorSubclass<ActorSubclass<T>>;
  canisterId: string;
  interfaceFactory: IDL.InterfaceFactory;
}

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  requestBalance(accountId?: number): Promise<bigint>;
  requestTransfer(args: SendICPTsArgs): Promise<bigint>;
  requestConnect(whitelist?: string[], host?: string): Promise<any>;
  createAgent(whitelist: string[], host?: string): Promise<any>;
  createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>>;
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

  public deleteAgent() {
    this.agent = null;
    return;
  }

  public async createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>> {
    if (!this.agent) throw Error('Oops! Agent initialization required.');

    return Actor.createActor(interfaceFactory, {
      agent: this.agent,
      canisterId,
    })
  }

  public async isConnected(): Promise<boolean> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('isConnected', [metadata.url], {
      timeout: 0,
      target: "",
    });
  };

  // @ts-ignore
  public async requestConnect(whitelist?: string[] = [], host = "https://mainnet.dfinity.network"): Promise<any> {
    const metadata = getDomainMetadata();

    const response = await this.clientRPC.call('requestConnect', [metadata, whitelist], {
      timeout: 0,
      target: "",
    });

    if (!whitelist) return response;

    const identity = new PlugIdentity(response, this.sign.bind(this), whitelist);
    this.agent = new HttpAgent({
      identity,
      host,
    });

    return;
  };

  // Note: this will overwrite the current agent
  public async createAgent(whitelist: string[] = [], host = "https://mainnet.dfinity.network") {
    const metadata = getDomainMetadata();
    const publicKey = await this.clientRPC.call('getPublicKey', [metadata, whitelist], {
      timeout: 0,
      target: "",
    });
    const identity = new PlugIdentity(publicKey, this.sign.bind(this), whitelist);
    this.agent = new HttpAgent({
      identity,
      host,
    });
    return;
  }

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
    const res = await this.clientRPC.call('sign', [payload, metadata], {
      timeout: 0,
      target: "",
    });
    return new Uint8Array(res);
  };
};
