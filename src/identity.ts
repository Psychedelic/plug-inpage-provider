import { SignIdentity, PublicKey, BinaryBlob, DerEncodedBlob } from '@dfinity/agent';
import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';

type SignCb = (payload: ArrayBuffer) => Promise<ArrayBuffer>;

export class PlugIdentity extends SignIdentity {
  constructor(private publicKey: DerEncodedBlob, private signCb: SignCb) {
    super();
  }

  getPublicKey(): PublicKey {
    return {
      toDer: () => this.publicKey,
    };
  }

  async sign(blob: BinaryBlob): Promise<BinaryBlob> {
    // TODO perform the conversion from ArrayBuffer.
  }
}
