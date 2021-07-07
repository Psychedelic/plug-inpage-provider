import { Buffer } from 'buffer/';
import { SignIdentity, PublicKey, BinaryBlob, DerEncodedBlob } from '@dfinity/agent';

type SignCb = (payload: ArrayBuffer) => Promise<ArrayBuffer>;

const extensionId = 'NEED_TO_SET_THIS';

const sendMessage = (args, callback) => {
  chrome.runtime.sendMessage(extensionId, args, (response) => {
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        parsedResponse = JSON.parse(response);
      } catch (error) {
        parsedResponse = response;
      }
    }
    callback(parsedResponse);
  });
};

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
    let res;
    sendMessage(ab, async (d)=> {
      res = await this.signCb(d);
    });
    return Buffer.from(res) as BinaryBlob;
  }
}
