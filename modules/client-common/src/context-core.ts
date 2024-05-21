import { JsonRpcProvider, Network, Networkish } from "@ethersproject/providers";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";
import { GraphQLClient } from "graphql-request";
import { isAddress } from "@ethersproject/address";
import { Signer } from "@ethersproject/abstract-signer";
import { ContextParams, ContextState, OverriddenState } from "./types";
import {
  getDefaultGraphqlNodes,
  getDefaultIpfsNodes,
  getNetwork,
} from "./utils";
import {
  InvalidAddressError,
  InvalidGasEstimationFactorError,
  UnsupportedNetworkError,
  UnsupportedProtocolError,
} from "./errors";
import {
  FrameworkContractsNames,
  getNetworkDeploymentForVersion,
  getNetworkNameByAlias,
  NonFrameworkContractsNames,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

const DEFAULT_GAS_FEE_ESTIMATION_FACTOR = 0.625;
const supportedProtocols = ["https:"];
const contractNames = [
  ...Object.values(FrameworkContractsNames),
  ...Object.values(NonFrameworkContractsNames),
] as (FrameworkContractsNames | NonFrameworkContractsNames)[];
if (typeof process !== "undefined" && process?.env?.TESTING) {
  supportedProtocols.push("http:");
}

export abstract class ContextCore {
  protected state: ContextState = {} as ContextState;

  protected overriden: OverriddenState = contractNames.reduce(
    (acc, key) => ({ ...acc, [key]: false }),
    { ENSRegistry: false } as OverriddenState,
  );
  // INTERNAL CONTEXT STATE
  /**
   * @param {Object} params
   *
   * @constructor
   */
  constructor(params?: Partial<ContextParams>) {
    // set network to mainnet, overrided by the value of params
    const mergedParams = Object.assign({ network: "mainnet" }, params);
    this.set(mergedParams);
  }

  set(contextParams: Partial<ContextParams>) {
    if (contextParams.network) {
      this.state.network = ContextCore.resolveNetwork(
        contextParams.network,
        contextParams.ENSRegistry,
      );
      // once the network is resolved set default values
      this.setNetworkDefaults();
    }
    if (contextParams.signer) {
      this.state.signer = contextParams.signer;
    }
    if (
      contextParams.web3Providers ||
      (Array.isArray(contextParams.web3Providers) &&
        contextParams.web3Providers.length)
    ) {
      this.state.web3Providers = ContextCore.resolveWeb3Providers(
        contextParams.web3Providers,
        this.state.network,
      );
    }
    if (contextParams.graphqlNodes?.length) {
      this.state.graphql = ContextCore.resolveGraphql(
        contextParams.graphqlNodes,
      );
      this.overriden.graphqlNodes = true;
    }
    if (contextParams.ipfsNodes?.length) {
      this.state.ipfs = ContextCore.resolveIpfs(contextParams.ipfsNodes);
      this.overriden.ipfsNodes = true;
    }
    // Set all the available addresses
    for (const address of contractNames) {
      if (contextParams[address]) {
        this.state[address] = contextParams[address]!;
        this.overriden[address] = true;
      }
    }

    if (contextParams.gasFeeEstimationFactor) {
      this.state.gasFeeEstimationFactor = ContextCore
        .resolveGasFeeEstimationFactor(
          contextParams.gasFeeEstimationFactor,
        );
      this.overriden.gasFeeEstimationFactor = true;
    }
  }

  private setNetworkDefaults() {
    // check network
    const networkName = getNetworkNameByAlias(this.network.name);
    if (!networkName) {
      throw new UnsupportedNetworkError(this.network.name);
    }
    // set graphql nodes
    if (!this.overriden.graphqlNodes) {
      this.state.graphql = ContextCore.resolveGraphql(
        getDefaultGraphqlNodes(networkName),
      );
    }
    // set ipfs nodes
    if (!this.overriden.ipfsNodes) {
      this.state.ipfs = ContextCore.resolveIpfs(
        getDefaultIpfsNodes(networkName),
      );
    }
    // set contract addresses
    for (const contractName of contractNames) {
      if (!this.overriden[contractName]) {
        let contractAddress: string | undefined;
        // get deployment
        let deployment = getNetworkDeploymentForVersion(
          networkName,
          SupportedVersions.V1_3_0,
        );
        // get address from deployment
        if (deployment) {
          contractAddress = deployment[contractName]?.address;
        }
        // custom check for ensRegistryAddress
        // set the ensRegistryAddress to the network.ensAddress
        if (
          contractName === NonFrameworkContractsNames.ENS_REGISTRY &&
          !contractAddress
        ) {
          contractAddress = this.network.ensAddress;
        }
        if (contractAddress) {
          this.state[contractName] = contractAddress;
        }
      }
    }

    if (!this.overriden.gasFeeEstimationFactor) {
      this.state.gasFeeEstimationFactor = DEFAULT_GAS_FEE_ESTIMATION_FACTOR;
    }
  }

  // GETTERS

  /**
   * Getter for the network
   *
   * @var network
   *
   * @returns {Networkish}
   *
   * @public
   */
  get network() {
    return this.state.network;
  }
  /**
   * Getter for the Signer
   *
   * @var signer
   *
   * @returns {Signer}
   *
   * @public
   */
  get signer(): Signer {
    return this.state.signer;
  }

  /**
   * Getter for the web3 providers
   *
   * @var web3Providers
   *
   * @returns {JsonRpcProvider[]}
   *
   * @public
   */
  get web3Providers(): JsonRpcProvider[] {
    return this.state.web3Providers || [];
  }

  /**
   * Getter for the gas fee reducer used in estimations
   *
   * @var gasFeeEstimationFactor
   *
   * @returns {number}
   *
   * @public
   */
  get gasFeeEstimationFactor(): number {
    return (
      this.state.gasFeeEstimationFactor
    );
  }

  /**
   * Getter for the IPFS http client
   *
   * @var ipfs
   *
   * @returns {IpfsClient[]}
   *
   * @public
   */
  get ipfs(): IpfsClient[] {
    return this.state.ipfs;
  }

  /**
   * Getter for the GraphQL client
   *
   * @var graphql
   *
   * @returns {GraphQLClient[]}
   *
   * @public
   */
  get graphql(): GraphQLClient[] {
    return this.state.graphql;
  }

  public getAddress(
    contractName: FrameworkContractsNames | NonFrameworkContractsNames,
  ): string | undefined {
    return this.state[contractName];
  }

  // INTERNAL HELPERS
  private static resolveNetwork(
    networkish: Networkish,
    ensRegistryAddress?: string,
  ): Network {
    const network = getNetwork(networkish);
    if (ensRegistryAddress) {
      if (!isAddress(ensRegistryAddress)) {
        throw new InvalidAddressError();
      } else {
        network.ensAddress = ensRegistryAddress;
      }
    }
    return network;
  }

  private static resolveWeb3Providers(
    endpoints: string | JsonRpcProvider | (string | JsonRpcProvider)[],
    network: Network,
  ): JsonRpcProvider[] {
    if (Array.isArray(endpoints)) {
      return endpoints.map((item) => {
        if (typeof item === "string") {
          const url = new URL(item);
          if (!supportedProtocols.includes(url.protocol)) {
            throw new UnsupportedProtocolError(url.protocol);
          }
          return new JsonRpcProvider(url.href, network);
        }
        return item;
      });
    } else if (typeof endpoints === "string") {
      const url = new URL(endpoints);
      if (!supportedProtocols.includes(url.protocol)) {
        throw new UnsupportedProtocolError(url.protocol);
      }
      return [new JsonRpcProvider(url.href, network)];
    } else {
      return [endpoints];
    }
  }

  private static resolveIpfs(
    configs: {
      url: string;
      headers?: Record<string, string>;
    }[],
  ): IpfsClient[] {
    let clients: IpfsClient[] = [];
    configs.forEach((config) => {
      const url = new URL(config.url);
      if (!supportedProtocols.includes(url.protocol)) {
        throw new UnsupportedProtocolError(url.protocol);
      }
      clients.push(new IpfsClient(url, config.headers));
    });
    return clients;
  }

  private static resolveGraphql(endpoints: { url: string }[]): GraphQLClient[] {
    let clients: GraphQLClient[] = [];
    endpoints.forEach((endpoint) => {
      const url = new URL(endpoint.url);
      if (!supportedProtocols.includes(url.protocol)) {
        throw new UnsupportedProtocolError(url.protocol);
      }
      clients.push(new GraphQLClient(url.href));
    });
    return clients;
  }

  private static resolveGasFeeEstimationFactor(
    gasFeeEstimationFactor: number,
  ): number {
    if (gasFeeEstimationFactor < 0 || gasFeeEstimationFactor > 1) {
      throw new InvalidGasEstimationFactorError();
    }
    return gasFeeEstimationFactor;
  }
}
