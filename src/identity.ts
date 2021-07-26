import { SignIdentity, PublicKey, HttpAgentRequest, Cbor } from '@dfinity/agent';
import { BinaryBlob, blobFromBuffer, DerEncodedBlob } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import { Buffer } from 'buffer/';
import { requestIdOf } from './utils/request_id';

type SignCb = (payload: ArrayBuffer) => Promise<ArrayBuffer>;

const domainSeparator = Buffer.from(new TextEncoder().encode('\x0Aic-request'));
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
  private publicKey: PublicKey;
  constructor(publicKey: SerializedPublicKey, private signCb: SignCb) {
    super();
    this.publicKey = { ...publicKey, toDer: () => publicKey.derKey.data };
    this.signCb = signCb;
  }
  
  getPublicKey(): PublicKey {
    return this.publicKey;
  }

  async sign(blob: BinaryBlob): Promise<BinaryBlob> {
    const ab = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
    const res = await this.signCb(ab);
    return res as BinaryBlob;
  }

  getPrincipal(): Principal {
    if (!this._principal) {
      this._principal = Principal.selfAuthenticating(this.getPublicKey().toDer());
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
    const requestId = await requestIdOf(body);
    console.log('requestId', requestId.toString('hex'));
    const sender_sig = await this.sign(blobFromBuffer((Buffer as any).concat([domainSeparator, requestId]))) // ts-disable-line
    console.log('sender_sig', sender_sig.toString('hex'));
    const transformedResponse = {
      ...fields,
      body: {
        content: body,
        sender_pubkey: this.getPublicKey().toDer(),
        sender_sig
      },
    };
    console.log('transformed response', transformedResponse);
    console.log('encoded response', Cbor.encode(transformedResponse.body));
    return transformedResponse;
  }
}
