// This file contains the definitions of the general purpose DAO client
import {
  ApplyInstallationParams,
  ApplyUninstallationParams,
  ApplyUpdateParams,
  DaoAction,
  DecodedApplyInstallationParams,
  DecodedApplyUninstallationParams,
  DecodedApplyUpdateParams,
  GasFeeEstimation,
  InterfaceParams,
  PrepareInstallationParams,
  PrepareInstallationStepValue,
  PrepareUninstallationParams,
  PrepareUninstallationStepValue,
  PrepareUpdateParams,
  PrepareUpdateStepValue,
} from "@aragon/sdk-client-common";
import {
  AssetBalance,
  CreateDaoParams,
  DaoBalancesQueryParams,
  DaoCreationStepValue,
  DaoDepositStepValue,
  DaoDetails,
  DaoListItem,
  DaoMetadata,
  DaoQueryParams,
  DaoUpdateDecodedParams,
  DaoUpdateParams,
  DaoUpdateProposalValidity,
  DepositParams,
  GrantPermissionDecodedParams,
  GrantPermissionParams,
  GrantPermissionWithConditionParams,
  HasPermissionParams,
  InitializeFromParams,
  PluginPreparationListItem,
  PluginPreparationQueryParams,
  PluginQueryParams,
  PluginRepo,
  PluginRepoListItem,
  PluginUpdateProposalValidity,
  RegisterStandardCallbackParams,
  RevokePermissionDecodedParams,
  RevokePermissionParams,
  SetAllowanceParams,
  SetAllowanceStepValue,
  Transfer,
  TransferQueryParams,
  UpgradeToAndCallParams,
  WithdrawParams,
} from "../types";
import { SupportedVersions } from "@aragon/osx-commons-configs";

/** Defines the shape of the general purpose Client class */
export interface IClientMethods {
  createDao: (params: CreateDaoParams) => AsyncGenerator<DaoCreationStepValue>;
  pinMetadata: (params: DaoMetadata) => Promise<string>;
  /** Retrieves the asset balances of the given DAO, by default, ETH, DAI, USDC and USDT on Mainnet*/
  getDaoBalances: (
    params: DaoBalancesQueryParams,
  ) => Promise<AssetBalance[] | null>;
  /** Retrieves the list of transfers from or to the given DAO, by default, ETH, DAI, USDC and USDT on Mainnet*/
  getDaoTransfers: (params: TransferQueryParams) => Promise<Transfer[] | null>;
  /** Checks whether a role is granted by the current DAO's ACL settings */
  hasPermission: (params: HasPermissionParams) => Promise<boolean>;
  /** Deposits ether or an ERC20 token */
  deposit: (
    params: DepositParams,
  ) => AsyncGenerator<DaoDepositStepValue>;
  /** Retrieves metadata for DAO with given identifier (address or ens domain)*/
  setAllowance: (
    params: SetAllowanceParams,
  ) => AsyncGenerator<SetAllowanceStepValue>;
  /** Retrieves metadata for DAO with given identifier (address or ens domain)*/
  getDao: (daoAddressOrEns: string) => Promise<DaoDetails | null>;
  /** Retrieves metadata for many daos */
  getDaos: (params: DaoQueryParams) => Promise<DaoListItem[]>;
  /** retrieves the plugin details given an address, release and build */
  getPlugin: (pluginAddress: string, includeMetadata?: boolean) => Promise<PluginRepo>;
  /** Retrieves the list of plugins available on the PluginRegistry */
  getPlugins: (params?: PluginQueryParams, includeMetadata?: boolean) => Promise<PluginRepoListItem[]>;
  /** Prepare uninstallation of a plugin */
  prepareUninstallation: (
    params: PrepareUninstallationParams,
  ) => AsyncGenerator<PrepareUninstallationStepValue>;
  /** Prepare uninstallation of a plugin */
  prepareInstallation: (
    params: PrepareInstallationParams,
  ) => AsyncGenerator<PrepareInstallationStepValue>;
  prepareUpdate: (
    params: PrepareUpdateParams,
  ) => AsyncGenerator<PrepareUpdateStepValue>;
  /** Gets the protocol version of a contract */
  getProtocolVersion: (
    contractAddress: string,
  ) => Promise<[number, number, number]>;

  isPluginUpdateProposal: (
    proposalId: string,
  ) => Promise<boolean>;

  isPluginUpdateProposalValid: (
    proposalId: string,
  ) => Promise<PluginUpdateProposalValidity>;

  isDaoUpdateProposal: (
    proposalId: string,
  ) => Promise<boolean>;

  isDaoUpdateProposalValid: (
    proposalId: string,
    version?: SupportedVersions,
  ) => Promise<DaoUpdateProposalValidity>;

  getDaoImplementation: (
    daoFactoryAddress: string,
  ) => Promise<string>;

  getPluginPreparations(
    params: PluginPreparationQueryParams,
  ): Promise<PluginPreparationListItem[]>;
}

export interface IClientEncoding {
  grantAction: (
    daoAddress: string,
    params: GrantPermissionParams,
  ) => DaoAction;
  grantWithConditionAction: (
    daoAddress: string,
    params: GrantPermissionWithConditionParams,
  ) => DaoAction;
  revokeAction: (
    daoAddress: string,
    params: RevokePermissionParams,
  ) => DaoAction;
  withdrawAction: (
    parameters: WithdrawParams,
  ) => Promise<DaoAction>;
  updateDaoMetadataAction: (
    daoAddressOrEns: string,
    metadataUri: string,
  ) => Promise<DaoAction>;
  setDaoUriAction: (
    daoAddressOrEns: string,
    daoUri: string,
  ) => DaoAction;
  registerStandardCallbackAction: (
    daoAddressOrEns: string,
    params: RegisterStandardCallbackParams,
  ) => DaoAction;
  setSignatureValidatorAction: (
    daoAddressOrEns: string,
    signatureValidator: string,
  ) => DaoAction;
  upgradeToAction: (
    daoAddressOrEns: string,
    implementationAddress: string,
  ) => DaoAction;
  upgradeToAndCallAction: (
    daoAddressOrEns: string,
    params: UpgradeToAndCallParams,
  ) => DaoAction;
  applyInstallationAction: (
    daoAddressOrEns: string,
    params: ApplyInstallationParams,
  ) => DaoAction[];
  applyUninstallationAction: (
    daoAddressOrEns: string,
    params: ApplyUninstallationParams,
  ) => DaoAction[];
  applyUpdateAndPermissionsActionBlock: (
    daoAddressOrEns: string,
    params: ApplyUpdateParams,
  ) => DaoAction[];
  initializeFromAction: (
    daoAddressOrEns: string,
    params: InitializeFromParams,
  ) => DaoAction;
  daoUpdateAction: (
    daoAddressOrEns: string,
    params: DaoUpdateParams,
  ) => Promise<DaoAction>;
}

export interface IClientDecoding {
  grantAction: (data: Uint8Array) => GrantPermissionDecodedParams;
  grantWithConditionAction: (
    data: Uint8Array,
  ) => GrantPermissionWithConditionParams;
  revokeAction: (data: Uint8Array) => RevokePermissionDecodedParams;
  withdrawAction: (
    to: string,
    value: bigint,
    data: Uint8Array,
  ) => WithdrawParams;
  updateDaoMetadataRawAction: (data: Uint8Array) => string;
  updateDaoMetadataAction: (data: Uint8Array) => Promise<DaoMetadata>;
  setDaoUriAction: (data: Uint8Array) => string;
  registerStandardCallbackAction: (
    data: Uint8Array,
  ) => RegisterStandardCallbackParams;
  setSignatureValidatorAction: (data: Uint8Array) => string;
  upgradeToAction: (data: Uint8Array) => string;
  upgradeToAndCallAction: (data: Uint8Array) => UpgradeToAndCallParams;
  findInterface: (data: Uint8Array) => InterfaceParams | null;
  applyInstallationAction: (
    data: Uint8Array,
  ) => DecodedApplyInstallationParams;
  applyUninstallationAction: (
    data: Uint8Array,
  ) => DecodedApplyUninstallationParams;
  applyUpdateAction: (data: Uint8Array) => DecodedApplyUpdateParams;
  initializeFromAction: (
    data: Uint8Array,
  ) => InitializeFromParams;
  daoUpdateAction: (
    data: Uint8Array,
  ) => DaoUpdateDecodedParams;
}

export interface IClientEstimation {
  createDao: (params: CreateDaoParams) => Promise<GasFeeEstimation>;
  deposit: (
    params: DepositParams,
  ) => Promise<GasFeeEstimation>;
  setAllowance: (params: SetAllowanceParams) => Promise<GasFeeEstimation>;
  prepareUpdate: (
    params: PrepareUpdateParams,
  ) => Promise<GasFeeEstimation>;
}

export interface IClient {
  methods: IClientMethods;
  encoding: IClientEncoding;
  decoding: IClientDecoding;
  estimation: IClientEstimation;
}
