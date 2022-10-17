import WalletConnect from "@walletconnect/client";
import {
  isAndroid,
  formatIOSMobile,
  isIOS,
} from "@walletconnect/browser-utils";
import { payloadId } from "@walletconnect/jsonrpc-utils";
import { HttpAgent } from "@dfinity/agent";
import { Buffer } from "buffer/";

import {
  SIGN_METHODS,
  DEFAULT_TIMEOUT,
  WC_MOBILE_REGISTRY_ENTRY,
} from "../constants/wallet-connect";
import {
  SerializedPublicKey,
  SimplifiedRPC,
  WalletConnectOptions,
} from "../Provider/interfaces";
import SignerServer from "./signer-server";

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer as any;
}

class WalletConnectRPC implements SimplifiedRPC {
  wcClient: WalletConnect;
  wcBridgeURL = "https://bridge.walletconnect.org";
  window: any;
  focusUri: any;
  agent: HttpAgent | null = null;
  isAndroid: boolean = false;
  isApple: boolean = false;
  debug: boolean;
  whitelist: string[] = [];
  publicKey: SerializedPublicKey | null = null;

  constructor(walletConnectOptions: WalletConnectOptions) {
    const { window, debug = true } = walletConnectOptions;
    this.isAndroid = isAndroid();
    this.isApple = isIOS();
    this.window = window;
    this.debug = debug;

    this.debug && console.log("isAndroid", this.isAndroid);
    this.debug && console.log("isApple", this.isApple);

    this.wcClient = new WalletConnect({
      bridge: this.wcBridgeURL,
      signingMethods: SIGN_METHODS,
    });
  }

  public start() {}

  public call(handler, args, options = { timeout: DEFAULT_TIMEOUT }) {
    const timeout =
      typeof options.timeout === "number" ? options.timeout : DEFAULT_TIMEOUT;

    return new Promise((resolve, reject) => {
      const timeoutFun =
        timeout > 0
          ? setTimeout(() => {
              reject(new Error("Timeout"));
            }, timeout)
          : null;

      const resolveAndClear = (response) => {
        if (timeoutFun) clearTimeout(timeoutFun);
        resolve(response);
      };
      const rejectAndClear = (error) => {
        if (timeoutFun) clearTimeout(timeoutFun);
        reject(error);
      };

      switch (handler) {
        case "requestConnect":
          return this.requestConnect(args, resolveAndClear, rejectAndClear);
        case "handleError":
          throw new Error(args[1]);
        case "requestCall":
          return this.requestCall(args, resolveAndClear, rejectAndClear);
        case "requestQuery":
          return this.requestQuery(args, resolveAndClear, rejectAndClear);
        case "requestReadState":
          return this.requestReadState(args, resolveAndClear, rejectAndClear);
        case "verifyWhitelist":
          return this.verifyWhitelist(args, resolveAndClear, rejectAndClear);
        case "disconnect":
          return this.disconnect(args, resolveAndClear, rejectAndClear);
        case "batchTransactions":
          return this.batchTransactions(args, resolveAndClear, rejectAndClear);
        default:
          return this._call(handler, args, resolveAndClear, rejectAndClear);
      }
    });
  }

  public async resetSession() {
    await this.clearClient();
    await this.wcClient.createSession();
  }

  private _call(handler, args, resolve, reject) {
    const requestId = payloadId();
    if (SIGN_METHODS.includes(handler)) {
      this.window.location.href = `${this.focusUri}?requestId=${requestId}`;
    }

    this.debug && console.log("going to _calling", handler);
    this.wcClient
      .sendCustomRequest({
        id: requestId,
        method: handler,
        params: args,
      })
      .then((response) => {
        this.debug && console.log("_called", handler, response);
        resolve(response);
      })
      .catch((error) => {
        this.debug && console.log("_called error", handler, error);
        reject(error);
      });
  }

  private async requestConnect(args, resolve, reject) {
    const href = !this.isAndroid
      ? formatIOSMobile(this.wcClient.uri, WC_MOBILE_REGISTRY_ENTRY)
      : this.wcClient.uri;
    this.focusUri = href.split("?")[0];

    const requestId = payloadId();
    this.window.location.href = `${href}&requestId=${requestId}`;

    this.wcClient.on("disconnect", async (_error, payload) => {
      this.debug && console.log("on disconnect", payload);

      await this.clearClient();

      const [error] = payload.params;
      reject(error);
    });

    this.wcClient.on("connect", (error, payload) => {
      this.debug && console.log("on connect", payload);
      if (error) {
        reject(error);
      }

      this.wcClient
        .sendCustomRequest({
          id: requestId,
          method: "requestConnect",
          params: args,
        })
        .then((response) => {
          this.wcClient.off("disconnect");
          const { publicKey, whitelist } = response;
          this.addToWhiteList(whitelist);
          this.publicKey = publicKey;
          resolve(publicKey);
        })
        .catch((error) => {
          console.log("REQUEST CONNECT ERROR", error, error.message);
          this.clearClient().then(() => reject(error));
        });
    });
  }
  private async requestCall(args, resolve, reject) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_metadata, _args, batchTxId] = args;

    const requestId = payloadId();
    if (!batchTxId) {
      this.window.location.href = `${this.focusUri}?requestId=${requestId}`;
    }

    if (this.isApple && batchTxId) {
      this.debug && console.log("isApple requestCall by SignerServer");
      return SignerServer.requestCall(args, resolve, reject);
    }

    this.debug && console.log("requestingCall");
    this.wcClient
      .sendCustomRequest({
        id: requestId,
        method: "requestCall",
        params: args,
      })
      .then((response) => {
        this.debug && console.log("requestedCall", response);
        resolve(response);
      })
      .catch((error) => {
        this.debug && console.log("requestedCall", error);
        reject(error);
      });
  }

  private async requestQuery(args, resolve, reject) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_metadata, _args, batchTxId] = args;
    if (this.isApple && batchTxId) {
      this.debug && console.log("isApple requestQuery by SignerServer");
      return SignerServer.requestQuery(args, resolve, reject);
    }

    this._call("requestQuery", args, resolve, reject);
  }

  private async requestReadState(args, resolve, reject) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_metadata, _args, batchTxId] = args;
    if (this.isApple && batchTxId) {
      this.debug && console.log("isApple requestReadState by SignerServer");
      return SignerServer.requestReadState(args, resolve, reject);
    }

    this._call("requestReadState", args, resolve, reject);
  }

  private async verifyWhitelist(args, resolve, reject) {
    this.debug && console.log("going to verifyingWhitelist allWhitelisted");
    const allWhiteListed = this.isAllWhiteListed(args[1]);
    if (allWhiteListed) {
      resolve(this.publicKey);
      return;
    }

    const verifyRequestId = payloadId();
    this.window.location.href = `${this.focusUri}?requestId=${verifyRequestId}`;

    this.debug &&
    console.log("verifyingWhitelist allWhitelisted", allWhiteListed);

    this.debug && console.log("going to verifyingWhitelist");
    this.wcClient
      .sendCustomRequest({
        id: verifyRequestId,
        method: "verifyWhitelist",
        params: args,
      })
      .then((response) => {
        this.debug && console.log("verifyedWhitelist", response);
        const { publicKey, whitelist } = response;
        this.addToWhiteList(whitelist);
        this.publicKey = publicKey;
        resolve(publicKey);
      })
      .catch((error) => {
        this.debug && console.log("verifyedWhitelist error", error);
        reject(error);
      });
  }

  private async disconnect(args, resolve, reject) {
    await this.clearClient();

    this.wcClient
      .sendCustomRequest({
        method: "disconnect",
        params: args,
      })
      .then((res) => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  }

  private async clearClient() {
    this.wcClient.off("disconnect");
    this.wcClient.off("connect");
    if (this.wcClient.connected) {
      await this.wcClient.killSession();
    }

    this.wcClient = new WalletConnect({
      bridge: this.wcBridgeURL,
      signingMethods: SIGN_METHODS,
    });
  }

  private isAllWhiteListed(newWhiteList: string[]) {
    return newWhiteList.every((element) => this.whitelist.includes(element));
  }

  private addToWhiteList(newWhiteList: string[]) {
    newWhiteList.forEach((element) => {
      if (!this.whitelist.includes(element)) {
        this.whitelist.push(element);
      }
    });
  }

  private async batchTransactions(args, resolve, reject) {
    const requestId = payloadId();

    this.window.location.href = `${this.focusUri}?requestId=${requestId}`;

    this.wcClient.sendCustomRequest({
      id: requestId,
      method: "batchTransactions",
      params: args,
    }).then((response) => {
      this.debug && console.log("batchTransactions", response);
      const { whitelist, ...result } = response;
      this.addToWhiteList(whitelist);
      resolve(result);
    })
    .catch((error) => {
      this.debug && console.log("batchTransactions error", error);
      reject(error);
    });
  }
}

export default WalletConnectRPC;
