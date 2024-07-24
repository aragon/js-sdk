/* MARKDOWN
---
title: Getting Started
---

## Getting Started With the Aragon SDK

### Before You Begin

The Aragon OSx SDK is Javascript agnostic, which means you can use it with any Javascript framework, including popular ones like React, Vite, or Vue.

However, keep in mind that because server-side rendering is not supported yet for some crypto packages, you will not be able to use a framework like NextJS. Only frameworks that run entirely on client-side are supported.

Also know that all documentation within this site is done with Typescript. You can read more about [Typescript here](https://www.typescriptlang.org/).

### Installing the SDK

First thing you want to do is install the Aragon OSx SDK package into your product. You can do this by using `npm` or `yarn`.

```bash
npm install @aragon/sdk-client
```
or
```bash
yarn add @aragon/sdk-client
```

### Setting up the Context

Then, you'll want to set up the Aragon OSx SDK context within your application to have access to the SDK functions. You can do this at any point within your app.

However, so you're not setting it up multiple times, we recommend you set it up as a [context hook](https://www.freecodecamp.org/news/react-context-for-beginners/) within Javascript application if you're using a framework like React, Vue, or other, or within the entry file of your app.
*/

import { Wallet } from "@ethersproject/wallet";
import { Context, ContextParams } from "@aragon/sdk-client";
import { SupportedNetwork } from "@aragon/sdk-client-common";

// Set up your IPFS API key. You can get one either by running a local node or by using a service like Infura or Alechmy.
// Make sure to always keep these private in a file that is not committed to your public repository.
export const IPFS_API_KEY: string = "ipfs-api-key";

// OPTION A: The simplest ContextParams you can have is this. This uses our default values and should work perfectly within your product.
const minimalContextParams: ContextParams = {
  // Choose the network you want to use. You can use "goerli" (Ethereum) or "maticmum" (Polygon) for testing, or "mainnet" (Ethereum) and "polygon" (Polygon) for mainnet.
  network: SupportedNetwork.MAINNET,
  web3Providers: "https://eth.llamarpc.com",
  // This is the signer account who will be signing transactions for your app. You can use also use a specific account where you have funds, through passing it `new Wallet("your-wallets-private-key")` or pass it in dynamically when someone connects their wallet to your dApp.
  signer: Wallet.createRandom(),
};

// OPTION B: For a more advanced option, you can use the following ContextParams. This will allow you to use your own custom values if desired.
export const contextParams: ContextParams = {
  // Choose the network you want to use. You can use "goerli" (Ethereum) or "maticmum" (Mumbai) for testing, or "mainnet" (Ethereum) and "polygon" (Polygon) for mainnet.
  network: "goerli",
  // This is the account that will be signing transactions for your app. You can use also use a specific account where you have funds, through passing it `new Wallet("your-wallets-private-key")` or pass it in dynamically when someone connects their wallet to your dApp.
  signer: Wallet.createRandom(),
  // Optional on "rinkeby", "arbitrum-rinkeby" or "mumbai"
  // Pass the address of the  `DaoFactory` contract you want to use. You can find it here based on your chain of choice: https://github.com/aragon/core/blob/develop/active_contracts.json
  // Optional. Leave it empty to use Aragon's DAO Factory contract and claim a dao.eth subdomain
  daoFactoryAddress: "0x1234381072385710239847120734123847123",
  // Optional. Pass the address of the ensRegistry for networks other than Mainnet or Goerli.
  // It will default to the registry deployed by Aragon. You can check them here: https://github.com/aragon/osx/blob/develop/active_contracts.json
  ensRegistryAddress: "0x1234381072385710239847120734123847123",
  // Choose your Web3 provider: Cloudfare, Infura, Alchemy, etc.
  // Remember to change the list of providers if a different network is selected
  web3Providers: ["https://rpc.ankr.com/eth_goerli"],
  // Optional. By default, it will use Aragon's provided endpoints.
  // They will switch depending on the network (production, development)
  ipfsNodes: [
    {
      url: "https://test.ipfs.aragon.network/api/v0",
      headers: { "X-API-KEY": IPFS_API_KEY || "" },
    },
  ],
  // Optional. By default it will use Aragon's provided endpoints.
  // They will switch depending on the network (production, development)
  graphqlNodes: [
    {
      url: "https://subgraph.satsuma-prod.com/qHR2wGfc5RLi6/aragon/osx-goerli/api",
    },
  ],
};

// After defining the context parameters, you'll use them to instantiate the Aragon SDK context
export const context: Context = new Context(contextParams); // or minimalContextParams
// Instantiate the Aragon SDK context
export const minimalContext: Context = new Context(minimalContextParams);

/* MARKDOWN
Update the context with new parameters if you wish to throughout your app.
*/

context.set({ network: 1 });
context.set({ signer: new Wallet("private key") }); // if you're using wagmi library, you can also get the signer through their [`useSigner` method](https://wagmi.sh/react/hooks/useSigner) inside a `useEffect` hook.
context.set(contextParams);
