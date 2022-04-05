import { HttpAgent, Actor, ActorSubclass } from "@dfinity/agent";
import { IC_MAINNET_URLS } from "../constants";

import { PlugIdentity } from "../identity";
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

export const privateCreateAgent = async ({ publicKey, clientRPC, idls, preApprove = false, whitelist = DEFAULT_CREATE_AGENT_ARGS.whitelist, host = DEFAULT_CREATE_AGENT_ARGS.host }) => {
  const identity = new PlugIdentity(
    publicKey,
    signFactory(clientRPC, idls, preApprove),
    whitelist
  );

  const agent = new HttpAgent({
    identity,
    host,
  });
  if (!IC_MAINNET_URLS.includes(host)) {
    await agent.fetchRootKey();
  }
  return agent;
}

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
  const publicKey = await clientRPC.call("verifyWhitelist", [metadata, whitelist], {
      timeout: 0,
      target: "",
    },
  );
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
