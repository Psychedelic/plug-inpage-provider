const SIGNER_SERVER_URL = "https://signer-server.plugwallet.ooo";

const requestCall = async (args, resolve, reject) => {
  const response = await fetch(`${SIGNER_SERVER_URL}/call`, {
    method: "POST",
    body: JSON.stringify(args),
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
  const body = await response.json();
  if ("result" in body) return resolve(body.result);

  return reject(body.error);
};

const requestQuery = async (args, resolve, reject) => {
  const response = await fetch(`${SIGNER_SERVER_URL}/query`, {
    method: "POST",
    body: JSON.stringify(args),
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
  const body = await response.json();
  if ("result" in body) return resolve(body.result);

  return reject(body.error);
};

const requestReadState = async (args, resolve, reject) => {
  const response = await fetch(`${SIGNER_SERVER_URL}/readState`, {
    method: "POST",
    body: JSON.stringify(args),
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
  const body = await response.json();
  if ("result" in body) return resolve(body.result);

  return reject(body.error);
};

export default {
  requestCall,
  requestQuery,
  requestReadState,
};
