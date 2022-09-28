![](https://storageapi.fleek.co/fleek-team-bucket/plug-banner.png)

# Plug Inpage Provider
## Introduction

Plug's Inpage Provider is an Internet Computer Provider API package that is injected into the browser so that developers can call/interact with Plug.
Allowing for integration, authentication, and handling of in-app transactions.

## 🤔 Installation

The [Plug Inpage Provider](https://github.com/Psychedelic/plug-inpage-provider/pkgs/npm/plug-inpage-provider) package is in the [Github Package Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) and not in the [NPM Registry](https://www.npmjs.com/)!

This is important to note as we keep our projects under the [@Psychedelic organisation](https://github.com/psychedelic) on Github, our official channel for our projects.

```
yarn add @psychedelic/plug-inpage-provider
```

To pull and install the Plug Connect package from [@Psychedelic](https://github.com/psychedelic) via the NPM CLI, you'll need:

- A personal access token (you can create a personal acess token [here](https://github.com/settings/tokens))
- The personal access token with the correct scopes, **repo** and **read:packages** to be granted access to the [GitHub Package Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages).

- Authentication via `npm login`, using your Github email for the **username** and the **personal access token** as your **password**:

Once you have those ready, run:

```
npm login --registry=https://npm.pkg.github.com --scope=@Psychedelic
```

> **Note:** You only need to configure this once to install the package!
    On npm login provide your Github email as your username and the Personal access token as the password.

You can also setup your npm global settings to fetch from the Github registry everytime it finds a **@Psychdelic** package, find the instructions [here](https://docs.npmjs.com/configuring-your-registry-settings-as-an-npm-enterprise-user).

Create the `.npmrc` in the root of your project by:

```sh
touch .npmrc
```

Open the file and put the following content:

```sh
@psychedelic:registry=https://npm.pkg.github.com
```

You can now import the PlugConnect package:

```js
import Provider from '@psychedelic/plug-inpage-provider';
```
