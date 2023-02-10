import { UnexpectedActionError } from "@aragon/sdk-common";
import {
  ClientCore,
  ContextPlugin,
  decodeUpdatePluginSettingsAction,
  getFunctionFragment,
  IInterfaceParams,
  VotingSettings,
} from "../../../client-common";
import { AVAILABLE_FUNCTION_SIGNATURES } from "../constants";
import { IAddresslistVotingClientDecoding } from "../../interfaces";
import { AddresslistVoting__factory } from "@aragon/core-contracts-ethers";
import { toUtf8String } from "@ethersproject/strings";

/**
 * Decoding module for the SDK AddressList Client
 */
export class AddresslistVotingClientDecoding extends ClientCore
  implements IAddresslistVotingClientDecoding {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(AddresslistVotingClientDecoding.prototype);
    Object.freeze(this);
  }

  /**
   * Decodes a dao metadata from an encoded update metadata action
   *
   * @param {Uint8Array} data
   * @return {*}  {VotingSettings}
   * @memberof AddresslistVotingClientDecoding
   */
  public updatePluginSettingsAction(data: Uint8Array): VotingSettings {
    return decodeUpdatePluginSettingsAction(data);
  }
  /**
   * Decodes a list of addresses from an encoded add members action
   *
   * @param {Uint8Array} data
   * @return {*}  {string[]}
   * @memberof AddresslistVotingClientDecoding
   */
  public addMembersAction(data: Uint8Array): string[] {
    const votingInterface = AddresslistVoting__factory.createInterface();
    const hexBytes = toUtf8String(data);
    const receivedFunction = votingInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedfunction = votingInterface.getFunction("addAddresses");
    if (receivedFunction.name !== expectedfunction.name) {
      throw new UnexpectedActionError();
    }
    const result = votingInterface.decodeFunctionData(
      "addAddresses",
      hexBytes,
    );
    return result[0];
  }
  /**
   * Decodes a list of addresses from an encoded remove members action
   *
   * @param {Uint8Array} data
   * @return {*}  {string[]}
   * @memberof AddresslistVotingClientDecoding
   */
  public removeMembersAction(data: Uint8Array): string[] {
    const votingInterface = AddresslistVoting__factory.createInterface();
    const hexBytes = toUtf8String(data);
    const receivedFunction = votingInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedfunction = votingInterface.getFunction(
      "removeAddresses",
    );
    if (receivedFunction.name !== expectedfunction.name) {
      throw new UnexpectedActionError();
    }
    const result = votingInterface.decodeFunctionData(
      "removeAddresses",
      hexBytes,
    );
    return result[0];
  }
  /**
   * Returns the decoded function info given the encoded data of an action
   *
   * @param {Uint8Array} data
   * @return {*}  {(IInterfaceParams | null)}
   * @memberof AddresslistVotingClientDecoding
   */
  public findInterface(data: Uint8Array): IInterfaceParams | null {
    try {
      const func = getFunctionFragment(data, AVAILABLE_FUNCTION_SIGNATURES);
      return {
        id: func.format("minimal"),
        functionName: func.name,
        hash: toUtf8String(data).substring(0, 10),
      };
    } catch {
      return null;
    }
  }
}
