import { Signer } from "@ethersproject/abstract-signer";
import { JsonRpcProvider, Network, Networkish } from "@ethersproject/providers";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";
import { GraphQLClient } from "graphql-request";
import {
  FrameworkContractsNames,
  NonFrameworkContractsNames,
} from "@aragon/osx-commons-configs";

export type Web3ContextParams =
  & {
    [index in FrameworkContractsNames]?: string;
  }
  & {
    [index in NonFrameworkContractsNames]?: string;
  }
  & {
    /** Defaults to mainnet */
    network?: Networkish;
    /** Required for Ethereum transactions to work */
    signer?: Signer;
    /** Required for Ethereum connectivity to work */
    web3Providers?: string | JsonRpcProvider | (string | JsonRpcProvider)[];
    gasFeeEstimationFactor?: number;
  };
export type IpfsContextParams = {
  /** If not provided uses default value */
  ipfsNodes?: { url: string; headers?: Record<string, string> }[];
};
export type GraphQLContextParams = {
  /** If not provided uses default value */
  graphqlNodes?: { url: string }[];
};

export type Web3ContextState =
  & {
    [index in FrameworkContractsNames]: string;
  }
  & {
    [index in NonFrameworkContractsNames]?: string;
  }
  & {
    network: Network;
    signer: Signer;
    web3Providers: JsonRpcProvider[];
    gasFeeEstimationFactor: number;
  };
export type IpfsContextState = {
  ipfs: IpfsClient[];
};
export type GraphQLContextState = {
  graphql: GraphQLClient[];
};

export type SubgraphPluginInstallation = {
  appliedVersion: SubgraphPluginVersion;
  appliedPreparation: SubgraphPluginPreparation;
};

export type SubgraphPluginVersion = {
  release: {
    release: number;
  };
  metadata: string;
  build: number;
};

export type SubgraphPluginPreparation = {
  helpers: string[];
  pluginRepo: {
    id: string;
  };
};
