import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';
import { Actor, Principal, Agent, HttpAgent, DerEncodedBlob } from '@dfinity/agent';
import getDomainMetadata from './utils/domain-metadata';
import { PlugIdentity } from './identity';

export type ProxyDankCallback = <T extends Actor>(actor: T) => void;

export type WithDankProxy = <T extends Actor>(
  actor: T,
  cb: (actor: T) => void,
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

export interface ProviderInterface {
  isConnected(): Promise<boolean>;
  principal: Principal;
  agent: Agent;
  withDankProxy: WithDankProxy;
  requestConnect(): Promise<any>; // input: RequestConnectInput // should return Promise<Agent>
  requestCycleWithdrawal(requests: RequestCycleWithdrawal[]): Promise<any>;
};

export default class Provider implements ProviderInterface {
  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;
  public agent:Agent;

  constructor(clientRPC: BrowserRPC, publicKey: DerEncodedBlob) {
    this.clientRPC = clientRPC;

    const identity = new PlugIdentity(publicKey, clientRPC);

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

  public async requestCycleWithdrawal(requests: RequestCycleWithdrawal[]): Promise<any> {
    const metadata = getDomainMetadata();

    return await this.clientRPC.call('requestCycleWithdrawal', [metadata, requests], {
      timeout: 0,
      target: "",
    });
  };

  public withDankProxy<T extends Actor>(
    actor: T,
    cb: (actor: T) => void,
    cycles: number,
  ): void { }

  public test(name: string): Promise<any> {
    return this.clientRPC.call('test', [name]);
  }
};
