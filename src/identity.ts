import {
  SignIdentity,
  PublicKey,
  ReadRequest,
  CallRequest,
} from "@dfinity/agent";
import { BinaryBlob, DerEncodedBlob } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

type RequestType = ReadRequest | CallRequest;

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
  constructor(publicKey: SerializedPublicKey, whitelist: string[]) {
    super();
    this.publicKey = {
      ...publicKey,
      toDer: () => publicKey.derKey?.data ?? publicKey.derKey,
    };
    this.whitelist = whitelist || [];
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
