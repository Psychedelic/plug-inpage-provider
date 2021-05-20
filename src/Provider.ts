import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Actor, HttpAgent, Principal } from '@dfinity/agent';
import getDomainMetadata from './utils/domain-metadata';

export type ProxyDankCallback = <T extends Actor>(actor: T) => void;

export type WithDankProxy = <T extends Actor>(
  actor: T,
  callback: (actor: T) => void,
  cycles: number,
) => void;

export interface RequestConnectInput {
  canisters?: Principal[];
  timeout?: number;
};

export interface RequestCycleWithdrawal {
  canisterId: string;
  methodName: string;
  parameters: string;
  cycles: number;
}

export interface RequestOptions {
  cycles: number;
}

export interface DankProxyRequest {
  methodName: string;
  args: any[];
  options: RequestOptions;
}

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  principal: Principal;
  //withDankProxy(actor: string, methodName: string, args: object, options: RequestOptions): Promise<any>;
  //withDankProxy(actor: string, request: DankProxyRequest): Promise<any>;
  withDankProxy(actor: string, requests: DankProxyRequest[]): Promise<any>;
  requestConnect(input: RequestConnectInput): Promise<HttpAgent | null>;
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

    return this.clientRPC.call('isConnected', [metadata.url], {
      timeout: 0,
      target: "",
    });
  };

  // @ts-ignore
  public async requestConnect(input: RequestConnectInput): Promise<HttpAgent | null> {
    const metadata = getDomainMetadata();

    // i didnt understand what to do with canister ids here

    const response = await this.clientRPC.call('requestConnect', [metadata, input.timeout], {
      timeout: 0,
      target: "",
    });

    if (response) {
      return new HttpAgent();
    }

    return null;
  };

  public async requestCycleWithdrawal(requests: RequestCycleWithdrawal[]): Promise<any> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestCycleWithdrawal', [metadata, requests], {
      timeout: 0,
      target: "",
    });
  };

  public async withDankProxy(actor: string, requests: DankProxyRequest[]): Promise<any> {
    const metadata = getDomainMetadata();

    const proxyRequests = requests.map(r => ({
      canisterId: actor,
      methodName: r.methodName,
      args: r.args,
      options: r.options,
    }
    ));

    return await this.clientRPC.call('dankProxyRequest', [metadata, proxyRequests], {
      timeout: 0,
      target: "",
    });
  }
};
