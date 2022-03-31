import BrowserRPC from "@fleekhq/browser-rpc/dist/BrowserRPC";
import { Agent, Actor, ActorSubclass } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

import getDomainMetadata from "../utils/domain-metadata";
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
} from "../utils/sign";
import { createActor, createAgent, CreateAgentParams } from "../utils/agent";
import { recursiveParseBigint } from "../utils/bigint";
import { CreateActor, ProviderInterface, ProviderInterfaceVersions, RequestBurnXTCParams, RequestConnectParams, RequestTransferParams, Transaction, TransactionPrevResponse } from "./interfaces";
import { getAccountId } from "../utils/account";


export default class Provider implements ProviderInterface {
  public agent?: Agent;
  public versions: ProviderInterfaceVersions;
  // @ts-ignore
  public principal: string;
  public accountId?: string;
  private clientRPC: BrowserRPC;
  private idls: ArgsTypesOfCanister = {};

  constructor(clientRPC: BrowserRPC) {
    this.clientRPC = clientRPC;
    this.clientRPC.start();
    this.versions = versions;
  }

  public async init() {
    const metadata = getDomainMetadata();
    const isConnected = await this.callClientRPC({
      handler: "isConnected",
      args: [metadata.url],
      config: {
        timeout: 0,
        target: "",
      },
    });
    if (isConnected) {
      this.agent = await createAgent(
        this.clientRPC,
        metadata,
        { whitelist: [] },
        this.idls
      );
      const principal = await this.agent.getPrincipal();
      this.principal = principal.toString();
      this.accountId = await getAccountId(principal);
    }
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
    this.agent = undefined;
    return;
  }

  public async createActor<T>({
    canisterId,
    interfaceFactory,
  }: CreateActor<T>): Promise<ActorSubclass<T>> {
    const metadata = getDomainMetadata();
    this.idls[canisterId] = getArgTypes(interfaceFactory);
    if (!this.agent) {
      this.agent = await createAgent(
        this.clientRPC,
        metadata,
        { whitelist: [canisterId] },
        this.idls
      );
    }
    return createActor<T>(this.agent, canisterId, interfaceFactory);
  }

  // Todo: Add whole getPrincipal flow on main plug repo in case this has been deleted.
  public async getPrincipal({ asString } = { asString: false }): Promise<Principal | string> {
    const metadata = getDomainMetadata();
    const principal = this.principal;
    if (principal) {
      return asString ? principal.toString() : Principal.from(principal);
    } else {
      const response = await this.callClientRPC({
        handler: "getPrincipal",
        args: [metadata.url],
        config: {
          timeout: 0,
          target: "",
        },
      });

      if (response && asString) {
        return response.toString();
      }

      return Principal.from(response);
    }
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

  public async disconnect(): Promise<void> {
    const metadata = getDomainMetadata();

    await this.callClientRPC({
      handler: "disconnect",
      args: [metadata.url],
      config: {
        timeout: 0,
        target: "",
      },
    });
  }

  public async requestConnect(args: RequestConnectParams = {}): Promise<any> {
    const { whitelist = [], host, timeout = 120000 } = args;
    const metadata = getDomainMetadata();

    const publicKey = await this.callClientRPC({
      handler: "requestConnect",
      args: [metadata, whitelist, timeout],
      config: {
        timeout: 0,
        target: "",
      },
    });

    this.agent = await createAgent(
      this.clientRPC,
      metadata,
      { whitelist, host },
      this.idls
      );
    const principal = await this.agent.getPrincipal();
    this.principal = principal.toString();
    this.accountId = await getAccountId(principal);
      
    return publicKey;
  }

  public async createAgent({
    whitelist,
    host,
  }: CreateAgentParams = {}): Promise<any> {
    const metadata = getDomainMetadata();

    this.agent = await createAgent(
      this.clientRPC,
      metadata,
      { whitelist, host },
      this.idls
    );

    return !!this.agent;
  }

  public async requestBalance(accountId = null): Promise<bigint> {
    const metadata = getDomainMetadata();

    const balances = await this.callClientRPC({
      handler: "requestBalance",
      args: [metadata, accountId],
      config: {
        timeout: 0,
        target: "",
      },
    });
    return balances.map(balance => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { value, ...rest } = balance;
      return rest;
    })
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

  public async batchTransactions(
    transactions: Transaction[]
  ): Promise<boolean> {
    const metadata = getDomainMetadata();

    const canisterList = transactions.map(
      (transaction) => transaction.canisterId
    );
    const agent = await createAgent(
      this.clientRPC,
      metadata,
      {
        whitelist: canisterList,
      },
      this.idls,
      true
    );

    const sender = (await agent.getPrincipal()).toString();

    const signInfo = transactions.map((trx) =>
      recursiveParseBigint(getSignInfoFromTransaction(trx, sender))
    );

    const batchAccepted = await this.callClientRPC({
      handler: "batchTransactions",
      args: [metadata, signInfo],
      config: {
        timeout: 0,
        target: "",
      },
    });

    if (!batchAccepted) return false;

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
