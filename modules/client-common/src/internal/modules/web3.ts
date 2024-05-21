import { JsonRpcProvider } from "@ethersproject/providers";
import { isAddress } from "@ethersproject/address";
import { Contract, ContractInterface } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { IClientWeb3Core } from "../interfaces";
import { Context } from "../../context";
import { GasFeeEstimation } from "../../types";
import {
  CannotEstimateGasError,
  InvalidAddressError,
  InvalidContractAbiError,
  NoNodesAvailableError,
  NoProviderError,
  NoSignerError,
  UnsupportedNetworkError,
} from "../../errors";
import {
  FrameworkContractsNames,
  getNetworkByAlias,
  NonFrameworkContractsNames,
  SupportedNetworks,
} from "@aragon/osx-commons-configs";
export class Web3Module implements IClientWeb3Core {
  private static readonly PRECISION_FACTOR_BASE = 1000;
  private providerIdx: number = -1;
  private context: Context;

  constructor(context: Context) {
    this.context = context;
    this.providerIdx = Math.floor(Math.random() * context.web3Providers.length);
  }

  /** Starts using the next available Web3 provider */
  public shiftProvider(): void {
    if (!this.context.web3Providers.length) {
      throw new NoProviderError();
    } else if (this.context.web3Providers.length <= 1) {
      throw new NoNodesAvailableError("web3");
    }
    this.providerIdx = (this.providerIdx + 1) %
      this.context.web3Providers.length;
  }

  /** Retrieves the current signer */
  public getSigner(): Signer {
    if (!this.context.signer) {
      throw new NoSignerError();
    }
    return this.context.signer;
  }
  /** Returns the currently active network provider */
  public getProvider(): JsonRpcProvider {
    if (!this.context.web3Providers[this.providerIdx]) {
      throw new NoProviderError();
    }
    return this.context.web3Providers[this.providerIdx];
  }

  /** Returns the currently active network */
  public getNetworkName(): SupportedNetworks {
    const network = getNetworkByAlias(this.context.network.name);
    if (!network) {
      throw new UnsupportedNetworkError(this.context.network.name);
    }
    return network.name;
  }

  /** Returns a signer connected to the current network provider */
  public getConnectedSigner(): Signer {
    let signer = this.getSigner();
    if (!signer.provider) {
      const provider = this.getProvider();
      signer = signer.connect(provider);
    }
    return signer;
  }

  /** Returns whether the current provider is functional or not */
  public isUp(): Promise<boolean> {
    const provider = this.getProvider();
    return provider
      .getNetwork()
      .then(() => true)
      .catch(() => false);
  }

  public async ensureOnline(): Promise<void> {
    if (!this.context.web3Providers.length) {
      throw new NoProviderError();
    }

    for (let i = 0; i < this.context.web3Providers.length; i++) {
      if (await this.isUp()) return;
      this.shiftProvider();
    }
    throw new NoNodesAvailableError("web3");
  }

  /**
   * Returns a contract instance at the given address
   *
   * @param address Contract instance address
   * @param abi The Application Binary Inteface of the contract
   * @return A contract instance attached to the given address
   */
  public attachContract<T>(
    address: string,
    abi: ContractInterface,
  ): Contract & T {
    if (!address || !isAddress(address)) throw new InvalidAddressError();
    else if (!abi) throw new InvalidContractAbiError();
    const signer = this.getConnectedSigner();
    return new Contract(address, abi, signer) as Contract & T;
  }

  /** Calculates the expected maximum gas fee */
  public getMaxFeePerGas(): Promise<bigint> {
    return this.getConnectedSigner()
      .getFeeData()
      .then((feeData) => {
        if (!feeData.maxFeePerGas) {
          throw new CannotEstimateGasError();
        }
        return feeData.maxFeePerGas.toBigInt();
      });
  }

  public getApproximateGasFee(estimatedFee: bigint): Promise<GasFeeEstimation> {
    return this.getMaxFeePerGas().then((maxFeePerGas) => {
      const max = estimatedFee * maxFeePerGas;

      const factor = this.context.gasFeeEstimationFactor *
        Web3Module.PRECISION_FACTOR_BASE;

      const average = (max * BigInt(Math.trunc(factor))) /
        BigInt(Web3Module.PRECISION_FACTOR_BASE);

      return { average, max };
    });
  }

  /** FRAMEWORK ADDRESSES */
  public getAddress(
    addressName: FrameworkContractsNames | NonFrameworkContractsNames,
  ): string {
    const address = this.context.getAddress(addressName);
    if (!address || !isAddress(address)) {
      throw new InvalidAddressError();
    }
    return address;
  }
}
