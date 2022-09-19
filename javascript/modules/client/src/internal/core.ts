import { Signer } from "@ethersproject/abstract-signer";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, ContractInterface } from "@ethersproject/contracts";
import {
  IClientCore,
  IClientGraphQLCore,
  IClientIpfsCore,
  IClientWeb3Core,
} from "./interfaces/core";
import { Context } from "../context";
import { GasFeeEstimation } from "./interfaces/common";
import { Random } from "@aragon/sdk-common";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";
import { GraphQLClient } from "graphql-request";
import { QueryStatus } from "./graphql-queries";

/**
 * Provides the low level foundation so that subclasses have ready-made access to Web3, IPFS and GraphQL primitives
 */
export abstract class ClientCore implements IClientCore {
  private static readonly PRECISION_FACTOR_BASE = 1000;

  private _web3Providers: JsonRpcProvider[] = [];
  private _web3Idx = -1;
  private _signer: Signer | undefined;
  private _daoFactoryAddress = "";
  private _gasFeeEstimationFactor = 1;
  private _ipfs: IpfsClient[] = [];
  private _ipfsIdx: number = -1;
  private _graphql: GraphQLClient[] = [];
  private _graphqlIdx: number = -1;

  constructor(context: Context) {
    if (context.ipfs?.length) {
      this._ipfs = context.ipfs;
      this._ipfsIdx = Math.floor(Random.getFloat() * context.ipfs.length);
    }

    if (context.graphql?.length) {
      this._graphql = context.graphql
      this._graphqlIdx = Math.floor(Random.getFloat() * context.graphql.length);
    }

    if (context.web3Providers) {
      this._web3Providers = context.web3Providers;
      this._web3Idx = 0;
    }

    if (context.signer) {
      this.web3.useSigner(context.signer);
    }

    if (context.daoFactoryAddress) {
      this._daoFactoryAddress = context.daoFactoryAddress;
    }

    if (context.gasFeeEstimationFactor) {
      this._gasFeeEstimationFactor = context.gasFeeEstimationFactor;
    }
  }

  web3: IClientWeb3Core = {
    /** Replaces the current signer by the given one */
    useSigner: (signer: Signer) => {
      if (!signer) {
        throw new Error("Empty wallet or signer");
      }
      this._signer = signer;
    },

    /** Starts using the next available Web3 provider */
    shiftProvider: () => {
      if (!this._web3Providers.length) throw new Error("No endpoints");
      else if (this._web3Providers.length <= 1) {
        throw new Error("No other endpoints");
      }

      this._web3Idx = (this._web3Idx + 1) % this._web3Providers.length;
    },

    /** Retrieves the current signer */
    getSigner: () => {
      return this._signer || null;
    },

    /** Returns a signer connected to the current network provider */
    getConnectedSigner: () => {
      let signer = this.web3.getSigner();
      if (!signer) throw new Error("No signer");
      else if (!signer.provider && !this.web3.getProvider()) {
        throw new Error("No provider");
      } else if (signer.provider) return signer;

      const provider = this.web3.getProvider();
      if (!provider) throw new Error("No provider");

      signer = signer.connect(provider);
      return signer;
    },

    /** Returns the currently active network provider */
    getProvider: () => {
      return this._web3Providers[this._web3Idx] || null;
    },

    /** Returns whether the current provider is functional or not */
    isUp: () => {
      const provider = this.web3.getProvider();
      if (!provider) return Promise.reject(new Error("No provider"));

      return provider
        .getNetwork()
        .then(() => true)
        .catch(() => false);
    },
    
    ensureOnline: async () => {
      if (!this._web3Providers?.length) {
        return Promise.reject(new Error("No provider"));
      }

      for (var i = 0; i < this._web3Providers?.length; i++) {
        if (await this.web3.isUp()) return;

        this.web3.shiftProvider();
      }
      throw new Error("No providers available");
    },

    /**
     * Returns a contract instance at the given address
     *
     * @param address Contract instance address
     * @param abi The Application Binary Inteface of the contract
     * @return A contract instance attached to the given address
     */
    attachContract: <T>(
      address: string,
      abi: ContractInterface,
    ) => {
      if (!address) throw new Error("Invalid contract address");
      else if (!abi) throw new Error("Invalid contract ABI");

      const signer = this.web3.getSigner();
      if (!signer) throw new Error("No signer");
      else if (!this.web3.getProvider()) throw new Error("No signer");

      const provider = this.web3.getProvider();
      if (!provider) throw new Error("No provider");

      const contract = new Contract(address, abi, provider);

      if (!signer) return contract as Contract & T;
      else if (signer instanceof Wallet) {
        return contract.connect(signer.connect(provider)) as Contract & T;
      }

      return contract.connect(signer) as Contract & T;
    },

    /** Calculates the expected maximum gas fee */
    getMaxFeePerGas: () => {
      return this.web3.getConnectedSigner()
        .getFeeData()
        .then((feeData) => {
          if (!feeData.maxFeePerGas) {
            return Promise.reject(new Error("Cannot estimate gas"));
          }
          return feeData.maxFeePerGas.toBigInt();
        });
    },

    getApproximateGasFee: (estimatedFee: bigint) => {
      return this.web3.getMaxFeePerGas()
        .then((maxFeePerGas) => {
          const max = estimatedFee * maxFeePerGas;

          const factor = this._gasFeeEstimationFactor *
            ClientCore.PRECISION_FACTOR_BASE;

          const average = (max * BigInt(Math.trunc(factor))) /
            BigInt(ClientCore.PRECISION_FACTOR_BASE);

          return { average, max } as GasFeeEstimation;
        });
    },

    /** Returns the current DAO factory address */
    getDaoFactoryAddress: () => {
      return this._daoFactoryAddress;
    },
  };

  ipfs: IClientIpfsCore = {
    getClient: () => {
      if (!this._ipfs[this._ipfsIdx]) {
        throw new Error("No IPFS endpoints available");
      }
      return this._ipfs[this._ipfsIdx];
    },

    /**
     * Starts using the next available IPFS endpoint
     */
    shiftClient: () => {
      if (!this._ipfs?.length) throw new Error("No IPFS endpoints available");
      else if (this._ipfs?.length < 2) {
        throw new Error("No other endpoints");
      }
      this._ipfsIdx = (this._ipfsIdx + 1) % this._ipfs?.length;
    },

    /** Returns `true` if the current client is on line */
    isUp: () => {
      if (!this._ipfs?.length) return Promise.resolve(false);

      return Promise.resolve(this.ipfs.getClient().nodeInfo())
        .then(() => true)
        .catch(() => false);
    },

    ensureOnline: async () => {
      if (!this._ipfs?.length) {
        return Promise.reject(new Error("IPFS client is not initialized"));
      }

      for (var i = 0; i < this._ipfs?.length; i++) {
        if (await this.ipfs.isUp()) return;

        this.ipfs.shiftClient();
      }
      throw new Error("No IPFS nodes available");
    },

    // IPFS METHODS

    add: async (input: string | Uint8Array) => {
      return this.ipfs.ensureOnline()
        .then(() => this.ipfs.getClient().add(input))
        .then((res) => res.hash)
        .catch((e) => {
          throw new Error("Could not upload data: " + (e?.message || ""));
        });
    },

    fetchBytes: (cid: string) => {
      return this.ipfs.ensureOnline()
        .then(() => this.ipfs.getClient().cat(cid));
    },

    fetchString: (cid: string): Promise<string> => {
      return this.ipfs.fetchBytes(cid)
        .then((bytes) => new TextDecoder().decode(bytes))
        .catch((e) => {
          throw new Error(
            "Error while fetching and decoding bytes: " + (e?.message || ""),
          );
        });
    },
  };

  graphql: IClientGraphQLCore = {

    /**
     * Get the current graphql client
     * without any additional checks
     * @returns {GraphQLClient}
     */
    getClient: (): GraphQLClient => {
      if (!this._graphql[this._graphqlIdx]) {
        throw new Error("No graphql endpoints available");
      }
      return this._graphql[this._graphqlIdx];
    },

    /**
     * Starts using the next available IPFS endpoint
     * @returns {void}
     */
    shiftClient: () => {
      if (!this._graphql?.length) throw new Error("No graphql endpoints available");
      else if (this._graphql?.length < 2) {
        throw new Error("No other endpoints");
      }
      this._graphqlIdx = (this._graphqlIdx + 1) % this._graphql?.length;
    },

    /**
     * Checks if the current node is online
     * @returns {Promise<boolean>}
     */
    isUp: async (): Promise<boolean> => {
      return this.graphql.getClient().request(QueryStatus)
        .then((res) => {
          if (res._meta?.deployment) {
            return true
          }
          return false
        }).catch(() => false)
    },
    
    /**
     * Ensures that the graphql is online.
     * If the current node is not online
     * it will shift to the next one and
     * repeat until it finds an online 
     * node. In the case that there are no
     * nodes or none of them is available
     * it will throw an error
     * @returns {Promise<void>}
     */
    ensureOnline: async (): Promise<void> => {
      if (!this._graphql?.length) {
        return Promise.reject(new Error("graphql client is not initialized"));
      }

      for (var i = 0; i < this._graphql?.length; i++) {
        if (await this.graphql.isUp()) return;

        this.graphql.shiftClient();
      }
      throw new Error("No graphql nodes available");
    },
  };
}
