import { bytesToHex } from "@aragon/sdk-common";
import { ContextPlugin } from "../../context-plugin";
import { ClientCore } from "../core";
import {
  decodeAddMemebersAction,
  decodeRemoveMemebersAction,
  decodeUpdatePluginSettingsAction,
  getFunctionFragment,
} from "../encoding/plugins";
import { IInterfaceParams } from "../interfaces/common";
import {
  IClientAddressListDecoding,
  IPluginSettings,
} from "../interfaces/plugins";

export class ClientAddressListDecoding extends ClientCore
  implements IClientAddressListDecoding {
  constructor(context: ContextPlugin) {
    super(context);
  }

  /**
   * Decodes a dao metadata from an encoded update metadata action
   *
   * @param {Uint8Array} data
   * @return {*}  {IPluginSettings}
   * @memberof ClientAddressListDecoding
   */
  public updatePluginSettingsAction(data: Uint8Array): IPluginSettings {
    return decodeUpdatePluginSettingsAction(data);
  }
  /**
   * Decodes a list of addresses from an encoded add members action
   *
   * @param {Uint8Array} data
   * @return {*}  {string[]}
   * @memberof ClientAddressListDecoding
   */
  public addMembersAction(data: Uint8Array): string[] {
    return decodeAddMemebersAction(data);
  }
  /**
   * Decodes a list of addresses from an encoded remove members action
   *
   * @param {Uint8Array} data
   * @return {*}  {string[]}
   * @memberof ClientAddressListDecoding
   */
  public removeMembersAction(data: Uint8Array): string[] {
    return decodeRemoveMemebersAction(data);
  }
  /**
   * Returns the decoded function info given the encoded data of an action
   *
   * @param {Uint8Array} data
   * @return {*}  {(IInterfaceParams | null)}
   * @memberof ClientAddressListDecoding
   */
  public findInterface(data: Uint8Array): IInterfaceParams | null {
    try {
      const func = getFunctionFragment(data);
      return {
        id: func.format("minimal"),
        functionName: func.name,
        hash: bytesToHex(data, true).substring(0, 10),
      };
    } catch {
      return null;
    }
  }
}
