import { SignIdentity, PublicKey, BinaryBlob, DerEncodedBlob } from '@dfinity/agent';

type SignCb = (payload: ArrayBuffer) => Promise<ArrayBuffer>;

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
}
