import { bytesToHex } from "@aragon/sdk-common";
import { Context } from "../../context";
import { ClientCore } from "../core";
import {
  decodeFreezeActionData,
  decodeGrantActionData,
  decodeRevokeActionData,
  decodeUpdateMetadataAction,
  decodeWithdrawActionData,
  getFunctionFragment,
} from "../encoding/client";
import {
  IClientDecoding,
  IFreezePermissionDecodedParams,
  IGrantPermissionDecodedParams,
  IMetadata,
  IRevokePermissionDecodedParams,
  IWithdrawParams,
} from "../interfaces/client";
import { IInterfaceParams } from "../interfaces/common";

export class ClientDecoding extends ClientCore
  implements IClientDecoding {
  constructor(context: Context) {
    super(context);
  }
  /**
   * Decodes the permission parameters from an encoded grant action
   *
   * @param {Uint8Array} data
   * @return {*}  {IGrantPermissionDecodedParams}
   * @memberof ClientDecoding
   */
  public grantAction(data: Uint8Array): IGrantPermissionDecodedParams {
    return decodeGrantActionData(data);
  }
  /**
   * Decodes the permission parameters from an encoded revoke action
   *
   * @param {Uint8Array} data
   * @return {*}  {IRevokePermissionDecodedParams}
   * @memberof ClientDecoding
   */
  public revokeAction(data: Uint8Array): IRevokePermissionDecodedParams {
    return decodeRevokeActionData(data);
  }
  /**
   * Decodes the freeze parameters from an encoded freeze action
   *
   * @param {Uint8Array} data
   * @return {*}  {IFreezePermissionDecodedParams}
   * @memberof ClientDecoding
   */
  public freezeAction(data: Uint8Array): IFreezePermissionDecodedParams {
    return decodeFreezeActionData(data);
  }
  /**
   * Decodes the withdraw parameters from an encoded withdraw action
   *
   * @param {Uint8Array} data
   * @return {*}  {IWithdrawParams}
   * @memberof ClientDecoding
   */
  public withdrawAction(data: Uint8Array): IWithdrawParams {
    return decodeWithdrawActionData(data);
  }
  /**
   * Decodes a dao metadata ipfs uri from an encoded update metadata action
   *
   * @param {Uint8Array} data
   * @return {*}  {string}
   * @memberof ClientDecoding
   */
  public updateMetadataRawAction(data: Uint8Array): string {
    return "ipfs://" + decodeUpdateMetadataAction(data);
  }
  /**
   * Decodes a dao metadata from an encoded update metadata raw action
   *
   * @param {Uint8Array} data
   * @return {*}  {Promise<IMetadata>}
   * @memberof ClientDecoding
   */
  public async updateMetadataAction(data: Uint8Array): Promise<IMetadata> {
    const cid = decodeUpdateMetadataAction(data);
    try {
      const stringMetadata = await this.ipfs.fetchString(cid);
      return JSON.parse(stringMetadata);
    } catch {
      throw new Error("Error reading data from IPFS");
    }
  }
  /**
   * Returns the decoded function info given the encoded data of an action
   *
   * @param {Uint8Array} data
   * @return {*}  {(IInterfaceParams | null)}
   * @memberof ClientDecoding
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
