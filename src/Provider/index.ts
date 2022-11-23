import { Agent, Actor, ActorSubclass, PublicKey } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { Buffer } from "buffer/";
import { BinaryBlob } from "@dfinity/candid";


import {
  managementCanisterIdlFactory,
  managementCanisterPrincipal,
  transformOverrideHandler,
} from "../utils/ic-management-api";
import { versions } from "../constants";
import {
  getArgTypes,
  ArgsTypesOfCanister,
  getSignInfoFromTransaction,
  parseMessageToString,
} from "../utils/sign";
import { createActor, createAgent, CreateAgentParams } from "../utils/agent";
import { recursiveParseBigint } from "../utils/bigint";
import {
  CreateActor,
  ICNSInfo,
  ProviderInterface,
  ProviderInterfaceVersions,
  RequestBurnXTCParams,
  RequestConnectParams,
  RequestImportTokenParams,
  RequestTransferParams,
  SimplifiedRPC,
  Transaction,
  TransactionPrevResponse,
  WalletConnectOptions,
} from "./interfaces";
import RPCManager from "../modules/RPCManager";
import SessionManager from "../modules/SessionManager";
import { validateCanisterId } from "../utils/account";
import { bufferToBase64 } from "../utils/communication";
import WalletConnectRPC from "../utils/wallet-connect-rpc";

export default class Provider implements ProviderInterface {
  public agent?: Agent;
  public versions: ProviderInterfaceVersions;
  // @ts-ignore
  public principalId?: string;
  public accountId?: string;
  private clientRPC: RPCManager;
  private sessionManager: SessionManager;
  private idls: ArgsTypesOfCanister = {};

  static createWithWalletConnect(
    walletConnectOptions: WalletConnectOptions
  ): Provider {
    const walletConnectRPC = new WalletConnectRPC(walletConnectOptions);
    walletConnectRPC.resetSession();
    return new Provider(walletConnectRPC);
  }

  static exposeProviderWithWalletConnect(
    walletConnectOptions: WalletConnectOptions
  ) {
    const provider = this.createWithWalletConnect(walletConnectOptions);

    const ic = (window as any).ic || {};
    (window as any).ic = {
      ...ic,
      plug: provider,
    };
  }

  constructor(clientRPC: SimplifiedRPC) {
    this.clientRPC = new RPCManager({ instance: clientRPC });
    this.sessionManager = new SessionManager({ rpc: this.clientRPC });
    this.versions = versions;
  }

  public async init() {
    const connectionData = await this.sessionManager.init();
    const { sessionData } = connectionData || {};
    if (sessionData) {
      this.agent = sessionData?.agent;
      this.principalId = sessionData?.principalId;
      this.accountId = sessionData?.accountId;
    }
    this.hookToWindowEvents();
  }

  public async createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>> {
    if (!canisterId || !validateCanisterId(canisterId))
      throw Error("a canisterId valid is a required argument");
    if (!interfaceFactory)
      throw Error("interfaceFactory is a required argument");
    this.idls[canisterId] = getArgTypes(interfaceFactory);
    const connectionData = await this.sessionManager.getConnectionData();
    const agent = await createAgent(
      this.clientRPC,
      { whitelist: [canisterId], host: connectionData?.connection?.host },
      getArgTypes(interfaceFactory)
    );
    return createActor<T>(agent, canisterId, interfaceFactory);
  }

  // Todo: Add whole getPrincipal flow on main plug repo in case this has been deleted.
  public async getPrincipal(
    { asString } = { asString: false }
  ): Promise<Principal | string> {
    const principal = this.principalId;
    if (principal) {
      return asString ? principal.toString() : Principal.from(principal);
    } else {
      const response = await this.clientRPC.call({
        handler: "getPrincipal",
        args: [],
      });

      if (response && asString) {
        return response.toString();
      }

      return Principal.from(response);
    }
  }

  // Session management
  public async isConnected(): Promise<boolean> {
    const connectionData = await this.sessionManager.getConnectionData();
    const { connection } = connectionData || {};
    return !!connection;
  }

  public async disconnect(): Promise<void> {
    await this.sessionManager.disconnect();
  }

  public async requestConnect(
    args: RequestConnectParams = {}
  ): Promise<PublicKey> {
    const { sessionData, connection } =
      await this.sessionManager.requestConnect(args);
    if (sessionData) {
      this.agent = sessionData?.agent;
      this.principalId = sessionData?.principalId;
      this.accountId = sessionData?.accountId;
    }
    return connection?.publicKey;
  }

  public async createAgent({
    whitelist,
    host,
  }: CreateAgentParams = {}): Promise<any> {

    this.agent = await createAgent(
      this.clientRPC,
      { whitelist, host },
      null
    );

    return !!this.agent;
  }

  public async requestBalance(accountId = null): Promise<bigint> {

    const balances = await this.clientRPC.call({
      handler: "requestBalance",
      args: [accountId],
    });
    return balances.map((balance) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { value, ...rest } = balance;
      return rest;
    });
  }

  public async requestTransfer(params: RequestTransferParams): Promise<bigint> {

    return await this.clientRPC.call({
      handler: "requestTransfer",
      args: [params],
    });
  }

  // public async requestTransferToken(
  //   params: RequestTransTokenferParams
  // ): Promise<string> {

  //   return await this.clientRPC.call({
  //     handler: "requestTransferToken",
  //     args: [metadata, params],
  //   });
  // }

  public async batchTransactions(
    transactions: Transaction[]
  ): Promise<boolean> {

    const canisterList = transactions.map(
      (transaction) => transaction.canisterId
    );
    const connectionData = await this.sessionManager.getConnectionData();

    const sender = (await this.getPrincipal({ asString: true })) as string;

    const signInfo = transactions
      .map((trx) => getSignInfoFromTransaction(trx, sender))
      .map((trx) =>
        recursiveParseBigint({
          ...trx,
          arguments: bufferToBase64(Buffer.from(trx.arguments)),
        })
      );

    const batchResponse = await this.clientRPC.call({
      handler: "batchTransactions",
      args: [signInfo],
    });

    if (!batchResponse.status) return false;

    const agent = await createAgent(
      this.clientRPC,
      {
        whitelist: canisterList,
        host: connectionData?.connection?.host,
      },
      null,
      batchResponse.txId
    );

    let transactionIndex = 0;
    let prevTransactionsData: TransactionPrevResponse[] = [];

    for await (const transaction of transactions) {
      const actor = await createActor(
        agent,
        transaction.canisterId,
        transaction.idl
      );
      const method = actor[transaction.methodName];
      try {
        let response: any;

        if (typeof transaction.args === "function") {
          if (prevTransactionsData) {
            response = await method(...transaction.args(prevTransactionsData));
          }

          if (!prevTransactionsData) {
            response = await method(...transaction.args());
          }
        } else if (Array.isArray(transaction.args)) {
          response = await method(...(transaction.args as unknown[]));
        } else {
          await transaction?.onFail(
            "Invalid transaction arguments, must be function or array",
            prevTransactionsData
          );
          break;
        }

        if (transaction?.onSuccess) {
          const chainedResponse = await transaction?.onSuccess(response);
          if (chainedResponse) {
            prevTransactionsData = [
              ...prevTransactionsData,
              { transactionIndex, response: chainedResponse },
            ];
          }
        }
      } catch (error) {
        if (transaction?.onFail) {
          await transaction.onFail(error, prevTransactionsData);
        }
        break;
      }
      transactionIndex++;
    }

    return true;
  }

  public async getICNSInfo(): Promise<ICNSInfo> {

    return await this.clientRPC.call({
      handler: "getICNSInfo",
      args: [],
    });
  }

  public async requestBurnXTC(params: RequestBurnXTCParams): Promise<any> {

    return await this.clientRPC.call({
      handler: "requestBurnXTC",
      args: [params],
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

  public async requestImportToken(
    params: RequestImportTokenParams
  ): Promise<any> {

    return await this.clientRPC.call({
      handler: "requestImportToken",
      args: [params],
    });
  }

  private hookToWindowEvents = () => {
    window.addEventListener(
      "updateConnection",
      async () => {
        const connectionData = await this.sessionManager.updateConnection();
        const { sessionData } = connectionData || {};
        if (sessionData) {
          this.agent = sessionData?.agent;
          this.principalId = sessionData?.principalId;
          this.accountId = sessionData?.accountId;
        }
      },
      false
    );
  };

  public async signMessage(message: BinaryBlob | Buffer | ArrayBuffer): Promise<BinaryBlob> {
    const messageToSign = parseMessageToString(message);
    const response = await this.clientRPC.call({
      handler: "requestSignMessage",
      args: [messageToSign],
    });
    console.log(response)
    return response;

  }
}
