import {
  encodeUpdateVotingSettingsAction,
  VotingSettings,
} from "../../../client-common";
import { isAddress } from "@ethersproject/address";
import { ITokenVotingClientEncoding } from "../interfaces";
import { MintTokenParams, TokenVotingPluginInstall } from "../../types";
import { IERC20MintableUpgradeable__factory } from "@aragon/osx-ethers";
import {
  mintTokenParamsToContract,
  tokenVotingInitParamsToContract,
} from "../utils";
import { defaultAbiCoder } from "@ethersproject/abi";
import { Networkish } from "@ethersproject/providers";
import {
  ClientCore,
  DaoAction,
  getNamedTypesFromMetadata,
  getNetwork,
  hexToBytes,
  InvalidAddressError,
  PluginInstallItem,
  UnsupportedNetworkError,
} from "@aragon/sdk-client-common";
import { INSTALLATION_ABI } from "../constants";
import {
  contracts,
  getNetworkNameByAlias,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

/**
 * Encoding module the SDK TokenVoting Client
 */
export class TokenVotingClientEncoding extends ClientCore
  implements ITokenVotingClientEncoding {
  /**
   * Computes the parameters to be given when creating the DAO,
   * so that the plugin is configured
   *
   * @param {TokenVotingPluginInstall} params
   * @param {Networkish} network
   * @return {PluginInstallItem}
   * @memberof TokenVotingClientEncoding
   */
  static getPluginInstallItem(
    params: TokenVotingPluginInstall,
    network: Networkish,
  ): PluginInstallItem {
    const networkName = getNetwork(network).name;
    const aragonNetwork = getNetworkNameByAlias(networkName);
    if (!aragonNetwork) {
      throw new UnsupportedNetworkError(networkName);
    }
    const args = tokenVotingInitParamsToContract(params);
    const hexBytes = defaultAbiCoder.encode(
      getNamedTypesFromMetadata(INSTALLATION_ABI),
      args,
    );

    const repoAddress = contracts[aragonNetwork][SupportedVersions.V1_3_0]
      ?.TokenVotingRepoProxy?.address;
    if (!repoAddress) {
      throw new Error();
    }
    return {
      id: repoAddress,
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the parameters to be given when creating a proposal that updates the governance configuration
   *
   * @param {string} pluginAddress
   * @param {VotingSettings} params
   * @return {DaoAction}
   * @memberof TokenVotingClientEncoding
   */
  public updatePluginSettingsAction(
    pluginAddress: string,
    params: VotingSettings,
  ): DaoAction {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    // TODO: check if to and value are correct
    return {
      to: pluginAddress,
      value: BigInt(0),
      data: encodeUpdateVotingSettingsAction(params),
    };
  }

  /**
   * Computes the parameters to be given when creating a proposal that mints an amount of ERC-20 tokens to an address
   *
   * @param {string} minterAddress
   * @param {MintTokenParams} params
   * @return {DaoAction}
   * @memberof TokenVotingClientEncoding
   */
  public mintTokenAction(
    minterAddress: string,
    params: MintTokenParams,
  ): DaoAction {
    if (!isAddress(minterAddress) || !isAddress(params.address)) {
      throw new InvalidAddressError();
    }
    const votingInterface = IERC20MintableUpgradeable__factory
      .createInterface();
    const args = mintTokenParamsToContract(params);
    // get hex bytes
    const hexBytes = votingInterface.encodeFunctionData("mint", args);
    return {
      to: minterAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
}
