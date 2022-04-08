import { IC_MAINNET_URLS, PLUG_PROXY_HOST } from "../../constants";
import getDomainMetadata from "../../utils/domain-metadata";
import RPCManager from "../RPCManager";

import { RequestConnectParams } from "../../Provider/interfaces";
import { getAccountId } from "../../utils/account";
import { privateCreateAgent } from "../../utils/agent";
import { HttpAgent, PublicKey } from "@dfinity/agent";

type SessionData = { agent: HttpAgent, principalId: string, accountId: string } | null;
type ConnectionData = {
  sessionData: SessionData,
  connection: RequestConnectParams & { publicKey?: PublicKey }
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
  private updating: boolean;

  constructor({ host, whitelist, timeout, rpc }: SessionManagerOptions) {
    this.host = host || IC_MAINNET_URLS[0];
    this.whitelist = whitelist || [];
    this.timeout = timeout || 120000;
    this.rpc = rpc;
    this.updating = false;
  }

  public getSession(): SessionData {
    return this.sessionData;
  }

  private async createSession(publicKey: PublicKey): Promise<SessionData> {
    const agent = await privateCreateAgent({
      publicKey,
      clientRPC: this.rpc,
      whitelist: this.whitelist || [],
      host: this.host || PLUG_PROXY_HOST,
      idls: {},
    });
    const principal = await agent.getPrincipal();
    const principalId = principal.toString();
    const accountId = await getAccountId(principal);

    this.sessionData = { agent, principalId, accountId };
    return this.sessionData;
  }

  // TODO: Optimize with local data once stable
  // Maybe something like return !!this.sessionData
  public async getConnectionData(): Promise<ConnectionData> {
    const metadata = getDomainMetadata();
    let sessionData: SessionData = null;
    let connection: ConnectionData['connection'] = {};
    if (!this.updating) {
      connection =  await this.rpc.call({
        handler: "getConnectionData",
        args: [metadata.url],
      });
      if (connection && connection.publicKey) {
        this.host = connection.host;
        this.whitelist = connection.whitelist || [];
        this.timeout = connection.timeout || 120000;
        sessionData = await this.createSession(connection.publicKey)
      }
    }
    return { sessionData, connection };
  }

  public async requestConnect(args: RequestConnectParams = {}): Promise<ConnectionData> {
    const { whitelist = [], host = PLUG_PROXY_HOST, timeout = 120000 } = args;
    const metadata = getDomainMetadata();

    const publicKey = await this.rpc.call({
      handler: "requestConnect",
      args: [metadata, whitelist, timeout],
    });
    this.host = host;
    this.whitelist = whitelist;
    this.timeout = timeout;
    const sessionData = await this.createSession(publicKey);
    return { sessionData, connection: { host, whitelist, timeout, publicKey } };
  }

  public async disconnect(): Promise<void> {
    const metadata = getDomainMetadata();

    await this.rpc.call({
      handler: "disconnect",
      args: [metadata.url],
    });
    this.sessionData = null;
  }

};
