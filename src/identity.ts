import {
  SignIdentity,
  PublicKey,
  HttpAgentRequest,
  ReadRequestType,
  ReadRequest,
  CallRequest,
} from "@dfinity/agent";
import { BinaryBlob, blobFromBuffer, DerEncodedBlob } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import { Buffer } from "buffer/";
import { SignInfo } from "./utils/sign";
import { requestIdOf } from "./utils/request_id";

type SignCb = (
  payload: ArrayBuffer,
  signInfo?: SignInfo
) => Promise<ArrayBuffer>;

type RequestType = ReadRequest | CallRequest;

const domainSeparator = Buffer.from(new TextEncoder().encode("\x0Aic-request"));
interface SerializedPublicKey {
  rawKey: {
    type: string;
    data: Uint8Array;
  };
  derKey: {
    type: string;
    data: DerEncodedBlob;
  };
}

const transformRequestFactory =
  (signCb: SignCb, whitelist: string[], publicKey: PublicKey) =>
  async (request: HttpAgentRequest): Promise<unknown> => {
    const { body, ...fields } = request;

    const canister =
      body?.canister_id instanceof Principal
        ? body?.canister_id
        : Principal.fromUint8Array(body?.canister_id?._arr);

    if (
      body.request_type !== ReadRequestType.ReadState &&
      !whitelist.some((id) => id === canister.toString())
    ) {
      throw new Error(
        `Request failed:\n` +
          `  Code: 401\n` +
          `  Body: Plug Identity is not allowed to make requests to canister Id ${canister.toString()}`
      );
    }

    const requestId = await requestIdOf(body);
    const sender_sig = await signCb(
      blobFromBuffer(Buffer.concat([domainSeparator, requestId])),
      {
        sender: body?.sender && Principal.from(body.sender).toString(),
        methodName: body?.method_name,
        requestType: body?.request_type,
        canisterId:
          body?.canister_id && Principal.from(body.canister_id).toString(),
        arguments: body?.arg,
      }
    );

    const transformedResponse = {
      ...fields,
      body: {
        content: body,
        sender_pubkey: publicKey.toDer(),
        sender_sig,
      },
    };
    return transformedResponse;
  };
export class PlugIdentity extends SignIdentity {
  /**
   * Transform a request into a signed version of the request. This is done last
   * after the transforms on the body of a request. The returned object can be
   * anything, but must be serializable to CBOR.
   * @param request - internet computer request to transform
   */
  public transformRequest;
  private publicKey: PublicKey;
  private whitelist: string[];
  constructor(
    publicKey: SerializedPublicKey,
    signCb: SignCb,
    whitelist: string[]
  ) {
    super();
    this.publicKey = {
      ...publicKey,
      toDer: () => publicKey.derKey?.data ?? publicKey.derKey,
    };
    this.whitelist = whitelist || [];
    this.transformRequest = transformRequestFactory(
      signCb,
      this.whitelist,
      this.publicKey
    );
  }

  getPublicKey(): PublicKey {
    return this.publicKey;
  }

  async sign(_blob: BinaryBlob, _signInfo?: RequestType): Promise<BinaryBlob> {
    throw "DONT USE SIGN FROM IDENTITY";
  }

  getPrincipal(): Principal {
    if (!this._principal) {
      this._principal = Principal.selfAuthenticating(this.publicKey.toDer());
    }
    return this._principal;
  }
}
