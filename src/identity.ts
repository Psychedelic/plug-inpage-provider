import { Buffer } from 'buffer/';
import { SignIdentity, PublicKey, BinaryBlob, DerEncodedBlob } from '@dfinity/agent';

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
    const ab = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
    const res = await this.signCb(ab);
    return Buffer.from(res) as BinaryBlob;
  }
}
