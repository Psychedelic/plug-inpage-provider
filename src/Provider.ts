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
export interface SignInfo {
  methodName?: string;
  requestType?: string;
  canisterId?: string;
  sender?: string;
  manual: boolean;
}

const signFactory =
  (clientRPC) =>
  async (payload: ArrayBuffer, signInfo?: SignInfo): Promise<ArrayBuffer> => {
    const metadata = getDomainMetadata();
    const payloadArr = new Uint8Array(payload);
    const res = await clientRPC.call(
      "requestSign",
      [payloadArr, metadata, signInfo],
      {
        timeout: 0,
        target: "",
      }
    );
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

  private async callClientRPC({ handler, args, config }): Promise<any> {
    const metadata = getDomainMetadata();

    const handleCallSuccess = (result) => {
      return result;
    };

    const handleCallFailure = async (error) => {
      const params = error.message;

      if (error.message === "Request Timeout") {
        return await this.clientRPC.call("handleTimeout", [metadata, params], {
          timeout: 0,
          target: "",
        });
      }

      return await this.clientRPC.call("handleError", [metadata, params], {
        timeout: 0,
        target: "",
      });
    };

    return this.clientRPC
      .call(handler, args, config)
      .then(handleCallSuccess, handleCallFailure);
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

    return await this.callClientRPC({
      handler: "isConnected",
      args: [metadata.url],
      config: {
        timeout: 0,
        target: "",
      },
    });
  }

  public async requestConnect({
    whitelist = DEFAULT_REQUEST_CONNECT_ARGS.whitelist,
    host = DEFAULT_REQUEST_CONNECT_ARGS.host,
  }: RequestConnectParams = DEFAULT_REQUEST_CONNECT_ARGS): Promise<any> {
    const metadata = getDomainMetadata();

    const response = await this.callClientRPC({
      handler: "requestConnect",
      args: [metadata, whitelist],
      config: {
        timeout: 0,
        target: "",
      },
    });

    if (!whitelist || !Array.isArray(whitelist) || !whitelist.length)
      return response;

    const identity = new PlugIdentity(
      response,
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

    const publicKey = await this.callClientRPC({
      handler: "verifyWhitelist",
      args: [metadata, whitelist],
      config: {
        timeout: 0,
        target: "",
      },
    });

    const identity = new PlugIdentity(
      publicKey,
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

    return await this.callClientRPC({
      handler: "requestBalance",
      args: [metadata, accountId],
      config: {
        timeout: 0,
        target: "",
      },
    });
  }

  public async requestTransfer(params: RequestTransferParams): Promise<bigint> {
    const metadata = getDomainMetadata();

    return await this.callClientRPC({
      handler: "requestTransfer",
      args: [metadata, params],
      config: {
        timeout: 0,
        target: "",
      },
    });
  }

  public async requestBurnXTC(params: RequestBurnXTCParams): Promise<any> {
    const metadata = getDomainMetadata();

    return await this.callClientRPC({
      handler: "requestBurnXTC",
      args: [metadata, params],
      config: {
        timeout: 0,
        target: "",
      },
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
