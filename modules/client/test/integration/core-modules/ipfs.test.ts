// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";

import { Wallet } from "@ethersproject/wallet";
import { Client } from "../../../src";
import { Context, ContextParams } from "@aragon/sdk-client-common";
const IPFS_API_KEY = process.env.IPFS_API_KEY ||
  Buffer.from(
    "YjQ3N1JoRUNmOHM4c2RNN1hya0xCczJ3SGM0a0NNd3BiY0ZDNTVLdCAg==",
    "base64",
  ).toString().trim();

const web3endpoints = {
  working: [
    "https://mainnet.infura.io/v3/94d2e8caf1bc4c4884af830d96f927ca",
    "https://cloudflare-eth.com/",
  ],
  failing: ["https://bad-url-gateway.io/"],
};

const TEST_WALLET =
  "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e";

const contextParamsMainnet: ContextParams = {
  network: "mainnet",
  signer: new Wallet(TEST_WALLET),
  DAOFactory: `0x${'0123456789'.repeat(4)}`,
  web3Providers: web3endpoints.working,
  ipfsNodes: [
    {
      url: "https://example.com",
    },
    {
      url: "https://example.com",
    },
  ],
  graphqlNodes: [{
    url:
      "https://subgraph.satsuma-prod.com/0141525010d2/aragon/osx-sepolia/version/1.4.3/api",
  }],
};

// store cat implementation for when it gets overwritten
const catImplementation = mockedIPFSClient.cat.getMockImplementation();

describe("IPFS core module", () => {
  it("Should have an API token to test the proxy", () => {
    expect(IPFS_API_KEY.length).toBeGreaterThan(0);
  });
  it("Should connect to a IPFS node and upload a string and recover the same string", async () => {
    const context = new Context(contextParamsMainnet);
    const client = new Client(context);
    const originalStr = "I am a test";
    mockedIPFSClient.add.mockResolvedValueOnce(new Error());
    mockedIPFSClient.cat.mockImplementation(async () =>
      Buffer.from(originalStr)
    );
    const cid = await client.ipfs.add(originalStr);
    const recoveredString = await client.ipfs.fetchString(cid);
    const recoveredBytes = await client.ipfs.fetchBytes(cid);
    const decodedString = new TextDecoder().decode(recoveredBytes);

    expect(typeof recoveredBytes).toBe("object");
    expect(typeof recoveredString).toBe("string");
    expect(typeof decodedString).toBe("string");
    expect(recoveredString).toEqual(originalStr);
    expect(decodedString).toEqual(originalStr);
    // restore cat implementation
    mockedIPFSClient.cat.mockImplementation(catImplementation);
  });
  it("Should connect to a IPFS node, upload bytes and recover the same string", async () => {
    const context = new Context(contextParamsMainnet);
    const client = new Client(context);
    const originalBytes = new Uint8Array([
      72,
      101,
      108,
      108,
      111,
      32,
      84,
      104,
      101,
      114,
      101,
      32,
      58,
      41,
    ]);
    mockedIPFSClient.add.mockResolvedValueOnce(new Error());
    mockedIPFSClient.cat.mockImplementation(async () => originalBytes);
    const cid = await client.ipfs.add(originalBytes);
    const recoveredString = await client.ipfs.fetchString(cid);
    const recoveredBytes = await client.ipfs.fetchBytes(cid);
    const decodedString = new TextDecoder().decode(recoveredBytes);

    expect(typeof recoveredBytes).toBe("object");
    expect(typeof recoveredString).toBe("string");
    expect(typeof decodedString).toBe("string");
    expect(recoveredString).toEqual("Hello There :)");
    expect(decodedString).toEqual("Hello There :)");
    // restore cat implementation
    mockedIPFSClient.cat.mockImplementation(catImplementation);
  });
  it("Should work when an IPFS node is functional", async () => {
    const context = new Context(contextParamsMainnet);
    const client = new Client(context);
    const isOnline = await client.ipfs.isUp();

    expect(isOnline).toEqual(true);
  });
  it("Should fail when an IPFS node is not working", async () => {
    const context = new Context(contextParamsMainnet);
    const client = new Client(context);

    mockedIPFSClient.nodeInfo.mockRejectedValueOnce(new Error());
    const isOnline = await client.ipfs.isUp();

    expect(isOnline).toEqual(false);
  });
});
