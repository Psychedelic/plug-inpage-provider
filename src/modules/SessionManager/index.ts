import { IC_MAINNET_URLS, PLUG_PROXY_HOST } from "../../constants";
import getDomainMetadata from "../../utils/domain-metadata";
import RPCManager from "../RPCManager";

import { RequestConnectParams, SerializedPublicKey } from "../../Provider/interfaces";
import { getAccountId } from "../../utils/account";
import { privateCreateAgent } from "../../utils/agent";
import { HttpAgent, PublicKey } from "@dfinity/agent";

type SessionData = { agent: HttpAgent, principalId: string, accountId: string } | null;
export type ConnectionData = {
  sessionData: SessionData,
  connection: RequestConnectParams & { publicKey: PublicKey }
};

interface SessionManagerOptions {
  rpc: RPCManager;
  whitelist?: string[];
  host?: string;
  timeout?: number;
}

export default class SessionManager {
  public host;
  public whitelist: string[];
  public timeout: number;
  private rpc: RPCManager;
  private sessionData: SessionData = null;
  private initialized: boolean = false;
  private onConnectionUpdate?: (data: ConnectionData) => any;

  constructor({ host, whitelist, timeout, rpc }: SessionManagerOptions) {
    this.host = host || IC_MAINNET_URLS[0];
    this.whitelist = whitelist || [];
    this.timeout = timeout || 120000;
    this.rpc = rpc;
  }

  public getSession(): SessionData {
    return this.sessionData;
  }

  private async createSession(publicKey: SerializedPublicKey): Promise<SessionData> {
    const agent = await privateCreateAgent({
      publicKey,
      clientRPC: this.rpc,
      whitelist: this.whitelist || [],
      host: this.host || PLUG_PROXY_HOST,
    });
    const principal = await agent.getPrincipal();
    const principalId = principal.toString();
    const accountId = await getAccountId(principal);

    this.sessionData = { agent, principalId, accountId };
    return this.sessionData;
  }

  public async init() {
    let connData: ConnectionData | null = null
    if (!this.initialized) {
      connData = await this.getConnectionData();
      this.initialized = true;
    }
    return connData;
  }

  // TODO: Optimize with local data once stable
  // Maybe something like return !!this.sessionData
  public async getConnectionData(): Promise<ConnectionData | null> {
    if (!this.initialized) return null;
    const metadata = getDomainMetadata();
    // Returns public key for now, see what we can do about connection data? 
    const connection =  await this.rpc.call({
      handler: "getConnectionData",
      args: [metadata.url],
    });
    let sessionData: SessionData = null;
    if (connection) {
      this.host = connection.host;
      this.whitelist = connection.whitelist;
      this.timeout = connection.timeout;
      sessionData = await this.createSession(connection.publicKey)
    }
    return { sessionData, connection };
  }

  public async requestConnect(args: RequestConnectParams = {}): Promise<ConnectionData> {
    const { whitelist = [], host = PLUG_PROXY_HOST, timeout = 120000 } = args;
    const metadata = getDomainMetadata();

    const publicKey = await this.rpc.call({
      handler: "requestConnect",
      args: [metadata, whitelist, timeout, host],
    });
    this.host = host;
    this.whitelist = whitelist;
    this.timeout = timeout;
    this.onConnectionUpdate = args?.onConnectionUpdate;
    const sessionData = await this.createSession(publicKey);
    return { sessionData, connection: { host, whitelist, timeout, publicKey } };
  }

  public async disconnect(): Promise<void> {
    const metadata = getDomainMetadata();

    await this.rpc.call({
      handler: "disconnect",
      args: [metadata.url, this.sessionData?.principalId],
    });
    this.sessionData = null;
  }

  public async updateConnection() {
    const data = await this.getConnectionData();
    if (data) {
      this.onConnectionUpdate?.(data);
    }
    return data;
  }

};
