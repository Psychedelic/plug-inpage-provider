import WalletConnect from "@walletconnect/client";
import { isAndroid, formatIOSMobile } from "@walletconnect/browser-utils";
import { payloadId } from "@walletconnect/jsonrpc-utils";
import { HttpAgent } from "@dfinity/agent";
import { Buffer } from "buffer/";

import {
  SIGN_METHODS,
  DEFAULT_TIMEOUT,
  WC_MOBILE_REGISTRY_ENTRY,
  IS_ALL_WHITELISTED_METHOD,
} from "../constants/wallet-connect";
import { SimplifiedRPC } from "../Provider/interfaces";

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
  debug: boolean;

  constructor(window: Window, debug = true) {
    this.isAndroid = isAndroid();
    this.wcClient = new WalletConnect({
      bridge: this.wcBridgeURL,
      signingMethods: SIGN_METHODS,
    });
    this.window = window;
    this.debug = debug;
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
        case "verifyWhitelist":
          return this.verifyWhitelist(args, resolveAndClear, rejectAndClear);
        default:
          return this._call(handler, args, resolveAndClear, rejectAndClear);
      }
    });
  }

  private _call(handler, args, resolve, reject) {
    this.debug && console.log("_calling isUnlock", handler);
    // this.debug && console.log("_called isUnlock", handler, isUnlock);
    const requestId = payloadId();
    this.debug && console.log("_calling", handler);
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
        this.debug && console.log("_called", handler, error);
        reject(error);
      });
    if (SIGN_METHODS.includes(handler)) {
      this.window.location.href = `${this.focusUri}?requestId=${requestId}`;
    }
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

    const requestId = payloadId();

    this.wcClient.on("connect", (error, _payload) => {
      if (error) {
        throw error;
      }
      this.wcClient
        .sendCustomRequest({
          id: requestId,
          method: "requestConnect",
          params: args,
        })
        .then((response) => {
          resolve(response);
        });
    });

    this.window.location.href = `${href}&requestId=${requestId}`;
  }
  private async requestCall(args, resolve, reject) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_metadata, _args, batchTxId] = args;
    this.debug && console.log("requestingCall isUnlock");
    // this.debug && console.log("requestedCall isUnlock", isUnlock);
    const requestId = payloadId();
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
    if (!batchTxId) {
      this.window.location.href = `${this.focusUri}?requestId=${requestId}`;
    }
  }

  private async verifyWhitelist(args, resolve, reject) {
    this.debug && console.log("verifyingWhitelist isUnlock");
    // this.debug && console.log("verifyedWhitelist isUnlock", isUnlock);
    const whitelistedRequestId = payloadId();
    this.debug && console.log("verifyingWhitelist allWhitelisted");
    this.wcClient
      .sendCustomRequest({
        id: whitelistedRequestId,
        method: IS_ALL_WHITELISTED_METHOD,
        params: args,
      })
      .then((allWhiteListed) => {
        this.debug &&
          console.log("verifyingWhitelist allWhitelisted", allWhiteListed);
        if (!allWhiteListed) {
          const verifyRequestId = payloadId();
          this.debug && console.log("verifyingWhitelist");
          this.wcClient
            .sendCustomRequest({
              id: verifyRequestId,
              method: "verifyWhitelist",
              params: args,
            })
            .then((response) => {
              this.debug && console.log("verifyedWhitelist", response);
              resolve(response);
            })
            .catch((error) => {
              this.debug && console.log("verifyedWhitelist", error);
              reject(error);
            });
          this.window.location.href = `${this.focusUri}?requestId=${verifyRequestId}`;
        } else {
          resolve(allWhiteListed);
        }
      })
      .catch((error) => {
        this.debug && console.log("verifyingWhitelist allWhitelisted", error);
        reject(error);
      });
  }
}

export default WalletConnectRPC;
