import {
  MetadataAbiInput,
  MultiTargetPermission,
  Pagination,
  PluginInstallItem,
  TokenType,
} from "@aragon/sdk-client-common";

/* DAO creation */
export type CreateDaoParams = {
  metadataUri: string;
  daoUri?: string;
  ensSubdomain?: string;
  trustedForwarder?: string;
  plugins: PluginInstallItem[];
};

export enum DaoCreationSteps {
  CREATING = "creating",
  DONE = "done",
}

export type DaoCreationStepValue =
  | { key: DaoCreationSteps.CREATING; txHash: string }
  | { key: DaoCreationSteps.DONE; address: string; pluginAddresses: string[] };

/* DAOs */
export type DaoResourceLink = { name: string; url: string };
export type DaoMetadata = {
  name: string;
  description: string;
  avatar?: string;
  links: DaoResourceLink[];
};
export type DaoDetails = {
  address: string;
  ensDomain: string;
  metadata: DaoMetadata;
  metadataHash?: string;
  creationDate: Date;
  plugins: InstalledPluginListItem[];
};

export type DaoListItem = {
  address: string;
  ensDomain: string;
  metadata: {
    name: string;
    description: string;
    avatar?: string;
  };
  metadataHash?: string;
  plugins: InstalledPluginListItem[];
};

export type DaoQueryParams = Pagination & {
  sortBy?: DaoSortBy;
};

export enum DaoSortBy {
  CREATED_AT = "createdAt",
  SUBDOMAIN = "subdomain",
  // POPULARITY = "totalProposals", // currently defined as number of proposals
}

/* Plugins */

export type InstalledPluginListItem = {
  id: string;
  instanceAddress: string;
  release: number;
  build: number;
};

export enum PluginSortBy {
  SUBDOMAIN = "subdomain",
}

export type PluginQueryParams = Pagination & {
  sortBy?: PluginSortBy;
  subdomain?: string;
};

/* Plugin repos */

export type PluginRepoReleaseMetadata = {
  name: string;
  description: string;
  images: Object; // TODO specify parameters
};

export type PluginRepoBuildMetadata = {
  ui: string;
  change: string;
  pluginSetup: {
    prepareInstallation: string[];
    prepareUpdate: {
      [key: number]: {
        description: string;
        inputs: MetadataAbiInput[];
      };
    };
    prepareUninstallation: string[];
  };
};

export type PluginRepoCurrent = {
  build: {
    number: number;
    metadata: PluginRepoBuildMetadata;
  };
  release: {
    number: number;
    metadata: PluginRepoReleaseMetadata;
  };
};

type PluginRepoBase = {
  address: string;
  subdomain: string;
  current: PluginRepoCurrent;
  releases: PluginRepoRelease[];
};

type PluginRepoRelease = {
  release: number;
  metadata: string;
  builds: PluginRepoBuild[];
};

type PluginRepoBuild = {
  build: number;
  metadata: string;
};
export type PluginRepo = PluginRepoBase;
export type PluginRepoListItem = PluginRepoBase;

/* Deposits */
type DepositBaseParams = {
  daoAddressOrEns: string;
};

export type DepositEthParams = DepositBaseParams & {
  type: TokenType.NATIVE;
  amount: bigint;
};
export type DepositErc20Params = DepositBaseParams & {
  type: TokenType.ERC20;
  tokenAddress: string;
  amount: bigint;
};
export type DepositErc721Params = DepositBaseParams & {
  type: TokenType.ERC721;
  tokenAddress: string;
  tokenId: bigint;
};

export type DepositErc1155Params = DepositBaseParams & {
  type: TokenType.ERC1155;
  tokenAddress: string;
  tokenIds: bigint[];
  amounts: bigint[];
};

export type DepositParams =
  | DepositEthParams
  | DepositErc20Params
  | DepositErc721Params
  | DepositErc1155Params;

export enum DaoDepositSteps {
  CHECKED_ALLOWANCE = "checkedAllowance",
  DEPOSITING = "depositing",
  DONE = "done",
}

export type DaoDepositStepValue =
  | SetAllowanceStepValue
  | { key: DaoDepositSteps.CHECKED_ALLOWANCE; allowance: bigint }
  | { key: DaoDepositSteps.DEPOSITING; txHash: string }
  | {
    key: DaoDepositSteps.DONE;
    amount?: bigint;
    tokenId?: bigint;
    tokenIds?: bigint[];
    amounts?: bigint[];
  };

/* Withdrawals */
type WithdrawParamsBase = {
  recipientAddressOrEns: string;
};

type WithdrawEthParams = WithdrawParamsBase & {
  type: TokenType.NATIVE;
  amount: bigint;
};

type WithdrawErc20Params = WithdrawParamsBase & {
  type: TokenType.ERC20;
  amount: bigint;
  tokenAddress: string;
};

type WithdrawErc721Params = WithdrawParamsBase & {
  type: TokenType.ERC721;
  tokenAddress: string;
  tokenId: bigint;
  daoAddressOrEns: string;
};

type WithdrawErc1155Params = WithdrawParamsBase & {
  type: TokenType.ERC1155;
  daoAddressOrEns: string;
  tokenAddress: string;
  tokenIds: bigint[];
  amounts: bigint[];
};

export type WithdrawParams =
  | WithdrawEthParams
  | WithdrawErc20Params
  | WithdrawErc721Params
  | WithdrawErc1155Params;

/* Balances */
type AssetBalanceBase = {
  id: string;
  address: string;
  updateDate: Date;
};

type NativeAssetBalance = {
  id: string;
  type: TokenType.NATIVE;
  balance: bigint;
  updateDate: Date;
};
type Erc20AssetBalance = AssetBalanceBase & {
  type: TokenType.ERC20;
  balance: bigint;
  decimals: number;
  name: string;
  symbol: string;
};
type Erc721AssetBalance = AssetBalanceBase & {
  type: TokenType.ERC721;
  tokenIds: bigint[];
  name: string;
  symbol: string;
};

type Erc1155AssetBalance = AssetBalanceBase & {
  type: TokenType.ERC1155;
  balances: {
    id: string;
    tokenId: bigint;
    amount: bigint;
  }[];
  metadataUri: string;
};

export type DaoBalancesQueryParams = Pagination & {
  sortBy?: AssetBalanceSortBy;
  daoAddressOrEns?: string;
};
export enum AssetBalanceSortBy {
  LAST_UPDATED = "lastUpdated",
}

export type AssetBalance =
  | NativeAssetBalance
  | Erc20AssetBalance
  | Erc721AssetBalance
  | Erc1155AssetBalance;

/* Transfers */

type TokenTransferBase = {
  creationDate: Date;
  transactionId: string;
  to: string;
  from: string;
};

type TokenBase = {
  address: string;
  name: string;
  symbol: string;
};

type NativeTokenTransfer = TokenTransferBase & {
  tokenType: TokenType.NATIVE;
  amount: bigint;
};

type Erc721TokenTransfer = TokenTransferBase & {
  tokenType: TokenType.ERC721;
  token: TokenBase;
};

type Erc20TokenTransfer = TokenTransferBase & {
  tokenType: TokenType.ERC20;
  amount: bigint;
  token: TokenBase & {
    decimals: number;
  };
};

type Erc1155TokenTransfer = TokenTransferBase & {
  tokenType: TokenType.ERC1155;
  tokenId: bigint;
  token: {
    address: string;
  };
  amount: bigint;
};

export enum TransferType {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

export type Deposit =
  & (
    | NativeTokenTransfer
    | Erc20TokenTransfer
    | Erc721TokenTransfer
    | Erc1155TokenTransfer
  )
  & {
    type: TransferType.DEPOSIT;
  };

export type Withdraw =
  & (
    | NativeTokenTransfer
    | Erc20TokenTransfer
    | Erc721TokenTransfer
    | Erc1155TokenTransfer
  )
  & {
    type: TransferType.WITHDRAW;
    proposalId: string;
  };

export type TransferQueryParams = Pagination & {
  sortBy?: TransferSortBy;
  type?: TransferType;
  daoAddressOrEns?: string;
};
export enum TransferSortBy {
  CREATED_AT = "createdAt",
}

export type Transfer = Deposit | Withdraw;

/* Allowance */
export type SetAllowanceParams = {
  spender: string;
  amount: bigint;
  tokenAddress: string;
};

export enum SetAllowanceSteps {
  SETTING_ALLOWANCE = "settingAllowance",
  ALLOWANCE_SET = "allowanceSet",
}

export type SetAllowanceStepValue =
  | { key: SetAllowanceSteps.SETTING_ALLOWANCE; txHash: string }
  | { key: SetAllowanceSteps.ALLOWANCE_SET; allowance: bigint };

/* Permissions */
type PermissionParamsBase = {
  where: string;
  who: string;
  permission: string;
};
type PermissionDecodedParamsBase = PermissionParamsBase & {
  permissionId: string;
};
export type GrantPermissionParams = PermissionParamsBase;
export type RevokePermissionParams = PermissionParamsBase;
export type GrantPermissionDecodedParams = PermissionDecodedParamsBase;
export type RevokePermissionDecodedParams = PermissionDecodedParamsBase;

export type GrantPermissionWithConditionParams = PermissionParamsBase & {
  condition: string;
};
export type GrantPermissionWithConditionDecodedParams = PermissionParamsBase & {
  condition: string;
  permissionId: string;
};

export type HasPermissionParams = PermissionParamsBase & {
  daoAddressOrEns: string;
  data?: Uint8Array;
};

export type RegisterStandardCallbackParams = {
  interfaceId: string;
  callbackSelector: string;
  magicNumber: string;
};

export type UpgradeToAndCallParams = {
  implementationAddress: string;
  data: Uint8Array;
};

export type InitializeFromParams = {
  previousVersion: [number, number, number];
  initData?: Uint8Array;
};
export type DecodedInitializeFromParams = {
  previousVersion: [number, number, number];
  initData: Uint8Array;
};

export type PluginUpdateProposalValidity = {
  isValid: boolean;
  actionErrorCauses: PluginUpdateProposalInValidityCause[][];
  proposalSettingsErrorCauses: ProposalSettingsErrorCause[];
};

export enum ProposalSettingsErrorCause {
  NON_ZERO_ALLOW_FAILURE_MAP_VALUE = "nonZeroAllowFailureMapValue",
  INVALID_ACTIONS = "invalidActions",
  PROPOSAL_NOT_FOUND = "proposalNotFound",
}

export enum PluginUpdateProposalInValidityCause {
  // Grant UPDATE_PLUGIN_PERMISSION action
  INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_WHO_ADDRESS =
    "invalidGrantUpgradePluginPermissionWhoAddress",
  INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_WHERE_ADDRESS =
    "invalidGrantUpgradePluginPermissionWhereAddress",
  INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_PERMISSION_NAME =
    "invalidGrantUpgradePluginPermissionPermissionName",
  NON_ZERO_GRANT_UPGRADE_PLUGIN_PERMISSION_CALL_VALUE =
    "nonZeroGrantUpgradePluginPermissionCallValue",
  INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_PERMISSION_ID =
    "invalidGrantUpgradePluginPermissionPermissionId",
  INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_TO_ADDRESS =
    "invalidGrantUpgradePluginPermissionToAddress",

  // Revoke UPDATE_PLUGIN_PERMISSION action
  INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_WHO_ADDRESS =
    "invalidRevokeUpgradePluginPermissionWhoAddress",
  INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_WHERE_ADDRESS =
    "invalidRevokeUpgradePluginPermissionWhereAddress",
  INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_PERMISSION_NAME =
    "invalidRevokeUpgradePluginPermissionPermissionName",
  NON_ZERO_REVOKE_UPGRADE_PLUGIN_PERMISSION_CALL_VALUE =
    "nonZeroRevokeUpgradePluginPermissionCallValue",
  INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_PERMISSION_ID =
    "invalidRevokeUpgradePluginPermissionPermissionId",
  INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_TO_ADDRESS = 
    "invalidRevokeUpdatePluginPermissionToAddress",
  
  // Grant ROOT_PERMISSION action
  INVALID_GRANT_ROOT_PERMISSION_WHO_ADDRESS =
    "invalidGrantRootPermissionWhoAddress",
  INVALID_GRANT_ROOT_PERMISSION_WHERE_ADDRESS =
    "invalidGrantRootPermissionWhereAddress",
  INVALID_GRANT_ROOT_PERMISSION_PERMISSION_NAME =
    "invalidGrantRootPermissionPermissionName",
  NON_ZERO_GRANT_ROOT_PERMISSION_CALL_VALUE =
    "nonZeroGrantRootPermissionCallValue",
  INVALID_GRANT_ROOT_PERMISSION_PERMISSION_ID =
    "invalidGrantRootPermissionPermissionId",
  INVALID_GRANT_ROOT_PERMISSION_TO_ADDRESS = 
    "invalidGrantRootPermissionToAddress",
  // Revoke ROOT_PERMISSION action
  INVALID_REVOKE_ROOT_PERMISSION_WHO_ADDRESS =
    "invalidRevokeRootPermissionWhoAddress",
  INVALID_REVOKE_ROOT_PERMISSION_WHERE_ADDRESS =
    "invalidRevokeRootPermissionWhereAddress",
  INVALID_REVOKE_ROOT_PERMISSION_PERMISSION_NAME =
    "invalidRevokeRootPermissionPermissionName",
  NON_ZERO_REVOKE_ROOT_PERMISSION_CALL_VALUE =
    "nonZeroRevokeRootPermissionCallValue",
  INVALID_REVOKE_ROOT_PERMISSION_PERMISSION_ID =
    "invalidRevokeRootPermissionPermissionId",
  INVALID_REVOKE_ROOT_PERMISSION_TO_ADDRESS = 
    "invalidRevokeRootPermissionToAddress",
  // applyUpdate action
  NON_ZERO_APPLY_UPDATE_CALL_VALUE = "nonZeroApplyUpdateCallValue",
  PLUGIN_NOT_INSTALLED = "pluginNotInstalled",
  NOT_ARAGON_PLUGIN_REPO = "notAragonPluginRepo",
  MISSING_PLUGIN_REPO = "missingPluginRepo",
  MISSING_PLUGIN_PREPARATION = "missingPluginPreparation",
  UPDATE_TO_INCOMPATIBLE_RELEASE = "updateToIncompatibleRelease",
  UPDATE_TO_OLDER_OR_SAME_BUILD = "updateToOlderOrSameBuild",
  INVALID_DATA = "invalidData",
  INVALID_PLUGIN_REPO_METADATA = "invalidPluginRepoMetadata",
}

export enum DaoUpdateProposalInvalidityCause {
  NON_ZERO_CALL_VALUE = "nonZeroCallValue",
  INVALID_TO_ADDRESS = "invalidToAddress",
  INVALID_UPGRADE_TO_IMPLEMENTATION_ADDRESS =
    "invalidUpgradeToImplementationAddress",
  INVALID_UPGRADE_TO_AND_CALL_DATA = "invalidUpgradeToAndCallData",
  INVALID_UPGRADE_TO_AND_CALL_IMPLEMENTATION_ADDRESS =
    "invalidUpgradeToAndCallImplementationAddress",
  INVALID_UPGRADE_TO_AND_CALL_VERSION = "invalidUpgradeToAndCallVersion",
}

export type DaoUpdateProposalValidity = {
  isValid: boolean;
  actionErrorCauses: DaoUpdateProposalInvalidityCause[];
  proposalSettingsErrorCauses: ProposalSettingsErrorCause[];
};

export type DaoUpdateParams = InitializeFromParams & {
  daoFactoryAddress?: string;
};

export type DaoUpdateDecodedParams = InitializeFromParams & {
  implementationAddress: string;
};
export type PluginPreparationQueryParams = Pagination & {
  sortBy?: PluginPreparationSortBy;
  type?: PluginPreparationType;
  pluginAddress?: string;
  pluginRepoAddress?: string;
  daoAddressOrEns?: string;
};
export enum PluginPreparationType {
  INSTALLATION = "Installation",
  UPDATE = "Update",
  UNINSTALLATION = "Uninstallation",
}

export enum PluginPreparationSortBy {
  ID = "id",
}

export type PluginPreparationListItem = {
  id: string;
  type: PluginPreparationType;
  creator: string;
  dao: string;
  pluginRepo: {
    id: string;
    subdomain: string;
  };
  versionTag: {
    build: number;
    release: number;
  };
  pluginAddress: string;
  permissions: MultiTargetPermission[];
  helpers: string[];
  data: Uint8Array;
};
