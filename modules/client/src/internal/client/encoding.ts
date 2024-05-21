import {
  DaoUpdateParams,
  GrantPermissionParams,
  GrantPermissionWithConditionParams,
  InitializeFromParams,
  RegisterStandardCallbackParams,
  RevokePermissionParams,
  UpgradeToAndCallParams,
  WithdrawParams,
} from "../../types";
import { isAddress } from "@ethersproject/address";
import {
  DAO__factory,
  DAOFactory__factory,
  PluginSetupProcessor__factory,
} from "@aragon/osx-ethers";
import {
  applyInstallatonParamsToContract,
  applyUninstallationParamsToContract,
  applyUpdateParamsToContract,
  permissionParamsToContract,
  permissionWithConditionParamsToContract,
} from "../utils";
import { Contract } from "@ethersproject/contracts";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { abi as ERC721_ABI } from "@openzeppelin/contracts/build/contracts/ERC721.json";
import { abi as ERC1155_ABI } from "@openzeppelin/contracts/build/contracts/ERC1155.json";
import { toUtf8Bytes } from "@ethersproject/strings";
import { IClientEncoding } from "../interfaces";
import {
  AddressOrEnsSchema,
  ApplyInstallationParams,
  ApplyInstallationSchema,
  ApplyUninstallationParams,
  ApplyUninstallationSchema,
  ApplyUpdateParams,
  ClientCore,
  DaoAction,
  hexToBytes,
  InvalidAddressError,
  InvalidAddressOrEnsError,
  InvalidEnsError,
  IpfsUriSchema,
  NotImplementedError,
  Permissions,
  TokenType,
} from "@aragon/sdk-client-common";
import { Interface } from "@ethersproject/abi";
import {
  DaoUpdateSchema,
  InitializeFromSchema,
  PermissionBaseSchema,
  PermissionWithConditionSchema,
  RegisterStandardCallbackSchema,
  UpgradeToAndCallSchema,
  WithdrawErc1155Schema,
  WithdrawErc20Schema,
  WithdrawErc721Schema,
  WithdrawEthSchema,
} from "../schemas";
import { string } from "yup";
import { FrameworkContractsNames } from "@aragon/osx-commons-configs";

/**
 * Encoding module the SDK Generic Client
 */
export class ClientEncoding extends ClientCore implements IClientEncoding {
  /**
   * @param {string} daoAddress
   * @param {ApplyInstallationParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public applyInstallationAction(
    daoAddress: string,
    params: ApplyInstallationParams,
  ): DaoAction[] {
    AddressOrEnsSchema.strict().validateSync(daoAddress);
    ApplyInstallationSchema.strict().validateSync(params);
    const pspInterface = PluginSetupProcessor__factory.createInterface();

    const args = applyInstallatonParamsToContract(params);
    const hexBytes = pspInterface.encodeFunctionData("applyInstallation", [
      daoAddress,
      args,
    ]);
    const pspAddress = this.web3.getAddress(
      FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
    );
    // Grant ROOT_PERMISION in the DAO to the PSP
    const grantAction = this.grantAction(daoAddress, {
      where: daoAddress,
      who: pspAddress,
      permission: Permissions.ROOT_PERMISSION,
    });

    // Revoke ROOT_PERMISION in the DAO to the PSP
    const revokeAction = this.revokeAction(daoAddress, {
      where: daoAddress,
      who: pspAddress,
      permission: Permissions.ROOT_PERMISSION,
    });
    return [
      grantAction,
      {
        to: pspAddress,
        value: BigInt(0),
        data: hexToBytes(hexBytes),
      },
      revokeAction,
    ];
  }

  public applyUninstallationAction(
    daoAddress: string,
    params: ApplyUninstallationParams,
  ): DaoAction[] {
    AddressOrEnsSchema.strict().validateSync(daoAddress);
    ApplyUninstallationSchema.strict().validateSync(params);
    const pspInterface = PluginSetupProcessor__factory.createInterface();
    const args = applyUninstallationParamsToContract(params);
    const hexBytes = pspInterface.encodeFunctionData("applyUninstallation", [
      daoAddress,
      args,
    ]);
    const pspAddress = this.web3.getAddress(
      FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
    );
    // Grant ROOT_PERMISION in the DAO to the PSP
    const grantAction = this.grantAction(daoAddress, {
      where: daoAddress,
      who: pspAddress,
      permission: Permissions.ROOT_PERMISSION,
    });

    // Revoke ROOT_PERMISION in the DAO to the PSP
    const revokeAction = this.revokeAction(daoAddress, {
      where: daoAddress,
      who: pspAddress,
      permission: Permissions.ROOT_PERMISSION,
    });
    return [
      grantAction,
      {
        to: pspAddress,
        value: BigInt(0),
        data: hexToBytes(hexBytes),
      },
      revokeAction,
    ];
  }
  /**
   * Computes the payload to be given when creating a proposal that applies an update to a plugin
   *
   * @param {string} daoAddress
   * @param {ApplyUpdateParams} params
   * @return {DaoAction[]}
   * @memberof ClientEncoding
   */
  public applyUpdateAndPermissionsActionBlock(
    daoAddress: string,
    params: ApplyUpdateParams,
  ): DaoAction[] {
    const pspInterface = PluginSetupProcessor__factory.createInterface();
    const args = applyUpdateParamsToContract(params);

    const hexBytes = pspInterface.encodeFunctionData("applyUpdate", [
      daoAddress,
      args,
    ]);
    const pspAddress = this.web3.getAddress(
      FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
    );

    // Grant UPGRADE_PLUGIN_PERMISSION in the plugin to the PSP
    const grantUpgradeAction = this.grantAction(daoAddress, {
      where: params.pluginAddress,
      who: pspAddress,
      permission: Permissions.UPGRADE_PLUGIN_PERMISSION,
    });
    // Revoke UPGRADE_PLUGIN_PERMISSION in the plugin to the PSP
    const revokeUpgradeAction = this.revokeAction(daoAddress, {
      where: params.pluginAddress,
      who: pspAddress,
      permission: Permissions.UPGRADE_PLUGIN_PERMISSION,
    });
    // If the update requests permissions to be granted or revoked, the PSP needs temporary `ROOT_PERMISSION_ID` permission
    if (params.permissions.length > 0) {
      const grantRootAction = this.grantAction(daoAddress, {
        where: daoAddress,
        who: pspAddress,
        permission: Permissions.ROOT_PERMISSION,
      });
      // Revoke ROOT_PERMISSION in the DAO to the PSP
      const revokeRootAction = this.revokeAction(daoAddress, {
        where: daoAddress,
        who: pspAddress,
        permission: Permissions.ROOT_PERMISSION,
      });
      return [
        grantUpgradeAction,
        grantRootAction,
        {
          to: pspAddress,
          value: BigInt(0),
          data: hexToBytes(hexBytes),
        },
        revokeRootAction,
        revokeUpgradeAction,
      ];
    }
    return [
      grantUpgradeAction,
      {
        to: pspAddress,
        value: BigInt(0),
        data: hexToBytes(hexBytes),
      },
      revokeUpgradeAction,
    ];
  }

  /**
   * Computes the payload to be given when creating a proposal that grants a permission within a DAO
   *
   * @param {string} daoAddress
   * @param {GrantPermissionParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public grantAction(
    daoAddress: string,
    params: GrantPermissionParams,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddress);
    PermissionBaseSchema.strict().validateSync(params);
    const { where, who } = params;
    if (
      !isAddress(where) || !isAddress(who) || !isAddress(daoAddress)
    ) {
      throw new InvalidAddressError();
    }
    const daoInterface = DAO__factory.createInterface();
    const args = permissionParamsToContract(
      {
        who,
        where,
        permission: params.permission,
      },
    );
    // get hex bytes
    const hexBytes = daoInterface.encodeFunctionData("grant", args);
    return {
      to: daoAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that grants a permission within a DAO given a certain condition
   *
   * @param {string} daoAddress
   * @param {GrantPermissionWithConditionParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public grantWithConditionAction(
    daoAddress: string,
    params: GrantPermissionWithConditionParams,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddress);
    PermissionWithConditionSchema.strict().validateSync(params);
    const { where, who } = params;
    if (
      !isAddress(where) || !isAddress(who) || !isAddress(daoAddress)
    ) {
      throw new InvalidAddressError();
    }
    const daoInterface = DAO__factory.createInterface();
    const args = permissionWithConditionParamsToContract(
      {
        who,
        where,
        permission: params.permission,
        condition: params.condition,
      },
    );
    // get hex bytes
    const hexBytes = daoInterface.encodeFunctionData(
      "grantWithCondition",
      args,
    );
    return {
      to: daoAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that revokes a permission within a DAO
   *
   * @param {string} daoAddress
   * @param {RevokePermissionParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public revokeAction(
    daoAddress: string,
    params: RevokePermissionParams,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddress);
    PermissionBaseSchema.strict().validateSync(params);
    const { where, who } = params;
    if (
      !isAddress(where) || !isAddress(who) || !isAddress(daoAddress)
    ) {
      throw new InvalidAddressError();
    }
    const daoInterface = DAO__factory.createInterface();
    const args = permissionParamsToContract(
      {
        who,
        where,
        permission: params.permission,
      },
    );
    // get hex bytes
    const hexBytes = daoInterface.encodeFunctionData("revoke", args);
    return {
      to: daoAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that withdraws ether from the DAO
   *
   * @param {string} recipientAddressOrEns
   * @param {WithdrawParams} value
   * @return {Promise<DaoAction>}
   * @memberof ClientEncoding
   */
  public async withdrawAction(params: WithdrawParams): Promise<DaoAction> {
    let to = params.recipientAddressOrEns;
    if (!isAddress(params.recipientAddressOrEns)) {
      const resolvedAddress = await this.web3.getSigner()?.resolveName(
        params.recipientAddressOrEns,
      );
      if (!resolvedAddress) {
        throw new InvalidAddressOrEnsError();
      }
      to = resolvedAddress;
    }
    let iface: Interface;
    let data: string;
    switch (params.type) {
      case TokenType.NATIVE:
        await WithdrawEthSchema.strict().validate(params);
        return { to, value: params.amount, data: new Uint8Array() };
      case TokenType.ERC20:
        await WithdrawErc20Schema.strict().validate(params);

        iface = new Contract(
          params.tokenAddress,
          ERC20_ABI,
        ).interface;
        data = iface.encodeFunctionData("transfer", [
          params.recipientAddressOrEns,
          params.amount,
        ]);
        return {
          to: params.tokenAddress,
          value: BigInt(0),
          data: hexToBytes(data),
        };
      case TokenType.ERC721:
        await WithdrawErc721Schema.strict().validate(params);
        iface = new Contract(
          params.tokenAddress,
          ERC721_ABI,
        ).interface;
        data = iface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [
            params.daoAddressOrEns, // from
            params.recipientAddressOrEns, // to
            params.tokenId, // tokenId
          ],
        );
        return {
          to: params.tokenAddress,
          value: BigInt(0),
          data: hexToBytes(data),
        };
      case TokenType.ERC1155:
        await WithdrawErc1155Schema.strict().validate(params);
        iface = new Contract(
          params.tokenAddress,
          ERC1155_ABI,
        ).interface;
        if (params.tokenIds.length === 1) {
          data = iface.encodeFunctionData(
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            [
              params.daoAddressOrEns, // from
              params.recipientAddressOrEns, // to
              params.tokenIds[0], // tokenId
              params.amounts[0], // amount
              new Uint8Array(), // data
            ],
          );
        } else {
          data = iface.encodeFunctionData(
            "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
            [
              params.daoAddressOrEns, // from
              params.recipientAddressOrEns, // to
              params.tokenIds, // tokenIds
              params.amounts, // amounts
              new Uint8Array(), // data
            ],
          );
        }
        return {
          to: params.tokenAddress,
          value: BigInt(0),
          data: hexToBytes(data),
        };
      default:
        throw new NotImplementedError("Token type not supported");
    }
  }
  /**
   * Computes the payload to be given when creating a proposal that updates the metadata the DAO
   *
   * @param {string} daoAddressOrEns
   * @param {DaoMetadata} params
   * @return {Promise<DaoAction>}
   * @memberof ClientEncoding
   */
  public async updateDaoMetadataAction(
    daoAddressOrEns: string,
    metadataUri: string,
  ): Promise<DaoAction> {
    await AddressOrEnsSchema.strict().validate(daoAddressOrEns);
    await IpfsUriSchema.strict().validate(metadataUri);
    let address = daoAddressOrEns;
    if (!isAddress(daoAddressOrEns)) {
      const resolvedAddress = await this.web3.getSigner()?.resolveName(
        daoAddressOrEns,
      );
      if (!resolvedAddress) {
        throw new InvalidEnsError();
      }
      address = resolvedAddress;
    }
    // upload metadata to IPFS
    const daoInterface = DAO__factory.createInterface();
    const args = toUtf8Bytes(metadataUri);
    const hexBytes = daoInterface.encodeFunctionData("setMetadata", [args]);
    return {
      to: address,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that sets the dao uri
   *
   * @param {string} daoAddressOrEns
   * @param {string} daoUri
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public setDaoUriAction(
    daoAddressOrEns: string,
    daoUri: string,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    string().url().strict().validateSync(daoUri);

    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData("setDaoURI", [daoUri]);
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that registers a new standard callback
   *
   * @param {string} daoAddressOrEns
   * @param {string} daoUri
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public registerStandardCallbackAction(
    daoAddressOrEns: string,
    params: RegisterStandardCallbackParams,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    RegisterStandardCallbackSchema.strict().validateSync(params);
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData(
      "registerStandardCallback",
      [params.interfaceId, params.callbackSelector, params.magicNumber],
    );
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that sets the signature validator
   *
   * @param {string} daoAddressOrEns
   * @param {string} signatureValidator
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public setSignatureValidatorAction(
    daoAddressOrEns: string,
    signatureValidator: string,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    AddressOrEnsSchema.strict().validateSync(signatureValidator);
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData("setSignatureValidator", [
      signatureValidator,
    ]);
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that sets a new implementation for the proxy
   *
   * @param {string} daoAddressOrEns
   * @param {string} implementationAddress
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public upgradeToAction(
    daoAddressOrEns: string,
    implementationAddress: string,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    AddressOrEnsSchema.strict().validateSync(implementationAddress);
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData("upgradeTo", [
      implementationAddress,
    ]);
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the payload to be given when creating a proposal that sets a new implementation for the proxy and calls the callback function with the specified data
   *
   * @param {string} daoAddressOrEns
   * @param {UpgradeToAndCallParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public upgradeToAndCallAction(
    daoAddressOrEns: string,
    params: UpgradeToAndCallParams,
  ): DaoAction {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    UpgradeToAndCallSchema.strict().validateSync(params);
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData("upgradeToAndCall", [
      params.implementationAddress,
      params.data,
    ]);
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }

  /**
   * Computes an action to be passed to the upgradeToAndCallAction method when upgrading a DAO to a new version.
   *
   * @param {string} daoAddressOrEns
   * @param {InitializeFromParams} params
   * @return {DaoAction}
   * @memberof ClientEncoding
   */
  public initializeFromAction(
    daoAddressOrEns: string,
    params: InitializeFromParams,
  ) {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    InitializeFromSchema.strict().validateSync(params);
    const daoInterface = DAO__factory.createInterface();
    const hexBytes = daoInterface.encodeFunctionData("initializeFrom", [
      params.previousVersion,
      params.initData ?? new Uint8Array(),
    ]);
    return {
      to: daoAddressOrEns,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }

  /**
   * Does the necessary steps to encode an action that updates a DAO
   *
   * @param {string} daoAddressOrEns
   * @param {DaoUpdateParams} params
   * @return {Promise<DaoAction>}
   * @memberof ClientEncoding
   */
  public async daoUpdateAction(
    daoAddressOrEns: string,
    params: DaoUpdateParams,
  ): Promise<DaoAction> {
    AddressOrEnsSchema.strict().validateSync(daoAddressOrEns);
    DaoUpdateSchema.strict().validateSync(params);
    const initializeFromAction = this.initializeFromAction(
      daoAddressOrEns,
      params,
    );
    const { daoFactoryAddress } = params;
    const daoFactory = DAOFactory__factory.connect(
      daoFactoryAddress ??
        this.web3.getAddress(FrameworkContractsNames.DAO_FACTORY),
      this.web3.getProvider(),
    );
    const implementation = await daoFactory.daoBase();
    return this.upgradeToAndCallAction(daoAddressOrEns, {
      implementationAddress: implementation,
      data: initializeFromAction.data,
    });
  }
}
