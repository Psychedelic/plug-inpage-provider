import { IDL, JsonValue } from "@dfinity/candid";
import { Buffer } from "buffer/";
import { Transaction } from "../Provider/interfaces";
import { recursiveParseBigint } from "./bigint";
import getDomainMetadata from "./domain-metadata";

export interface SignInfo {
  methodName?: string;
  requestType?: string;
  canisterId?: string;
  sender?: string;
  arguments?: Buffer;
  decodedArguments?: JsonValue;
}

export interface AssuredSignInfo {
  methodName: string;
  requestType: string;
  canisterId: string;
  sender: string;
  arguments: Buffer;
  decodedArguments?: JsonValue;
  preApprove: boolean;
}

export type ArgsTypesOfCanister = { [key: string]: { [key: string]: any } };

export const canDecodeArgs = (
  signInfo: SignInfo | undefined,
  argsTypes: ArgsTypesOfCanister
): boolean => {
  return !!(
    signInfo?.canisterId &&
    signInfo?.methodName &&
    signInfo?.arguments &&
    argsTypes[signInfo.canisterId]?.[signInfo.methodName]
  );
};

export const getSignInfoFromTransaction = (
  transaction: Transaction,
  sender: string
): AssuredSignInfo => {
  const interfaceFactory = transaction.idl({ IDL });
  const [methodName, func] = interfaceFactory?._fields?.find(
    ([methodName, _func]) => methodName === transaction.methodName
  ) || [undefined, undefined];
  const decodedArguments = Array.isArray(transaction.args)
    ? transaction.args
    : undefined;

  return {
    methodName: methodName || transaction.methodName,
    canisterId: transaction.canisterId,
    sender,
    arguments:
      decodedArguments && Array.isArray(transaction.args) && func
        ? IDL.encode(func.argTypes, transaction.args)
        : Buffer.from([]),
    decodedArguments,
    preApprove: false,
    requestType: "unknown",
  };
};

export const decodeArgs = (signInfo: SignInfo, argsTypes: ArgsTypesOfCanister) => {
  if (canDecodeArgs(signInfo, argsTypes)) {
    const assuredSignInfo = signInfo as AssuredSignInfo;
    const funArgumentsTypes =
      argsTypes[assuredSignInfo.canisterId][assuredSignInfo.methodName];
    return IDL.decode(funArgumentsTypes, assuredSignInfo.arguments);
  }
};

export const signFactory =
  (clientRPC, argsTypes: ArgsTypesOfCanister, preApprove: boolean = false) =>
  async (payload: ArrayBuffer, signInfo?: SignInfo): Promise<ArrayBuffer> => {
    const metadata = getDomainMetadata();
    const payloadArr = new Uint8Array(payload);

    if (signInfo)
      signInfo.decodedArguments = signInfo.arguments
        ? recursiveParseBigint(decodeArgs(signInfo, argsTypes))
        : [];

    const res = await clientRPC.call({
      handler: "requestSign",
      args: [payloadArr, metadata, { ...signInfo, preApprove }],
    });
    return new Uint8Array(Object.values(res));
  };

export const getArgTypes = (interfaceFactory: IDL.InterfaceFactory) => {
  const service = interfaceFactory({ IDL });
  const methodArgType: { [key: string]: any } = {};
  service._fields.forEach(
    ([methodName, fun]) => (methodArgType[methodName] = fun.argTypes)
  );
  return methodArgType;
};
