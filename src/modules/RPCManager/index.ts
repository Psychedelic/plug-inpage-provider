import BrowserRPC from "@fleekhq/browser-rpc";
import getDomainMetadata from "../../utils/domain-metadata";

const DEFAULT_CONFIG = {
  timeout: 0,
  target: "",
};

interface RPCManagerOptions {
  instance: BrowserRPC;
}
export default class RPCManager {
  private instance: BrowserRPC;
  constructor({ instance }: RPCManagerOptions) {
    this.instance = instance;
    this.instance.start();
  }

  public async call({ handler, args, config = DEFAULT_CONFIG }): Promise<any> {
    const metadata = getDomainMetadata();

    const handleCallSuccess = (result) => result;
    const handleCallFailure = async (error) => {
      const { message } = error || {};
      const errorHandler =
        message === "Request Timeout" ? "handleTimeout" : "handleError";
      return await this.instance.call(
        errorHandler,
        [metadata, message],
        DEFAULT_CONFIG
      );
    };
    return this.instance
      .call(handler, args, config)
      .then(handleCallSuccess, handleCallFailure);
  }
}
