import packageJSON from "../package.json";

export const PLUG_PROXY_HOST = 'https://mainnet.plugwallet.ooo/';
export const IC_MAINNET_URLS = ['https://mainnet.dfinity.network', 'ic0.app', PLUG_PROXY_HOST];

export const versions = {
  extension: "0.6.1.3",
  provider: packageJSON.version,
};
