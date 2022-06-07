import {
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
  IDL,
} from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

import RPCManager from "../../modules/RPCManager";
import { recursiveParseBigint } from "../bigint";
import { base64ToBuffer, bufferToBase64 } from "../communication";
import getDomainMetadata from "../domain-metadata";

export const callMethodFactory =
  (clientRPC: RPCManager, batchTxId = "", idl: null | { [key: string]: any }) =>
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
    let decodedArgs = undefined;
    if (idl) {
      decodedArgs = recursiveParseBigint(IDL.decode(idl[options.methodName], options.arg));
    }
    const arg = bufferToBase64(
      Buffer.from(blobToUint8Array(options.arg).buffer)
    );

    const result = await clientRPC.call({
      handler: "requestCall",
      args: [
        metadata,
        {
          canisterId: canisterId.toString(),
          methodName: options.methodName,
          arg,
          effectiveCanisterId: options.effectiveCanisterId?.toString(),
        },
        batchTxId,
        decodedArgs,
      ],
    });

    if (result.error) throw result.error.message;

    return {
      ...result,
      requestId: blobFromUint8Array(
        new Uint8Array(base64ToBuffer(result.requestId))
      ),
    };
  };

export const queryMethodFactory =
  (clientRPC: RPCManager) =>
  async (
    canisterId: Principal | string,
    fields: QueryFields,
    identity?: Identity | Promise<Identity>
  ): Promise<QueryResponse> => {
    const result = await clientRPC.call({
      handler: "requestQuery",
      args: [
        {
          canisterId: canisterId.toString(),
          methodName: fields.methodName,
          arg: bufferToBase64(Buffer.from(blobToUint8Array(fields.arg).buffer)),
        },
      ],
    });

    if (result.error) throw result.error.message;

    return result.status === QueryResponseStatus.Replied
      ? {
          ...result,
          reply: {
            arg: blobFromUint8Array(
              new Uint8Array(base64ToBuffer(result.reply.arg))
            ),
          },
        }
      : {
          ...result,
        };
  };

export const readStateMethodFactory =
  (clientRPC: RPCManager) =>
  async (
    canisterId: Principal | string,
    fields: ReadStateOptions,
    identity?: Identity | Promise<Identity>
  ): Promise<ReadStateResponse> => {
    const paths = fields.paths[0].map((path) =>
      bufferToBase64(Buffer.from(blobToUint8Array(path).buffer))
    );

    try {
      const result = await clientRPC.call({
        handler: "requestReadState",
        args: [
          {
            canisterId: canisterId.toString(),
            paths,
          },
        ],
      });

      if (result.error) throw result.error.message;

      return {
        certificate: blobFromUint8Array(
          new Uint8Array(base64ToBuffer(result.certificate))
        ),
      };
    } catch (e) {
      throw e;
    }
  };
