import { bytesToHex, hexToBytes } from "@aragon/sdk-common";
import {
  DaoMetadata,
  IClientDecoding,
  IGrantPermissionDecodedParams,
  IRevokePermissionDecodedParams,
  TokenStandards,
  WithdrawParams,
} from "../../interfaces";
import {
  ClientCore,
  Context,
  getFunctionFragment,
  IInterfaceParams,
} from "../../client-common";
import { AVAILABLE_FUNCTION_SIGNATURES } from "../constants";
import { DAO__factory } from "@aragon/core-contracts-ethers";
import {
  permissionParamsFromContract,
  withdrawParamsFromContract,
} from "../utils";
import { resolveIpfsCid } from "@aragon/sdk-common";
import { erc20ContractAbi } from "../abi/erc20";
import { Contract } from "@ethersproject/contracts";
import { AddressZero } from "@ethersproject/constants";

/**
 * Decoding module the SDK Generic Client
 */
export class ClientDecoding extends ClientCore implements IClientDecoding {
  constructor(context: Context) {
    super(context);
    Object.freeze(ClientDecoding.prototype);
    Object.freeze(this);
  }
  /**
   * Decodes the permission parameters from an encoded grant action
   *
   * @param {Uint8Array} data
   * @return {*}  {IGrantPermissionDecodedParams}
   * @memberof ClientDecoding
   */
  public grantAction(data: Uint8Array): IGrantPermissionDecodedParams {
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = bytesToHex(data, true);
    const receivedFunction = daoInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedFunction = daoInterface.getFunction("grant");
    if (receivedFunction.name !== expectedFunction.name) {
      throw new Error("The received action is different from the expected one");
    }
    const result = daoInterface.decodeFunctionData("grant", data);
    return permissionParamsFromContract(result);
  }
  /**
   * Decodes the permission parameters from an encoded revoke action
   *
   * @param {Uint8Array} data
   * @return {*}  {IRevokePermissionDecodedParams}
   * @memberof ClientDecoding
   */
  public revokeAction(data: Uint8Array): IRevokePermissionDecodedParams {
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = bytesToHex(data, true);
    const receivedFunction = daoInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedFunction = daoInterface.getFunction("revoke");
    if (receivedFunction.name !== expectedFunction.name) {
      throw new Error("The received action is different from the expected one");
    }
    const result = daoInterface.decodeFunctionData("revoke", data);
    return permissionParamsFromContract(result);
  }
  /**
   * Decodes the withdraw parameters from an encoded withdraw action
   *
   * @param {Uint8Array} data
   * @return {*}  {WithdrawParams}
   * @memberof ClientDecoding
   */
  public withdrawAction(data: Uint8Array): WithdrawParams {
    const abiObjects = [{ tokenStandard: TokenStandards.ERC20, abi: erc20ContractAbi }];
    for (const abiObject of abiObjects) {
      const hexBytes = bytesToHex(data, true);
      const iface  = new Contract(AddressZero, abiObject.abi).interface;
      const expectedSigHash = iface.getSighash("transfer");
      if (hexBytes.substring(0, 10) !== expectedSigHash) {
        continue
      }
      const result = iface.decodeFunctionData("transfer", data);
      return withdrawParamsFromContract(result, abiObject.tokenStandard);
    }
    throw new Error("The received action is different from the expected one");
  }
  /**
   * Decodes a dao metadata ipfs uri from an encoded update metadata action
   *
   * @param {Uint8Array} data
   * @return {*}  {string}
   * @memberof ClientDecoding
   */
  public updateDaoMetadataRawAction(data: Uint8Array): string {
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = bytesToHex(data, true);
    const receivedFunction = daoInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedFunction = daoInterface.getFunction("setMetadata");
    if (receivedFunction.name !== expectedFunction.name) {
      throw new Error("The received action is different from the expected one");
    }
    const result = daoInterface.decodeFunctionData("setMetadata", data);
    const bytes = hexToBytes(result[0]);
    const metadataUri = new TextDecoder().decode(bytes);
    resolveIpfsCid(metadataUri);
    return metadataUri;
  }
  /**
   * Decodes a dao metadata from an encoded update metadata raw action
   *
   * @param {Uint8Array} data
   * @return {*}  {Promise<DaoMetadata>}
   * @memberof ClientDecoding
   */
  public async updateDaoMetadataAction(data: Uint8Array): Promise<DaoMetadata> {
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = bytesToHex(data, true);
    const receivedFunction = daoInterface.getFunction(
      hexBytes.substring(0, 10) as any,
    );
    const expectedFunction = daoInterface.getFunction("setMetadata");
    if (receivedFunction.name !== expectedFunction.name) {
      throw new Error("The received action is different from the expected one");
    }
    const result = daoInterface.decodeFunctionData("setMetadata", data);
    const bytes = hexToBytes(result[0]);
    const metadataUri = new TextDecoder().decode(bytes);
    const ipfsCid = resolveIpfsCid(metadataUri);
    try {
      const stringMetadata = await this.ipfs.fetchString(ipfsCid);
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
      const func = getFunctionFragment(data, AVAILABLE_FUNCTION_SIGNATURES);
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
