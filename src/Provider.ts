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
interface RequestTransferParams {
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

interface RequestConnectParams {
  whitelist: string[];
  host: string;
}

interface CreateAgentParams extends RequestConnectParams {};

const DEFAULT_HOST = "https://mainnet.dfinity.network";
/* eslint-disable @typescript-eslint/no-unused-vars */
const DEFAULT_REQUEST_CONNECT_ARGS: RequestConnectParams = {
  whitelist: [],
  host: DEFAULT_HOST,
};

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  requestBalance(accountId?: number): Promise<bigint>;
  requestTransfer(params: RequestTransferParams): Promise<bigint>;
  requestConnect(params: RequestConnectParams): Promise<any>;
  createAgent(params: CreateAgentParams): Promise<any>;
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

  public async requestConnect({
    whitelist = DEFAULT_REQUEST_CONNECT_ARGS.whitelist,
    host = DEFAULT_REQUEST_CONNECT_ARGS.host,
  }: RequestConnectParams): Promise<any> {
    const metadata = getDomainMetadata();

    const response = await this.clientRPC.call('requestConnect', [metadata, whitelist], {
      timeout: 0,
      target: "",
    });

    if (
      !whitelist
      || !Array.isArray(whitelist)
      || !whitelist.length
    ) return response;

    const identity = new PlugIdentity(response, this.sign.bind(this), whitelist);

    this.agent = new HttpAgent({
      identity,
      host,
    });

    return !!this.agent;
  };

  // Note: this will overwrite the current agent
  public async createAgent({
    whitelist = DEFAULT_REQUEST_CONNECT_ARGS.whitelist,
    host = DEFAULT_REQUEST_CONNECT_ARGS.host,
  }: CreateAgentParams) {
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

  public async requestTransfer(params: RequestTransferParams): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestTransfer', [metadata, params], {
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
