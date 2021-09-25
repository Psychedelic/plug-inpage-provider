import {
  SignIdentity,
  PublicKey,
  HttpAgentRequest,
  ReadRequestType,
  Signature,
  DerEncodedPublicKey,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

import { Buffer } from "buffer/";
import { requestIdOf } from "./utils/request_id";
import { concat } from "./utils/buffer";

type SignCb = (payload: ArrayBuffer) => Promise<ArrayBuffer>;

const domainSeparator = Buffer.from(new TextEncoder().encode("\x0Aic-request"));
export class PlugIdentity extends SignIdentity {
  private publicKey: PublicKey;
  private whitelist: string[];
  constructor(
    derPublicKey: Uint8Array,
    private signCb: SignCb,
    whitelist: string[]
  ) {
    super();
    this.publicKey = {
      ...derPublicKey.buffer,
      toDer: () => derPublicKey.buffer as unknown as DerEncodedPublicKey,
    };
    this.signCb = signCb;
    this.whitelist = whitelist || [];
  }

  getPublicKey(): PublicKey {
    return this.publicKey;
  }

  async sign(blob: ArrayBuffer): Promise<Signature> {
    const res = await this.signCb(blob);
    return res as Signature;
  }

  getPrincipal(): Principal {
    if (!this._principal) {
      this._principal = Principal.selfAuthenticating(
        new Uint8Array(this.publicKey.toDer())
      );
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

    const transformedResponse = {
      ...fields,
      body: {
        content: body,
        sender_pubkey: this.getPublicKey().toDer(),
        sender_sig: await this.sign(concat(domainSeparator, requestId)),
      },
    };
    return transformedResponse;
  }
}
