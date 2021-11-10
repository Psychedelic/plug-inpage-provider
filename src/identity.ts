import {
  SignIdentity,
  PublicKey,
  HttpAgentRequest,
  ReadRequestType,
  ReadRequest,
  CallRequest,
  Signature,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { Secp256k1PublicKey } from '@dfinity/identity'
import { Buffer } from "buffer/";
import { SignInfo } from "./utils/sign";
import { requestIdOf } from "./utils/request_id";
import { fromArrayBufferToHex, fromHexToArrayBuffer, fromHexToUint8Array } from "./utils/buffer";

type SignCb = (
  payload: string,
  signInfo?: SignInfo
) => Promise<string>;

type RequestType = ReadRequest | CallRequest;

const domainSeparator = Buffer.from(new TextEncoder().encode("\x0Aic-request"));
export class PlugIdentity extends SignIdentity {
  private publicKey: PublicKey;
  private whitelist: string[];
  constructor(
    hexPublicRawKey: string,
    private signCb: SignCb,
    whitelist: string[]
  ) {
    super();
    this.publicKey = Secp256k1PublicKey.fromRaw(fromHexToUint8Array(hexPublicRawKey));
    this.signCb = signCb;
    this.whitelist = whitelist || [];
  }

  getPublicKey(): PublicKey {
    return this.publicKey;
  }

  async sign(blob: ArrayBuffer, signInfo?: RequestType): Promise<Signature> {
    const res = await this.signCb(fromArrayBufferToHex(blob), {
      sender: signInfo?.sender && Principal.from(signInfo.sender).toString(),
      methodName: signInfo?.method_name,
      requestType: signInfo?.request_type,
      canisterId:
        signInfo?.canister_id &&
        Principal.from(signInfo.canister_id).toString(),
      arguments: signInfo?.arg,
      manual: false,
    });
    return fromHexToArrayBuffer(res) as Signature;
  }

  getPrincipal(): Principal {
    if (!this._principal) {
      this._principal = Principal.selfAuthenticating(new Uint8Array(this.publicKey.toDer()));
    }
    return this._principal;
  }
  /**
   * Transform a request into a signed version of the request. This is done last
   * after the transforms on the body of a request. The returned object can be
   * anything, but must be serializable to CBOR.
   * @param request - internet computer request to transform
   */
  public async transformRequest(request: HttpAgentRequest): Promise<unknown> {
    const { body, ...fields } = request;

    const canister =
      body?.canister_id instanceof Principal
        ? body?.canister_id
        : Principal.fromUint8Array(body?.canister_id?._arr);

    if (
      body.request_type !== ReadRequestType.ReadState &&
      !this.whitelist.some((id) => id === canister.toString())
    ) {
      throw new Error(
        `Request failed:\n` +
          `  Code: 401\n` +
          `  Body: Plug Identity is not allowed to make requests to canister Id ${canister.toString()}`
      );
    }

    const requestId = await requestIdOf(body);
    const sender_sig = await this.sign(
      Buffer.concat([domainSeparator, requestId]),
      body
    );

    const transformedResponse = {
      ...fields,
      body: {
        content: body,
        sender_pubkey: this.getPublicKey().toDer(),
        sender_sig,
      },
    };
    return transformedResponse;
  }
}
