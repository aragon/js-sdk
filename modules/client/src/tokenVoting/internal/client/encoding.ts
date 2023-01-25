import { hexToBytes, strip0x } from "@aragon/sdk-common";
import {
  addressSchema,
  ClientCore,
  ContextPlugin,
  DaoAction,
  encodeUpdateVotingSettingsAction,
  IPluginInstallItem,
  VotingSettings,
  votingSettingsSchema,
} from "../../../client-common";
import {
  IMintTokenParams,
  ITokenVotingClientEncoding,
  ITokenVotingPluginInstall,
} from "../../interfaces";
import { TOKEN_VOTING_PLUGIN_ID } from "../constants";
import {
  IERC20MintableUpgradeable__factory,
} from "@aragon/core-contracts-ethers";
import {
  mintTokenParamsToContract,
  tokenVotingInitParamsToContract,
} from "../utils";
import { defaultAbiCoder } from "@ethersproject/abi";
import { toUtf8Bytes } from "@ethersproject/strings";
import { tokenVotingInstallSchema, mintTokenSchema } from "../../schemas";
/**
 * Encoding module the SDK TokenVoting Client
 */
export class TokenVotingClientEncoding extends ClientCore
  implements ITokenVotingClientEncoding {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(TokenVotingClientEncoding.prototype);
    Object.freeze(this);
  }
  /**
   * Computes the parameters to be given when creating the DAO,
   * so that the plugin is configured
   *
   * @param {ITokenVotingPluginInstall} params
   * @return {*}  {IPluginInstallItem}
   * @memberof TokenVotingClientEncoding
   */
  static getPluginInstallItem(
    params: ITokenVotingPluginInstall,
  ): IPluginInstallItem {
    tokenVotingInstallSchema.validateSync(params);
    const args = tokenVotingInitParamsToContract(params);
    const hexBytes = defaultAbiCoder.encode(
      // ["votingMode","supportThreshold", "minParticipation", "minDuration"], ["address","name","symbol"][ "receivers","amount"]
      [
        "tuple(uint8, uint64, uint64, uint64, uint256)",
        "tuple(address, string, string)",
        "tuple(address[], uint256[])",
      ],
      args,
    );
    return {
      id: TOKEN_VOTING_PLUGIN_ID,
      data: toUtf8Bytes(hexBytes),
    };
  }
  /**
   * Computes the parameters to be given when creating a proposal that updates the governance configuration
   *
   * @param {string} pluginAddress
   * @param {VotingSettings} params
   * @return {*}  {DaoAction}
   * @memberof TokenVotingClientEncoding
   */
  public updatePluginSettingsAction(
    pluginAddress: string,
    params: VotingSettings,
  ): DaoAction {
    addressSchema.validateSync(pluginAddress);
    votingSettingsSchema.validateSync(params);
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
   * @param {IMintTokenParams} params
   * @return {*}  {DaoAction}
   * @memberof TokenVotingClientEncoding
   */
  public mintTokenAction(
    minterAddress: string,
    params: IMintTokenParams,
  ): DaoAction {
    addressSchema.validateSync(minterAddress);
    mintTokenSchema.validateSync(params);
    const votingInterface = IERC20MintableUpgradeable__factory
      .createInterface();
    const args = mintTokenParamsToContract(params);
    // get hex bytes
    const hexBytes = votingInterface.encodeFunctionData("mint", args);
    const data = hexToBytes(strip0x(hexBytes));
    return {
      to: minterAddress,
      value: BigInt(0),
      data,
    };
  }
}
