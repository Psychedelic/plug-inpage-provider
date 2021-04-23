# BrowserRPC

This library allows you exchange messages beetween BrowserRPC instances using window.postMessage API. You can call remote procedures as promises.

## Installing

Using npm:
```bash
$ npm install @fleekhq/browser-rpc
```

Using yarn
```bash
$ yarn add @fleekhq/browser-rpc
```


## Usage

RPC requires that you setup a client (who calls remote procedures and wait for responses) and a server (who process the calls and send back the responses).


Let's say that your client is going to be placed in your webpage and need to call a remote procedure method called `sum` that receives 2 arguments (2 number values to sum).

```js
import { BrowserRPC } from '@fleekhq/browser-rpc';

// Create a new rpc instance
// the name is the identidfier of this rpc instance. Name is injected as part of the call message to identify who is trying to call the method requested.
// the target is the name of the rpc server instance that should handle the request
const client = new BrowserRPC(window, {
  name: 'browser-client',
  target: 'rpc-server',
  timeout: 10000,
});

// Before calling any remote method, you have to start the rpc instance. This way, the rpc instance listen for the incoming responses
client.start();

// Now you can call the remote procedures using the "call" method. Take in mind that "call" method returns a promise that resolves to the response sent back by the rpc server or reejects with an error.
client
  .call('sum', [1, 2])
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.error(error);
  });


// Finally, if you don't need to execute more calls, you can stop the rpc client. This method removes the listeners, which means that any incoming response is not going to be catched by the client. If later you need to call another method, you have to "start" the client again.
client.stop();
```

We've already setup the client, now we have to setup the server. The server listen for methods calls, process the calls and send the responses back to the client. Take in mind that the server only process the calls coming from the `target` specified in the initial config object.
```js
import { BrowserRPC } from '@fleekhq/browser-rpc';

// Create a new rpc instance
// name property is injected as part of the responses messages to identify who processed the response
// target property specifies who can call methods on this new instance and receive the responses. If a different target try to call methods on this instance, the calls are ignored.
const server = new BrowserRPC(window, {
  name: 'rpc-server',
  target: 'browser-client',
});


/* In order to process the calls coming from the client, you have to expose "handlers".
Handlers are just functions that receive as first argument a callback and the rest of arguments are defined by you.
your handler function has to call the callback once the response is procesed or when an error ocurred. the callback receives as first argumeent an ErrorRes object (please refer to the ErrorRes Type section) type and as second the response (any).
To expose a new handler you have to call the "exposeHandler" method on your rpc instance and pass a string name (this is the identifier for your handler) and your handler function. You can add as many handlers as you want.
*/
server.exposeHandler('sum', (cb, val1, val2) => {
  const result = val1 + val2;

  cb(null, result);
});


// Finally, in order to start receiving incoming calls, you have to start your rpc instance.
// Same as the client, you can stop the server whenever you want.
server.start();
```


## API

For types info please refer to the `types.ts` file: `src/types.ts`

### New BrowserRPC instance:

```js
new BrowserRPC(window, config)
```

- `window`: the window object used by the instance to post messages and add the event listeners.
- `config`: [object] config required by the instance
  - `name`: [string] name of the instance. This name is injected in every message emitted by the instance to identify the caller.
  - `target`: [string] the name of the rpc instance that has to handle the call requests
  - `timeout?`: [number] timeout for call methods. 0 means no timeout. by default this value is 5000 ms
  - `handlers?` {[name: string]: Handler} object with handlers functions. object key is taken as the name identifier for the every handler function defined in the object


### BrowserRPC.start(): void
Add the event listeners required by the instance

### BrowserRPC.stop(): void
Remove the event listeners and rejects all the pending calls.

### BrowserRPC.exposeHandler(name: string, handler: Handler): void
Add a new handler to the instance

### BrowserRPC.removeHandler(name: string): boolean
Remove a handler by its name

### BrowserRPC.call(handler: string, args: any[], config?: CallConfigObject): Promise<any>
Call a new remote procedure method. Returns a promise resolving to the response or rejecting with an error.


## ErrorRes Type

Your handlers functions receive as first argument a callback function that has to be called with the response (second argument) or with an ErrorRes object as first argument if there is any error.

ErrorRes Type:
```typescript
export type ErrorRes = {
  code: number,
  message: string,
  data?: any,
};
```

This error type represents a JSON RPC error object. Please refer to the JSON RPC documentation to get information about error codes, message and data:

https://www.jsonrpc.org/specification#error_object
