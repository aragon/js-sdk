![Aragon](https://res.cloudinary.com/duvrxe0m9/image/upload/v1686656588/aragon-sdk_tjosse.png)

<p align="center">
  <a href="https://aragon.org/">Aragon website</a>
  •
  <a href="https://devs.aragon.org/">Developer Portal</a>
  •
  <a href="http://eepurl.com/icA7oj">Join our Developer Community</a>
  •
  <a href="https://aragonproject.typeform.com/dx-contribution">Contribute</a>
</p>

<br/>

# Aragon OSx SDK

Welcome to the Aragon OSx SDK!

The Aragon OSx SDK enables you to interact with the Aragon OSx product using
pure JavaScript (with Typescript support).

Whether you're a developer building a custom DAO or your own dApp, the Aragon
OSx SDK is your gateway to Aragon OSx' functionality. The Aragon OSx protocol is
a secure and modular DAO framework for building custom organizations on-chain.

Within this repository, you will find the following JS packages available
already on NPM for install:

- [Client](./modules/client): The package you'll be mostly interacting with. It
  is the package containing all functions querying the Aragon OSx subgraph to
  fetch information about DAOs and call on certain plugins to perform actions.
- [IPFS](./modules/ipfs): This package provides a wrapper to send requests to an
  IPFS Cluster using the IPFS API. It supports standard requests as well as
  streamed requests, and is used under the hood to send requests by the other
  packages.
- [Common](./modules/common): This package provides the general purpose
  components to use across the entire Aragon SDK like the shared `interfaces`,
  `constants`, etc.

<br/>

## Quick Start

The Aragon OSx SDK is Javascript agnostic, which means you can use it with any
Javascript framework, including popular ones like NodeJS, Deno, React, Vite, or
Vue. The examples in this README are written using NodeJS.

<br/>

### 1. Initialize a new project

If you do not already have a project to work with, create a new one with npm (or
your package manager of choice).

```sh
npm init
```

That will generate a package.json file for you to start running your Javascript
project. Optionally you can also enable typescript.

```sh
npx tsc --init
```

<br/>

### 2. Install the Aragon OSx SDK

Install the SDK and the ethers package. _**Note**_ Aragon SDK uses ethers
version5. Although version 6 may work, we suggest using the same version5 for
compatibility:

```sh
npm install @aragon/sdk-client ethers@5
```

<br/>

### 3. Create an entry file

Create a new file `index.ts` (or `index.js`) and import ethers and the SDK. This
is where we will setup the SDK and call its functions.

```typescript
import { Wallet } from "ethers";
import { Client, Context, ContextParams } from "@aragon/sdk-client";

const main = async () => {
  // This is where we will config the SDK in our next step
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

### 4. Configure the SDK

In order to set up the configuration for the Aragon SDK, we want to create a
"context" variable which will give us access to the web3 provider and signer
handling the SDK transactions. In this example, we are using a random wallet
since we are not sending any transactions. However this should ideally be the
connected wallet.

```typescript
const contextParams: ContextParams = {
  network: "mainnet",
  web3Providers: "https://rpc.ankr.com/eth",
  signer: Wallet.createRandom(),
  // Optional, but without it the client will not be able to resolve IPFS content
  ipfsNodes: [
    {
      url: "https://testing-ipfs-0.aragon.network/api/v0",
      headers: { "X-API-KEY": "b477RhECf8s8sdM7XrkLBs2wHc4kCMwpbcFC55Kt" },
    },
  ],
};

const context: Context = new Context(contextParams);
```

Next thing you'll want to do is set up the general purpose `Client` so you can
call on the general purpose SDK functions. These are things like `getDaos`,
`getDaoBalances`, etc. This client is used to interact with any DAO on the
network you're connected to.

```typescript
const client: Client = new Client(context);
```

<br/>

### 5. Using the SDK

In order to test our SDK set up works, we will try fetching information a
multisig DAO.

```typescript
console.log(await client.methods.getDao("aa.dao.eth"));
```

Our final code should look like this:

```typescript
import { Wallet } from "ethers";
import { Client, Context } from "@aragon/sdk-client";

const main = async () => {
  const contextParams: ContextParams = {
    network: "mainnet",
    web3Providers: "https://rpc.ankr.com/eth",
    signer: Wallet.createRandom(),
    // Optional, but without it the client will not be able to resolve IPFS content
    ipfsNodes: [
      {
        url: "https://testing-ipfs-0.aragon.network/api/v0",
        headers: { "X-API-KEY": "b477RhECf8s8sdM7XrkLBs2wHc4kCMwpbcFC55Kt" },
      },
    ],
  };

  const context: Context = new Context(contextParams);
  const client: Client = new Client(context);

  console.log(await client.methods.getDao("aa.dao.eth"));
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

In order to run the program and get the information details on the aa.dao.eth
DAO, go to the terminal and run:

```sh
node index.ts
```

```typescript
{
  address: '0xec10f0f223e52f2d939c7372b62ef2f55173282f',
  ensDomain: 'aa.dao.eth',
  metadata: {
    name: 'AA Multisig',
    description: 'This is Aragon Association budget vault on the new aragonOSx stack. ',
    avatar: 'ipfs://QmT8PDLFQDWaAUoKw4BYziWQNVKChJY3CGi5eNpECi7ufD',
    links: [ [Object] ]
  },
  creationDate: 2023-06-07T07:41:23.000Z,
  plugins: [
    {
      instanceAddress: '0xa2dee0b38d2cfadeb52f2b5a738b5ea7e037dce9',
      id: 'multisig.plugin.dao.eth',
      release: 1,
      build: 1
    }
  ]
}
```

> For additional information on the SDK capabilities, make sure you check out
> [Aragon's Developer Portal](https://devs.aragon.org) for more information.

<br/>

## Available scripts

- `yarn build`
  - Compiles all the modules, respecting their internal dependencies
- `yarn clean`
  - Removes the existing artifacts
- `yarn lint`
  - Checks the current code for inconsistencies
- `yarn test`
  - Runs the test suite on all modules

<br/>

## Development

Run `yarn build` to compile the individual packages. Run `yarn test` on them.

<br/>

## Automatic publishing

### With labels

To automatically publish the new version on pull request merge, the relevant labels:
| Label Name | Component getting published | NPM package name |
| --- | --- | --- |
| client-release | `modules/client/` | `@aragon/sdk-client` |
| ipfs-release | `modules/ipfs/` | `@aragon/sdk-ipfs` |
| common-release | `modules/common/` | `@aragon/sdk-common` |

### With tags

To publish a new version of a subpackage create a new git tag following this
schema:\
`VERSION-LANGUAGE-PACKAGE_FOLDER_NAME`

- Example to publish a new version of the javascript client module:
  `0.0.1-javascript-client`.
- To publish an alpha version just put `-alpha` behind the semver:
  `0.0.1-alpha-javascript-client`

#### Important:

**Do not run 2 workflows at the same time, otherwise we could encounter a race
condition in the git repo which could lead to a failure of the automatic
changelog and package.json update**

## Security

If you believe you've found a security issue, we encourage you to notify us. We welcome working with you to resolve the issue promptly.

Security Contact Email: sirt@aragon.org

Please do not use the issue tracker for security issues.
