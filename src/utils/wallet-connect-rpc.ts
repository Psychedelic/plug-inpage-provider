import WalletConnect from "@walletconnect/client";
import { isAndroid, formatIOSMobile } from "@walletconnect/browser-utils";
import { payloadId } from "@walletconnect/jsonrpc-utils";
import { HttpAgent } from "@dfinity/agent";

import {
  SIGN_METHODS,
  DEFAULT_TIMEOUT,
  WC_MOBILE_REGISTRY_ENTRY,
  IS_UNLOCK_METHOD,
  IS_ALL_WHITELISTED_METHOD,
} from "../constants/wallet-connect";

class WalletConnectRPC {
  wcClient: WalletConnect;
  wcBridgeURL = "https://bridge.walletconnect.org";
  window: any;
  focusUri: any;
  agent: HttpAgent | null = null;
  isAndroid: boolean = false;

  constructor(window) {
    this.isAndroid = isAndroid();
    this.wcClient = new WalletConnect({
      bridge: this.wcBridgeURL,
      signingMethods: SIGN_METHODS,
    });
    this.window = window;
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
          throw new Error(args[0]);
        case "requestCall":
          return this.requestCall(args, resolveAndClear, rejectAndClear);
        case "verifyWhitelist":
          return this.verifyWhitelist(args, resolveAndClear, rejectAndClear);
        default:
          return this._call(handler, args, resolveAndClear, rejectAndClear);
      }
    });
  }

  private _call(handler, args, resolve, reject) {
    this.wcClient
      .sendCustomRequest({
        method: IS_UNLOCK_METHOD,
      })
      .then((isUnlock) => {
        const requestId = payloadId();
        this.wcClient
          .sendCustomRequest({
            id: requestId,
            method: handler,
            params: args,
          })
          .then((response) => {
            resolve(response);
          })
          .catch((error) => {
            console.log("_call error", error);
            reject(error);
          });
        if (!isUnlock || SIGN_METHODS.includes(handler)) {
          this.window.location.href = `${this.focusUri}&requestId=${requestId}`;
        }
      })
      .catch((error) => {
        reject(error);
      });
  }

  private async requestConnect(args, resolve, _reject) {
    if (this.wcClient.connected) {
      await this.wcClient.killSession();
    }
    await this.wcClient.createSession();

    const href = !this.isAndroid
      ? formatIOSMobile(this.wcClient.uri, WC_MOBILE_REGISTRY_ENTRY)
      : this.wcClient.uri;
    this.focusUri = href.split("?")[0];

    this.wcClient.on("connect", (error, _payload) => {
      if (error) {
        throw error;
      }
      this.wcClient
        .sendCustomRequest({
          method: "requestConnect",
          params: args,
        })
        .then((response) => {
          resolve(response);
        });
    });

    this.window.location.href = href;
  }
  private async requestCall(args, resolve, reject) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_metadata, _args, batchTxId] = args;

    this.wcClient
      .sendCustomRequest({
        method: IS_UNLOCK_METHOD,
      })
      .then((isUnlock) => {
        const requestId = payloadId();
        this.wcClient
          .sendCustomRequest({
            id: requestId,
            method: "requestCall",
            params: args,
          })
          .then((response) => {
            resolve(response);
          })
          .catch((error) => {
            reject(error);
          });
        if (!batchTxId || !isUnlock) {
          this.window.location.href = `${this.focusUri}&requestId=${requestId}`;
        }
      });
  }

  private async verifyWhitelist(args, resolve, reject) {
    this.wcClient
      .sendCustomRequest({
        method: IS_UNLOCK_METHOD,
      })
      .then((isUnlock) => {
        const whitelistedRequestId = payloadId();
        this.wcClient
          .sendCustomRequest({
            id: whitelistedRequestId,
            method: IS_ALL_WHITELISTED_METHOD,
            params: args,
          })
          .then((allWhiteListed) => {
            const verifyRequestId = payloadId();
            this.wcClient
              .sendCustomRequest({
                id: verifyRequestId,
                method: "verifyWhitelist",
                params: args,
              })
              .then((response) => {
                resolve(response);
              })
              .catch((error) => {
                reject(error);
              });
            if (!allWhiteListed) {
              this.window.location.href = `${this.focusUri}&requestId=${verifyRequestId}`;
            }
          })
          .catch((error) => {
            reject(error);
          });
        if (!isUnlock) {
          this.window.location.href = `${this.focusUri}&requestId=${whitelistedRequestId}`;
        }
      })
      .catch((error) => {
        reject(error);
      });
  }
}

export default WalletConnectRPC;
