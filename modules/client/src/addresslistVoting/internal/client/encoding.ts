import { isAddress } from "@ethersproject/address";
import {
  encodeUpdateVotingSettingsAction,
  VotingSettings,
  votingSettingsToContract,
} from "../../../client-common";
import { IAddresslistVotingClientEncoding } from "../interfaces";
import { AddresslistVoting__factory } from "@aragon/osx-ethers";
import { defaultAbiCoder } from "@ethersproject/abi";
import { Networkish } from "@ethersproject/providers";
import { AddresslistVotingPluginInstall } from "../../types";
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
 * Encoding module for the SDK AddressList Client
 */
export class AddresslistVotingClientEncoding extends ClientCore
  implements IAddresslistVotingClientEncoding {
  /**
   * Computes the parameters to be given when creating the DAO,
   * so that the plugin is configured
   *
   * @param {AddresslistVotingPluginInstall} params
   * @param {Networkish} network
   * @return {PluginInstallItem}
   * @memberof AddresslistVotingClientEncoding
   */
  static getPluginInstallItem(
    params: AddresslistVotingPluginInstall,
    network: Networkish,
  ): PluginInstallItem {
    const networkName = getNetwork(network).name;
    const aragonNetwork = getNetworkNameByAlias(networkName);
    if (!aragonNetwork) {
      throw new UnsupportedNetworkError(networkName);
    }
    const hexBytes = defaultAbiCoder.encode(
      getNamedTypesFromMetadata(INSTALLATION_ABI),
      [
        votingSettingsToContract(params.votingSettings),
        params.addresses,
      ],
    );
    const repoAddress = contracts[aragonNetwork][SupportedVersions.V1_3_0]
      ?.AddresslistVotingRepoProxy?.address;
    if (!repoAddress) {
      throw new Error("AddresslistVotingRepoProxy address not found");
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
   * @memberof AddresslistVotingClientEncoding
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
   * Computes the parameters to be given when creating a proposal that adds addresses to address list
   *
   * @param {string} pluginAddress
   * @param {string[]} members
   * @return {DaoAction}
   * @memberof AddresslistVotingClientEncoding
   */
  public addMembersAction(pluginAddress: string, members: string[]): DaoAction {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    for (const member of members) {
      if (!isAddress(member)) {
        throw new InvalidAddressError();
      }
    }
    const votingInterface = AddresslistVoting__factory.createInterface();
    // get hex bytes
    const hexBytes = votingInterface.encodeFunctionData(
      "addAddresses",
      [members],
    );
    return {
      to: pluginAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the parameters to be given when creating a proposal that removes addresses from the address list
   *
   * @param {string} pluginAddress
   * @param {string[]} members
   * @return {DaoAction}
   * @memberof AddresslistVotingClientEncoding
   */
  public removeMembersAction(
    pluginAddress: string,
    members: string[],
  ): DaoAction {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    for (const member of members) {
      if (!isAddress(member)) {
        throw new InvalidAddressError();
      }
    }
    const votingInterface = AddresslistVoting__factory.createInterface();
    // get hex bytes
    const hexBytes = votingInterface.encodeFunctionData(
      "removeAddresses",
      [members],
    );
    return {
      to: pluginAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
}
