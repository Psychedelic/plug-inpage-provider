import { SignIdentity, PublicKey, BinaryBlob, DerEncodedBlob } from '@dfinity/agent';
import BrowserRPC from '@fleekhq/browser-rpc/dist/BrowserRPC';

export class PlugIdentity extends SignIdentity {
  private publicKey: DerEncodedBlob;
  private clientRPC: BrowserRPC;

  constructor(publicKey: DerEncodedBlob, clientRPC: BrowserRPC) {
    super();
    this.publicKey = publicKey;
    this.clientRPC = clientRPC;
  }

  getPublicKey(): PublicKey {
    return {
      toDer: () => this.publicKey,
    };
  }

  async sign(blob: BinaryBlob): Promise<BinaryBlob> {
    const result = await this.clientRPC.call('requestSignature', [blob], {
        timeout: 0,
        target: "",
      });

    return result as BinaryBlob;
  } 
} 