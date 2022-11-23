import {
  HttpAgent,
  Actor,
  ActorSubclass,
  HttpAgentOptions,
} from "@dfinity/agent";

import { IC_MAINNET_URLS } from "../constants";

import { PlugIdentity } from "../identity";
import RPCManager from "../modules/RPCManager";
import { SerializedPublicKey } from "../Provider/interfaces";
import {
  queryMethodFactory,
  callMethodFactory,
  readStateMethodFactory,
} from "./factories/agent";

export interface CreateAgentParams {
  whitelist?: string[];
  host?: string;
}

interface CreateAgentParamsFixed {
  whitelist: string[];
  host: string;
}

const DEFAULT_HOST = IC_MAINNET_URLS[0];
/* eslint-disable @typescript-eslint/no-unused-vars */
const DEFAULT_CREATE_AGENT_ARGS: CreateAgentParamsFixed = {
  whitelist: [],
  host: DEFAULT_HOST,
};

class PlugAgent extends HttpAgent {
  constructor(
    options: HttpAgentOptions = {},
    clientRPC: RPCManager,
    idl: { [key: string]: any } | null,
    batchTxId = ""
  ) {
    super(options);

    this["query"] = queryMethodFactory(clientRPC, batchTxId);
    this["call"] = callMethodFactory(clientRPC, batchTxId, idl);
    this["readState"] = readStateMethodFactory(clientRPC, batchTxId);
  }
}

interface PrivateCreateAgentParams {
  publicKey: SerializedPublicKey;
  clientRPC: any;
  idl?: { [key: string]: any } | null;
  batchTxId?: string;
  whitelist?: Array<string>;
  host?: string;
}

export const privateCreateAgent = async ({
  publicKey,
  clientRPC,
  idl = null,
  batchTxId = "",
  whitelist = DEFAULT_CREATE_AGENT_ARGS.whitelist,
  host = DEFAULT_CREATE_AGENT_ARGS.host,
}: PrivateCreateAgentParams) => {
  const identity = new PlugIdentity(publicKey, whitelist);

  const agent = new PlugAgent(
    {
      identity,
      host,
    },
    clientRPC,
    idl,
    batchTxId
  );
  if (!IC_MAINNET_URLS.includes(host)) {
    await agent.fetchRootKey();
  }
  return agent;
};

export const createAgent = async (
  clientRPC,
  {
    whitelist = DEFAULT_CREATE_AGENT_ARGS.whitelist,
    host = DEFAULT_CREATE_AGENT_ARGS.host,
  }: CreateAgentParams,
  idl: { [key: string]: any } | null = null,
  batchTxId = ""
) => {
  const publicKey = await clientRPC.call({
    handler: "verifyWhitelist",
    args: [whitelist],
  });
  const agent = await privateCreateAgent({
    publicKey,
    clientRPC,
    idl,
    batchTxId,
    whitelist,
    host,
  });
  return agent;
};

export const createActor = async <T>(
  agent,
  canisterId,
  interfaceFactory
): Promise<ActorSubclass<T>> => {
  return Actor.createActor(interfaceFactory, {
    agent: agent,
    canisterId,
  });
};
