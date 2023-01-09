import { hexToBytes, InvalidAddressError, strip0x } from "@aragon/sdk-common";
import { isAddress } from "@ethersproject/address";
import {
  ClientCore,
  ContextPlugin,
  ContractVotingSettings,
  DaoAction,
  encodeUpdateVotingSettingsAction,
  IPluginInstallItem,
  VotingSettings,
  votingSettingsToContract,
} from "../../../client-common";
import { ADDRESSLIST_PLUGIN_ID } from "../constants";
import {
  IAddressListPluginInstall,
  IClientAddressListEncoding,
} from "../../interfaces";
import { AddresslistVoting__factory } from "@aragon/core-contracts-ethers";
import { defaultAbiCoder } from "@ethersproject/abi";
import { toUtf8Bytes } from "@ethersproject/strings";

/**
 * Encoding module for the SDK AddressList Client
 */
export class ClientAddressListEncoding extends ClientCore
  implements IClientAddressListEncoding {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(ClientAddressListEncoding.prototype);
    Object.freeze(this);
  }

  /**
   * Computes the parameters to be given when creating the DAO,
   * so that the plugin is configured
   *
   * @param {IAddressListPluginInstall} params
   * @return {*}  {IPluginInstallItem}
   * @memberof ClientAddressListEncoding
   */
  static getPluginInstallItem(
    params: IAddressListPluginInstall,
  ): IPluginInstallItem {
    const hexBytes = defaultAbiCoder.encode(
      // ["votingMode","supportThreshold", "minParticipation", "minDuration"], "members"]
      [
        "tuple(uint8, uint64, uint64, uint64, uint256)",
        "address[]",
      ],
      [
        Object.values(
          votingSettingsToContract(params.votingSettings),
        ) as ContractVotingSettings,
        params.addresses,
      ],
    );
    return {
      id: ADDRESSLIST_PLUGIN_ID,
      data: toUtf8Bytes(hexBytes),
    };
  }

  /**
   * Computes the parameters to be given when creating a proposal that updates the governance configuration
   *
   * @param {string} pluginAddress
   * @param {VotingSettings} params
   * @return {*}  {DaoAction}
   * @memberof ClientAddressListEncoding
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
   * @return {*}  {DaoAction}
   * @memberof ClientAddressListEncoding
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
    const data = hexToBytes(strip0x(hexBytes));
    return {
      to: pluginAddress,
      value: BigInt(0),
      data,
    };
  }
  /**
   * Computes the parameters to be given when creating a proposal that removes addresses from the address list
   *
   * @param {string} pluginAddress
   * @param {string[]} members
   * @return {*}  {DaoAction}
   * @memberof ClientAddressListEncoding
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
    const data = hexToBytes(strip0x(hexBytes));
    return {
      to: pluginAddress,
      value: BigInt(0),
      data,
    };
  }
}
