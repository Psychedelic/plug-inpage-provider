import { Buffer } from "buffer/";

export const bufferToBase64 = (buf: Buffer): string => {
  return Buffer.from(buf).toString("base64");
};

export const base64ToBuffer = (base64: string): Buffer => {
  return Buffer.from(base64, "base64");
};
