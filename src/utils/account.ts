import CryptoJS from "crypto-js";
import { Principal } from "@dfinity/principal";
import { Buffer } from "buffer/";

import {
  byteArrayToWordArray,
  generateChecksum,
  wordArrayToByteArray,
} from "./crypto";

// Dfinity Account separator
const ACCOUNT_DOMAIN_SEPERATOR = "\x0Aaccount-id";

// Subaccounts are arbitrary 32-byte values.
const SUB_ACCOUNT_ZERO = Buffer.alloc(32);

/*
    Used dfinity/keysmith/account/account.go as a base for the ID generation
*/
export const getAccountId = (
  principal: Principal,
  subAccount?: number
): string => {
  const sha = CryptoJS.algo.SHA224.create();
  sha.update(ACCOUNT_DOMAIN_SEPERATOR); // Internally parsed with UTF-8, like go does
  sha.update(byteArrayToWordArray(principal.toUint8Array()));
  const subBuffer = Buffer.from(SUB_ACCOUNT_ZERO);
  if (subAccount) {
    subBuffer.writeUInt32BE(subAccount, 0);
  }
  sha.update(byteArrayToWordArray(subBuffer));
  const hash = sha.finalize();

  /// While this is backed by an array of length 28, it's canonical representation
  /// is a hex string of length 64. The first 8 characters are the CRC-32 encoded
  /// hash of the following 56 characters of hex. Both, upper and lower case
  /// characters are valid in the input string and can even be mixed.
  /// [ic/rs/rosetta-api/ledger_canister/src/account_identifier.rs]
  const byteArray = wordArrayToByteArray(hash, 28);
  const checksum = generateChecksum(new Uint8Array(byteArray));
  const val = checksum + hash.toString();

  return val;
};

export const PRINCIPAL_REGEX = /(\w{5}-){10}\w{3}/;
export const CANISTER_MAX_LENGTH = 27;
export const ALPHANUM_REGEX = /^[a-zA-Z0-9]+$/;

export const isValidPrincipal = (text: string): boolean =>
  Principal.fromText(text).toText() === text;

export const validatePrincipalId = (text: string): boolean => {
  try {
    return Boolean(PRINCIPAL_REGEX.test(text) && isValidPrincipal(text));
  } catch (e) {
    return false;
  }
};
export const validateAccountId = (text): boolean =>
  text.length === 64 && ALPHANUM_REGEX.test(text);
export const validateCanisterId = (text: string): boolean => {
  try {
    return Boolean(
      text.length <= CANISTER_MAX_LENGTH && isValidPrincipal(text)
    );
  } catch (e) {
    return false;
  }
};

export const validateToken = (metadata: any): boolean =>
  Boolean(!!metadata.decimal && !!metadata.name && !!metadata.symbol);
