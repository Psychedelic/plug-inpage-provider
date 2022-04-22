import {
  HttpAgent,
  Actor,
  ActorSubclass,
  HttpAgentOptions,
  QueryFields,
  Identity,
  QueryResponse,
  QueryResponseStatus,
  SubmitResponse,
  ReadStateOptions,
  ReadStateResponse,
} from "@dfinity/agent";
import {
  BinaryBlob,
  blobFromUint8Array,
  blobToUint8Array,
} from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import { IC_MAINNET_URLS } from "../constants";

import { PlugIdentity } from "../identity";
import RPCManager from "../modules/RPCManager";
import { base64ToBuffer, bufferToBase64 } from "./communication";
import getDomainMetadata from "./domain-metadata";
import { signFactory } from "./sign";

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

const callMethodFactory =
  (clientRPC: RPCManager) =>
  async (
    canisterId: Principal | string,
    options: {
      methodName: string;
      arg: BinaryBlob;
      effectiveCanisterId?: Principal | string;
    },
    identity?: Identity | Promise<Identity>
  ): Promise<SubmitResponse> => {
    const metadata = getDomainMetadata();

    const canisterIdStr =
      typeof canisterId === "string" ? canisterId : canisterId.toString();
    const effectiveCanisterIdStr =
      typeof options.effectiveCanisterId === "string"
        ? options.effectiveCanisterId
        : options.effectiveCanisterId?.toString();
    const result = await clientRPC.call({
      handler: "requestCall",
      args: [
        metadata,
        {
          canisterId: canisterIdStr,
          methodName: options.methodName,
          arg: bufferToBase64(
            Buffer.from(blobToUint8Array(options.arg).buffer)
          ),
          effectiveCanisterId: effectiveCanisterIdStr,
        },
      ],
    });
    if (result.error) throw result.error.message;

    return {
      ...result.response,
      requestId: blobFromUint8Array(
        new Uint8Array(base64ToBuffer(result.response.requestId))
      ),
    };
  };

const queryMethodFactory =
  (clientRPC: RPCManager) =>
  async (
    canisterId: Principal | string,
    fields: QueryFields,
    identity?: Identity | Promise<Identity>
  ): Promise<QueryResponse> => {
    const canisterIdStr =
      typeof canisterId === "string" ? canisterId : canisterId.toString();
    const result = await clientRPC.call({
      handler: "requestQuery",
      args: {
        canisterId: canisterIdStr,
        methodName: fields.methodName,
        arg: bufferToBase64(Buffer.from(blobToUint8Array(fields.arg).buffer)),
      },
    });
    if (result.error) throw result.error.message;

    return result.response.status === QueryResponseStatus.Replied
      ? {
          status: QueryResponseStatus.Replied,
          reply: {
            arg: blobFromUint8Array(
              new Uint8Array(base64ToBuffer(result.response.status))
            ),
          },
        }
      : {
          ...result.response,
          status: QueryResponseStatus.Rejected,
        };
  };

const readStateMethodFactory =
  (clientRPC: RPCManager) =>
  async (
    canisterId: Principal | string,
    fields: ReadStateOptions,
    identity?: Identity | Promise<Identity>
  ): Promise<ReadStateResponse> => {
    const canisterIdStr =
      typeof canisterId === "string" ? canisterId : canisterId.toString();
    const result = await clientRPC.call({
      handler: "requestReadState",
      args: {
        canisterId: canisterIdStr,
        paths: fields.paths[0].map((path) =>
          bufferToBase64(Buffer.from(blobToUint8Array(path).buffer))
        ),
      },
    });
    if (result.error) throw result.error.message;

    return {
      certificate: blobFromUint8Array(
        new Uint8Array(base64ToBuffer(result.response.status))
      ),
    };
  };

class PlugAgent extends HttpAgent {
  constructor(options: HttpAgentOptions = {}, clientRPC: RPCManager) {
    super(options);

    this["query"] = queryMethodFactory(clientRPC);
    this["call"] = callMethodFactory(clientRPC);
    this["readState"] = readStateMethodFactory(clientRPC);
  }
}

export const privateCreateAgent = async ({
  publicKey,
  clientRPC,
  idls,
  preApprove = false,
  whitelist = DEFAULT_CREATE_AGENT_ARGS.whitelist,
  host = DEFAULT_CREATE_AGENT_ARGS.host,
}) => {
  const identity = new PlugIdentity(
    publicKey,
    signFactory(clientRPC, idls, preApprove),
    whitelist
  );

  const agent = new PlugAgent(
    {
      identity,
      host,
    },
    clientRPC
  );
  if (!IC_MAINNET_URLS.includes(host)) {
    await agent.fetchRootKey();
  }
  return agent;
};

export const createAgent = async (
  clientRPC,
  metadata,
  {
    whitelist = DEFAULT_CREATE_AGENT_ARGS.whitelist,
    host = DEFAULT_CREATE_AGENT_ARGS.host,
  }: CreateAgentParams,
  idls,
  preApprove = false
) => {
  const publicKey = await clientRPC.call({ handler: "verifyWhitelist", args: [metadata, whitelist] });
  const agent = await privateCreateAgent({ publicKey, clientRPC, idls, preApprove, whitelist, host });
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
