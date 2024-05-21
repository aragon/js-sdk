import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";
import { GraphQLClient } from "graphql-request";
import { ADDRESS_ONE } from "../integration/constants";
import {
  Context,
  ContextParams,
  getDefaultGraphqlNodes,
  getDefaultIpfsNodes,
} from "@aragon/sdk-client-common";
import {
  contracts,
  FrameworkContractsNames,
  NonFrameworkContractsNames,
  SupportedNetworks,
} from "@aragon/osx-commons-configs";

const TEST_WALLET =
  "8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb";
const web3endpoints = {
  working: [
    "https://mainnet.infura.io/v3/94d2e8caf1bc4c4884af830d96f927ca",
    "https://cloudflare-eth.com/",
  ],
  failing: ["https://bad-url-gateway.io/"],
};

let contextParams: ContextParams;

describe("Context instances", () => {
  beforeEach(() => {
    contextParams = {
      network: SupportedNetworks.MAINNET,
      signer: new Wallet(TEST_WALLET),
      DAOFactory: "0x1234",
      web3Providers: web3endpoints.working,
      gasFeeEstimationFactor: 0.1,
      graphqlNodes: [],
      ipfsNodes: [],
    };
  });
  it("Should create an empty context and have default values", () => {
    const context = new Context();
    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toBe("homestead");
    expect(context.network.chainId).toBe(1);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.mainnet["v1.3.0"]!.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      context.network.ensAddress,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(0);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.POLYGON).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.POLYGON).length,
    );
    context.web3Providers.map((provider) => {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });
    context.ipfs.map((ipfsClient) => {
      expect(ipfsClient).toBeInstanceOf(IpfsClient);
    });
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
  });
  it("Should create a context and have the correct values", () => {
    const context = new Context(contextParams);

    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toBe("homestead");
    expect(context.network.chainId).toBe(1);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contextParams.DAOFactory,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      context.network.ensAddress,
    );
    expect(context.gasFeeEstimationFactor).toBe(
      contextParams.gasFeeEstimationFactor,
    );
    context.web3Providers.map((provider) =>
      expect(provider).toBeInstanceOf(JsonRpcProvider)
    );
    context.ipfs.map((ipfsClient) =>
      expect(ipfsClient).toBeInstanceOf(IpfsClient)
    );
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
  });
  it("Should set a new context and have the correct values", () => {
    const context = new Context(contextParams);
    contextParams = {
      network: "goerli",
      signer: new Wallet(TEST_WALLET),
      DAOFactory: "0x2345",
      web3Providers: web3endpoints.working,
      gasFeeEstimationFactor: 0.1,
      ipfsNodes: [{ url: "https://localhost", headers: {} }],
      graphqlNodes: [{ url: "https://localhost" }],
    };
    context.set(contextParams);

    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toEqual("goerli");
    expect(context.network.chainId).toEqual(5);
    expect(context.signer).toBeInstanceOf(Wallet);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toEqual(
      "0x2345",
    );
    context.web3Providers?.map((provider) =>
      expect(provider).toBeInstanceOf(JsonRpcProvider)
    );
    context.ipfs?.map((ipfsClient) =>
      expect(ipfsClient).toBeInstanceOf(IpfsClient)
    );
    context.graphql?.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
    expect(context.gasFeeEstimationFactor).toEqual(0.1);
  });
  it("Should create a context in goerli, update the network and update all the parameters automatically", () => {
    const context = new Context({
      network: "goerli",
      web3Providers: "https://eth-goerli.g.alchemy.com/v2/demo",
    });
    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toBe("goerli");
    expect(context.network.chainId).toBe(5);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.goerli["v1.3.0"]!.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      context.network.ensAddress,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(1);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.POLYGON).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.POLYGON).length,
    );
    context.web3Providers.map((provider) => {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });
    context.ipfs.map((ipfsClient) => {
      expect(ipfsClient).toBeInstanceOf(IpfsClient);
    });
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
    context.set({
      network: "matic",
      web3Providers: "https://polygon-rpc.com/",
    });
    expect(context.network.name).toBe("matic");
    expect(context.network.chainId).toBe(137);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.polygon["v1.3.0"]!.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      contracts.polygon["v1.3.0"]?.ENSRegistry?.address,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(1);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.POLYGON).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.POLYGON).length,
    );
    context.web3Providers.map((provider) => {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });
    context.ipfs.map((ipfsClient) => {
      expect(ipfsClient).toBeInstanceOf(IpfsClient);
    });
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
  });
  it("Should create an empty context, update the network and update all the parameters automatically", () => {
    const context = new Context();
    expect(context).toBeInstanceOf(Context);
    context.set({
      network: "matic",
      web3Providers: "https://polygon-rpc.com/",
    });
    expect(context.network.name).toBe("matic");
    expect(context.network.chainId).toBe(137);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.polygon["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      contracts.polygon["v1.3.0"]?.ENSRegistry?.address,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(1);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.POLYGON).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.POLYGON).length,
    );
    context.web3Providers.map((provider) => {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });
    context.ipfs.map((ipfsClient) => {
      expect(ipfsClient).toBeInstanceOf(IpfsClient);
    });
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
  });
  it("Should Change the network and update all the parameters", () => {
    const context = new Context();
    context.set({
      ENSRegistry: ADDRESS_ONE,
      graphqlNodes: [
        {
          url: "https://example.com/1",
        },
        {
          url: "https://example.com/2",
        },
        {
          url: "https://example.com/3",
        },
      ],
    });
    // Make sure that the prvious propertis are not modified
    // with the networ change becaouse now they are on manual
    // mode
    context.set({ network: "matic" });
    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toBe("matic");
    expect(context.network.chainId).toBe(137);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.polygon["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      ADDRESS_ONE,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(0);
    expect(context.ipfs.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.POLYGON).length,
    );
    expect(context.graphql.length).toBe(3);
    context.web3Providers.map((provider) => {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });
    context.ipfs.map((ipfsClient) => {
      expect(ipfsClient).toBeInstanceOf(IpfsClient);
    });
    context.graphql.map((graphqlClient) =>
      expect(graphqlClient).toBeInstanceOf(GraphQLClient)
    );
  });
  it("Should create a context with invalid network and fail", () => {
    contextParams.network = "notexistingnetwork";

    expect(() => {
      new Context(contextParams);
    }).toThrow();
  });
  it("Should create a context with invalid gas fee estimation factor and fail", () => {
    contextParams.gasFeeEstimationFactor = 1.1;

    expect(() => {
      new Context(contextParams);
    }).toThrow();
  });
  it("Should create a context with the correct DAOFactory address from the core-contracts-package", () => {
    contextParams.DAOFactory = "";
    contextParams.network = "matic";
    const context = new Context(contextParams);

    expect(context).toBeInstanceOf(Context);
    expect(context.network.name).toEqual("matic");
    context.web3Providers?.map((provider) =>
      provider.getNetwork().then((nw) => {
        expect(nw.chainId).toEqual(137);
        expect(nw.name).toEqual("matic");
        expect(nw.ensAddress).toEqual(
          contracts.polygon["v1.3.0"]?.DAOFactory.address,
        );
      })
    );
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toEqual(
      contracts.polygon["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toEqual(
      contracts.polygon["v1.3.0"]?.ENSRegistry?.address,
    );
  });
});
