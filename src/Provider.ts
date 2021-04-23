import { BrowserRPC } from '@fleekhq/browser-rpc';
import { Actor, Principal, Agent } from '@dfinity/agent';

export type ProxyDankCallback = <T extends Actor>(actor: T) => void;

export type WithDankProxy = <T extends Actor>(
  actor: T,
  cb: (actor: T) => void,
  cycles: number,
) => void;

export interface RequestConnectInput {
  canisters: Principal[];
  timeout?: number;
};

export interface ProviderInterface {
  isConnected: boolean;
  principal: Principal;
  withDankProxy: WithDankProxy;
  requestConnet(input: RequestConnectInput): Promise<Agent>;
};

export default class Provider implements ProviderInterface {
  public isConnected = false;
  // @ts-ignore
  public principal: Principal;
  private clientRPC: BrowserRPC;

  constructor(clientRPC: BrowserRPC) {
    this.clientRPC = clientRPC;
  }

  // @ts-ignore
  public requestConnet(input: RequestConnectInput): Promise<Agent> {}

  public withDankProxy<T extends Actor>(
    actor: T,
    cb: (actor: T) => void,
    cycles: number,
  ): void {}

  public test(name: string): Promise<any> {
    return this.clientRPC.call('test', [name]);
  }
};

