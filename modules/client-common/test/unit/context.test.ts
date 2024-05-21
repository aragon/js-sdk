import { Wallet } from "@ethersproject/wallet";
import {
  ContextCore,
  ContextParams,
  getDefaultGraphqlNodes,
  getDefaultIpfsNodes,
} from "../../src";
import { ADDRESS_ONE, TEST_WALLET, web3endpoints } from "../constants";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";
import { JsonRpcProvider } from "@ethersproject/providers";
import { GraphQLClient } from "graphql-request";
import {
  contracts,
  FrameworkContractsNames,
  NonFrameworkContractsNames,
  SupportedNetworks,
} from "@aragon/osx-commons-configs";

class TestContext extends ContextCore {
  constructor(params?: Partial<ContextParams>) {
    super(params);
  }
}

let contextParams: ContextParams;

describe("Context instances", () => {
  beforeEach(() => {
    contextParams = {
      network: "mainnet",
      signer: new Wallet(TEST_WALLET),
      DAOFactory: "0x1234",
      web3Providers: web3endpoints.working,
      gasFeeEstimationFactor: 0.1,
      graphqlNodes: [],
      ipfsNodes: [],
    };
  });
  it("Should create an empty context and have default values", () => {
    const context = new TestContext();
    expect(context).toBeInstanceOf(TestContext);
    expect(context.network.name).toBe("homestead");
    expect(context.network.chainId).toBe(1);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.mainnet["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      context.network.ensAddress,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(0);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.MAINNET).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.MAINNET).length,
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
    const context = new TestContext(contextParams);

    expect(context).toBeInstanceOf(TestContext);
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
    const context = new TestContext(contextParams);
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

    expect(context).toBeInstanceOf(TestContext);
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
    const context = new TestContext({
      network: "goerli",
      web3Providers: "https://eth-goerli.g.alchemy.com/v2/demo",
    });
    expect(context).toBeInstanceOf(TestContext);
    expect(context.network.name).toBe("goerli");
    expect(context.network.chainId).toBe(5);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.goerli["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      context.network.ensAddress,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(1);
    expect(context.ipfs.length).toBe(
      getDefaultIpfsNodes(SupportedNetworks.GOERLI).length,
    );
    expect(context.graphql.length).toBe(
      getDefaultGraphqlNodes(SupportedNetworks.GOERLI).length,
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
  it("Should create an empty context, update the network and update all the parameters automatically", () => {
    const context = new TestContext();
    expect(context).toBeInstanceOf(TestContext);
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
    const context = new TestContext();
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
    expect(context).toBeInstanceOf(TestContext);
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
      getDefaultIpfsNodes(SupportedNetworks.POLYGON).length,
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
      new TestContext(contextParams);
    }).toThrow();
  });
  it("Should create a context with invalid gas fee estimation factor and fail", () => {
    contextParams.gasFeeEstimationFactor = 1.1;

    expect(() => {
      new TestContext(contextParams);
    }).toThrow();
  });
  it("Should create a context with the correct DAOFactory address from the core-contracts-package", () => {
    contextParams.DAOFactory = "";
    contextParams.network = "matic";
    contextParams.web3Providers = "https://polygon-rpc.com/";
    const context = new TestContext(contextParams);

    expect(context).toBeInstanceOf(TestContext);
    expect(context.network.name).toEqual("matic");
    context.web3Providers?.map((provider) =>
      provider.getNetwork().then((nw) => {
        expect(nw.chainId).toEqual(137);
        expect(nw.name).toEqual("matic");
        expect(nw.ensAddress).toEqual(
          contracts.polygon["v1.3.0"]?.ENSRegistry?.address,
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
  it("Should create a context with baseGoerli as network and have the correct values", () => {
    const contextParams = {
      network: "baseGoerli",
      web3Providers: "https://goerli.base.org",
    };
    const context = new TestContext(contextParams);
    expect(context).toBeInstanceOf(TestContext);
    expect(context.network.name).toBe("baseGoerli");
    expect(context.network.chainId).toBe(84531);
    expect(context.getAddress(FrameworkContractsNames.DAO_FACTORY)).toBe(
      contracts.baseGoerli["v1.3.0"]?.DAOFactory.address,
    );
    expect(context.getAddress(NonFrameworkContractsNames.ENS_REGISTRY)).toBe(
      contracts.baseGoerli["v1.3.0"]?.ENSRegistry?.address,
    );
    expect(context.gasFeeEstimationFactor).toBe(0.625);
    expect(context.web3Providers.length).toBe(1);
    for (const provider of context.web3Providers) {
      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect(provider.connection.url).toBe("https://goerli.base.org/");
      const nw = provider.network;
      expect(nw.chainId).toEqual(84531);
      expect(nw.name).toEqual("baseGoerli");
      expect(nw.ensAddress).toEqual(
        contracts.baseGoerli["v1.3.0"]?.ENSRegistry?.address,
      );
    }
  });
});
