import BrowserRPC from "@fleekhq/browser-rpc/dist/BrowserRPC";
import { Agent, HttpAgent, Actor, ActorSubclass } from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import getDomainMetadata from "./utils/domain-metadata";
import {
  managementCanisterIdlFactory,
  managementCanisterPrincipal,
  transformOverrideHandler,
} from "./utils/ic-management-api";
import { PlugIdentity } from "./identity";
import { versions } from "./constants";

export interface RequestConnectInput {
  canisters?: Principal[];
  timeout?: number;
}

export interface CreateAgentParams extends RequestConnectParams {}

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

interface RequestBurnXTCParams {
  to: string;
  amount: bigint;
}

const DEFAULT_HOST = "https://mainnet.dfinity.network";
/* eslint-disable @typescript-eslint/no-unused-vars */
const DEFAULT_REQUEST_CONNECT_ARGS: RequestConnectParams = {
  whitelist: [],
  host: DEFAULT_HOST,
};

export interface ProviderInterfaceVersions {
  provider: string;
  extension: string;
}

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  requestBalance(accountId?: number): Promise<bigint>;
  requestTransfer(params: RequestTransferParams): Promise<bigint>;
  requestConnect(params: RequestConnectParams): Promise<any>;
  createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>>;
  agent: Agent | null;
  createAgent(params: CreateAgentParams): Promise<boolean>;
  requestBurnXTC(params: RequestBurnXTCParams): Promise<any>;
  versions: ProviderInterfaceVersions;
}

const signFactory =
  (clientRPC) =>
  async (payload: ArrayBuffer): Promise<ArrayBuffer> => {
    const metadata = getDomainMetadata();
    console.log("PayloadInp", payload);
    const payloadArr = new Uint8Array(payload);
    console.log("PayloadArrInp", payloadArr);
    const res = await clientRPC.call("sign", [payloadArr, metadata], {
      timeout: 0,
      target: "",
    });
    return new Uint8Array(Object.values(res));
  };

export default class Provider implements ProviderInterface {
  public agent: Agent | null;
  public versions: ProviderInterfaceVersions;
  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;

  constructor(clientRPC: BrowserRPC) {
    this.clientRPC = clientRPC;
    this.clientRPC.start();
    this.agent = null;
    this.versions = versions;
  }

  public deleteAgent() {
    this.agent = null;
    return;
  }

  public async createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>> {
    if (!this.agent) throw Error("Oops! Agent initialization required.");

    return Actor.createActor(interfaceFactory, {
      agent: this.agent,
      canisterId,
    });
  }

  public async isConnected(): Promise<boolean> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call("isConnected", [metadata.url], {
      timeout: 0,
      target: "",
    });
  }

  public async requestConnect({
    whitelist = DEFAULT_REQUEST_CONNECT_ARGS.whitelist,
    host = DEFAULT_REQUEST_CONNECT_ARGS.host,
  }: RequestConnectParams = DEFAULT_REQUEST_CONNECT_ARGS): Promise<any> {
    const metadata = getDomainMetadata();

    const response = await this.clientRPC.call(
      "requestConnect",
      [metadata, whitelist],
      {
        timeout: 0,
        target: "",
      }
    );

    if (!whitelist || !Array.isArray(whitelist) || !whitelist.length)
      return response;

    const identity = new PlugIdentity(
      new Uint8Array(Object.values(response)),
      signFactory(this.clientRPC),
      whitelist
    );

    this.agent = new HttpAgent({
      identity,
      host,
    });

    return !!this.agent;
  }

  public async createAgent({
    whitelist = DEFAULT_REQUEST_CONNECT_ARGS.whitelist,
    host = DEFAULT_REQUEST_CONNECT_ARGS.host,
  }: CreateAgentParams = DEFAULT_REQUEST_CONNECT_ARGS): Promise<any> {
    const metadata = getDomainMetadata();

    const publicKey = await this.clientRPC.call(
      "verifyWhitelist",
      [metadata, whitelist],
      {
        timeout: 0,
        target: "",
      }
    );

    const identity = new PlugIdentity(
      new Uint8Array(Object.values(publicKey)),
      signFactory(this.clientRPC),
      whitelist
    );

    this.agent = new HttpAgent({
      identity,
      host,
    });

    return !!this.agent;
  }

  public async requestBalance(accountId = 0): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call("requestBalance", [metadata, accountId], {
      timeout: 0,
      target: "",
    });
  }

  public async requestTransfer(params: RequestTransferParams): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call("requestTransfer", [metadata, params], {
      timeout: 0,
      target: "",
    });
  }

  public async sign(payload: ArrayBuffer): Promise<ArrayBuffer> {
    const metadata = getDomainMetadata();
    console.log("PayloadInp", payload);
    const payloadArr = new Uint8Array(payload);
    console.log("PayloadArrInp", payloadArr);
    const res = await this.clientRPC.call("sign", [payloadArr, metadata], {
      timeout: 0,
      target: "",
    });
    return new Uint8Array(Object.values(res));
  }

  public async requestBurnXTC(params: RequestBurnXTCParams): Promise<any> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call("requestBurnXTC", [metadata, params], {
      timeout: 0,
      target: "",
    });
  }

  public async getManagementCanister() {
    if (!this.agent) {
      throw Error("Oops! Agent initialization required.");
    }

    return Actor.createActor(managementCanisterIdlFactory, {
      agent: this.agent,
      canisterId: managementCanisterPrincipal,
      ...{
        callTransform: transformOverrideHandler,
        queryTransform: transformOverrideHandler,
      },
    });
  }
}
