import {
  AssetBalance,
  DaoDetails,
  DaoListItem,
  DaoMetadata,
  DaoUpdateProposalInvalidityCause,
  DaoUpdateProposalValidity,
  DecodedInitializeFromParams,
  DepositErc1155Params,
  DepositErc20Params,
  DepositErc721Params,
  DepositEthParams,
  GrantPermissionDecodedParams,
  GrantPermissionParams,
  GrantPermissionWithConditionDecodedParams,
  GrantPermissionWithConditionParams,
  InstalledPluginListItem,
  PluginPreparationListItem,
  PluginRepo,
  PluginRepoBuildMetadata,
  PluginRepoReleaseMetadata,
  PluginUpdateProposalInValidityCause,
  PluginUpdateProposalValidity,
  ProposalSettingsErrorCause,
  RevokePermissionDecodedParams,
  RevokePermissionParams,
  Transfer,
  TransferType,
  UpgradeToAndCallParams,
  WithdrawParams,
} from "../types";
import {
  ContractPermissionParams,
  ContractPermissionWithConditionParams,
  ProposalActionTypes,
  SubgraphBalance,
  SubgraphDao,
  SubgraphDaoListItem,
  SubgraphErc1155Balance,
  SubgraphErc1155TransferListItem,
  SubgraphErc20Balance,
  SubgraphErc20TransferListItem,
  SubgraphErc721Balance,
  SubgraphErc721TransferListItem,
  SubgraphNativeBalance,
  SubgraphNativeTransferListItem,
  SubgraphPluginInstallationListItem,
  SubgraphPluginListItem,
  SubgraphPluginPermissionOperation,
  SubgraphPluginPreparationListItem,
  SubgraphPluginRepo,
  SubgraphPluginRepoRelease,
  SubgraphPluginUpdatePreparation,
  SubgraphTransferListItem,
  SubgraphTransferType,
} from "./types";
import { defaultAbiCoder, Result } from "@ethersproject/abi";
import { keccak256 } from "@ethersproject/keccak256";
import { toUtf8Bytes } from "@ethersproject/strings";
import { AddressZero } from "@ethersproject/constants";
import {
  DAO__factory,
  PluginSetupProcessor,
  PluginSetupProcessor__factory,
} from "@aragon/osx-ethers";
import {
  ApplyInstallationParams,
  ApplyUninstallationParams,
  ApplyUpdateParams,
  bytesToHex,
  DaoAction,
  DecodedApplyInstallationParams,
  DecodedApplyUpdateParams,
  getFunctionFragment,
  getNamedTypesFromMetadata,
  hexToBytes,
  InterfaceParams,
  InvalidParameter,
  InvalidPermissionOperationType,
  MultiTargetPermission,
  MultiUri,
  NotImplementedError,
  PermissionIds,
  PermissionOperationType,
  Permissions,
  TokenType,
} from "@aragon/sdk-client-common";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { abi as ERC721_ABI } from "@openzeppelin/contracts/build/contracts/ERC721.json";
import { abi as ERC1155_ABI } from "@openzeppelin/contracts/build/contracts/ERC1155.json";
import { SubgraphAction } from "../client-common";
import {
  PLUGIN_UPDATE_ACTION_PATTERN,
  PLUGIN_UPDATE_WITH_ROOT_ACTION_PATTERN,
  PreparationType,
  SupportedPluginRepo,
  SupportedPluginRepoArray,
  UPDATE_PLUGIN_SIGNATURES,
} from "./constants";
import {
  DepositErc1155Schema,
  DepositErc20Schema,
  DepositErc721Schema,
  DepositEthSchema,
} from "./schemas";
import {
  IClientGraphQLCore,
  IClientIpfsCore,
} from "@aragon/sdk-client-common/dist/internal";
import {
  QueryDao,
  QueryPlugin,
  QueryPluginInstallations,
  QueryPluginPreparations,
} from "./graphql-queries";

export function unwrapDepositParams(
  params: DepositEthParams | DepositErc20Params,
): [string, bigint, string, string] {
  return [
    params.daoAddressOrEns,
    params.amount,
    (params as any)?.tokenAddress ?? AddressZero,
    "",
  ];
}

export function toDaoDetails(
  dao: SubgraphDao,
  metadata: DaoMetadata,
): DaoDetails {
  return {
    address: dao.id,
    ensDomain: dao.subdomain + ".dao.eth",
    metadata: {
      name: metadata.name,
      description: metadata.description,
      avatar: metadata.avatar || undefined,
      links: metadata.links,
    },
    metadataHash: dao.metadata,
    creationDate: new Date(parseInt(dao.createdAt) * 1000),
    // TODO update when new subgraph schema is deployed
    // filter out plugins that are not applied
    plugins: dao.plugins.filter(
      (plugin) =>
        plugin.appliedPreparation && plugin.appliedVersion &&
        plugin.appliedPluginRepo,
    )
      .map(
        (
          plugin: SubgraphPluginListItem,
        ): InstalledPluginListItem => (
          {
            // we checked with the filter above that these are not null
            id: `${plugin.appliedPluginRepo!.subdomain}.plugin.dao.eth`,
            release: plugin.appliedVersion!.release.release,
            build: plugin.appliedVersion!.build,
            instanceAddress: plugin.appliedPreparation!.pluginAddress,
          }
        ),
      ),
  };
}

export function toDaoListItem(
  dao: SubgraphDaoListItem,
  metadata: DaoMetadata,
): DaoListItem {
  return {
    address: dao.id,
    ensDomain: dao.subdomain + ".dao.eth",
    metadata: {
      name: metadata.name,
      description: metadata.description,
      avatar: metadata.avatar || undefined,
    },
    metadataHash: dao.metadata,
    plugins: dao.plugins.filter(
      (plugin) =>
        plugin.appliedPreparation && plugin.appliedVersion &&
        plugin.appliedPluginRepo,
    )
      .map(
        (
          plugin: SubgraphPluginListItem,
        ): InstalledPluginListItem => (
          {
            // we checked with the filter above that these are not null
            id: `${plugin.appliedPluginRepo!.subdomain}.plugin.dao.eth`,
            release: plugin.appliedVersion!.release.release,
            build: plugin.appliedVersion!.build,
            instanceAddress: plugin.appliedPreparation!.pluginAddress,
          }
        ),
      ),
  };
}

function toNativeBalance(balance: SubgraphNativeBalance): AssetBalance {
  return {
    id: balance.id,
    type: TokenType.NATIVE,
    balance: BigInt(balance.balance),
    updateDate: new Date(parseInt(balance.lastUpdated) * 1000),
  };
}

function toErc20Balance(balance: SubgraphErc20Balance): AssetBalance {
  return {
    id: balance.id,
    type: TokenType.ERC20,
    address: balance.token.id,
    name: balance.token.name,
    symbol: balance.token.symbol,
    decimals: balance.token.decimals,
    balance: BigInt(balance.balance),
    updateDate: new Date(parseInt(balance.lastUpdated) * 1000),
  };
}

function toErc721Balance(balance: SubgraphErc721Balance): AssetBalance {
  return {
    id: balance.id,
    type: TokenType.ERC721,
    address: balance.token.id,
    name: balance.token.name,
    symbol: balance.token.symbol,
    updateDate: new Date(parseInt(balance.lastUpdated) * 1000),
    tokenIds: balance.tokenIds.map((id) => BigInt(id)),
  };
}
function toErc1155Balance(balance: SubgraphErc1155Balance): AssetBalance {
  return {
    id: balance.id,
    type: TokenType.ERC1155,
    address: balance.token.id,
    metadataUri: balance.metadataUri,
    updateDate: new Date(parseInt(balance.lastUpdated) * 1000),
    balances: balance.balances.map((balance) => ({
      tokenId: BigInt(balance.tokenId),
      amount: BigInt(balance.amount),
      id: balance.id,
    })),
  };
}

export function toAssetBalance(balance: SubgraphBalance): AssetBalance {
  switch (balance.__typename) {
    case "NativeBalance":
      return toNativeBalance(balance);
    case "ERC20Balance":
      return toErc20Balance(balance);
    case "ERC721Balance":
      return toErc721Balance(balance);
    case "ERC1155Balance":
      return toErc1155Balance(balance);
    default:
      throw new InvalidParameter("Token type not supported");
  }
}

function toErc20Transfer(
  transfer: SubgraphErc20TransferListItem,
): Transfer {
  const creationDate = new Date(parseInt(transfer.createdAt) * 1000);
  if (transfer.type === SubgraphTransferType.DEPOSIT) {
    return {
      type: TransferType.DEPOSIT,
      tokenType: TokenType.ERC20,
      token: {
        address: transfer.token.id,
        name: transfer.token.name,
        symbol: transfer.token.symbol,
        decimals: transfer.token.decimals,
      },
      amount: BigInt(transfer.amount),
      creationDate,
      transactionId: transfer.txHash,
      from: transfer.from,
      to: transfer.to,
    };
  }
  return {
    type: TransferType.WITHDRAW,
    tokenType: TokenType.ERC20,
    token: {
      address: transfer.token.id,
      name: transfer.token.name,
      symbol: transfer.token.symbol,
      decimals: transfer.token.decimals,
    },
    amount: BigInt(transfer.amount),
    creationDate,
    transactionId: transfer.txHash,
    to: transfer.to,
    from: transfer.from,
    proposalId: transfer.proposal?.id || "",
  };
}

function toErc721Transfer(
  transfer: SubgraphErc721TransferListItem,
): Transfer {
  const creationDate = new Date(parseInt(transfer.createdAt) * 1000);
  if (transfer.type === SubgraphTransferType.DEPOSIT) {
    return {
      type: TransferType.DEPOSIT,
      tokenType: TokenType.ERC721,
      token: {
        address: transfer.token.id,
        name: transfer.token.name,
        symbol: transfer.token.symbol,
      },
      creationDate,
      transactionId: transfer.txHash,
      from: transfer.from,
      to: transfer.to,
    };
  }
  return {
    type: TransferType.WITHDRAW,
    tokenType: TokenType.ERC721,
    token: {
      address: transfer.token.id,
      name: transfer.token.name,
      symbol: transfer.token.symbol,
    },
    creationDate,
    transactionId: transfer.txHash,
    to: transfer.to,
    from: transfer.from,
    proposalId: transfer.proposal?.id || "",
  };
}

function toErc1155Transfer(
  transfer: SubgraphErc1155TransferListItem,
): Transfer {
  const creationDate = new Date(parseInt(transfer.createdAt) * 1000);
  if (transfer.type === SubgraphTransferType.DEPOSIT) {
    return {
      type: TransferType.DEPOSIT,
      tokenType: TokenType.ERC1155,
      amount: BigInt(transfer.amount),
      tokenId: BigInt(transfer.tokenId),
      token: {
        address: transfer.token.id,
      },
      creationDate,
      transactionId: transfer.txHash,
      from: transfer.from,
      to: transfer.to,
    };
  }
  return {
    type: TransferType.WITHDRAW,
    tokenType: TokenType.ERC1155,
    amount: BigInt(transfer.amount),
    tokenId: BigInt(transfer.tokenId),
    token: {
      address: transfer.token.id,
    },
    creationDate,
    transactionId: transfer.txHash,
    proposalId: transfer.proposal?.id || "",
    to: transfer.to,
    from: transfer.from,
  };
}

function toNativeTransfer(
  transfer: SubgraphNativeTransferListItem,
): Transfer {
  const creationDate = new Date(parseInt(transfer.createdAt) * 1000);
  if (transfer.type === SubgraphTransferType.DEPOSIT) {
    return {
      type: TransferType.DEPOSIT,
      tokenType: TokenType.NATIVE,
      amount: BigInt(transfer.amount),
      creationDate,
      transactionId: transfer.txHash,
      from: transfer.from,
      to: transfer.to,
    };
  }
  return {
    type: TransferType.WITHDRAW,
    tokenType: TokenType.NATIVE,
    amount: BigInt(transfer.amount),
    creationDate,
    transactionId: transfer.txHash,
    proposalId: transfer.proposal?.id || "",
    to: transfer.to,
    from: transfer.from,
  };
}

export function toTokenTransfer(transfer: SubgraphTransferListItem): Transfer {
  switch (transfer.__typename) {
    case "ERC20Transfer":
      return toErc20Transfer(transfer);
    case "ERC721Transfer":
      return toErc721Transfer(transfer);
    case "NativeTransfer":
      return toNativeTransfer(transfer);
    case "ERC1155Transfer":
      return toErc1155Transfer(transfer);
    default:
      throw new InvalidParameter("Token type not supported");
  }
}

export function toPluginRepo(
  pluginRepo: SubgraphPluginRepo,
  releaseMetadata: PluginRepoReleaseMetadata,
  buildMetadata: PluginRepoBuildMetadata,
): PluginRepo {
  return {
    address: pluginRepo.id,
    subdomain: pluginRepo.subdomain,
    releases: pluginRepo.releases.map((release) => ({
      release: release.release,
      metadata: release.metadata,
      builds: release.builds.map((build) => ({
        build: build.build,
        metadata: build.metadata,
      })),
    })),
    current: {
      build: {
        metadata: buildMetadata,
        // the subgraph returns only one build ordered by build number
        // in descending order, this means it's the latest build
        number: pluginRepo.releases?.[0]?.builds?.[0]?.build,
      },
      release: {
        metadata: releaseMetadata,
        // the subgraph returns only one release ordered by release number
        // in descending order, this means it's the latest release
        number: pluginRepo.releases?.[0]?.release,
      },
    },
  };
}

export function applyInstallatonParamsToContract(
  params: ApplyInstallationParams,
): PluginSetupProcessor.ApplyInstallationParamsStruct {
  return {
    plugin: params.pluginAddress,
    pluginSetupRef: {
      pluginSetupRepo: params.pluginRepo,
      versionTag: params.versionTag,
    },
    helpersHash: keccak256(
      defaultAbiCoder.encode(["address[]"], [params.helpers]),
    ),
    permissions: params.permissions.map((permission) => {
      return { ...permission, condition: permission.condition || AddressZero };
    }),
  };
}
export function applyUninstallationParamsToContract(
  params: ApplyUninstallationParams,
): PluginSetupProcessor.ApplyUninstallationParamsStruct {
  return {
    plugin: params.pluginAddress,
    pluginSetupRef: {
      pluginSetupRepo: params.pluginRepo,
      versionTag: params.versionTag,
    },
    permissions: params.permissions.map((permission) => {
      return { ...permission, condition: permission.condition || AddressZero };
    }),
  };
}
export function applyInstallatonParamsFromContract(
  result: Result,
): DecodedApplyInstallationParams {
  const params = result[1];
  return {
    helpersHash: params.helpersHash,
    permissions: params.permissions,
    versionTag: params.pluginSetupRef.versionTag,
    pluginAddress: params.plugin,
    pluginRepo: params.pluginSetupRef.pluginSetupRepo,
  };
}
export function applyUpdateParamsToContract(
  params: ApplyUpdateParams,
): PluginSetupProcessor.ApplyUpdateParamsStruct {
  return {
    plugin: params.pluginAddress,
    pluginSetupRef: {
      pluginSetupRepo: params.pluginRepo,
      versionTag: params.versionTag,
    },
    initData: params.initData,
    helpersHash: keccak256(
      defaultAbiCoder.encode(["address[]"], [params.helpers]),
    ),
    permissions: params.permissions.map((permission) => {
      return { ...permission, condition: permission.condition || AddressZero };
    }),
  };
}
export function applyUpdateParamsFromContract(
  result: Result,
): DecodedApplyUpdateParams {
  const params = result[1];
  return {
    helpersHash: params.helpersHash,
    permissions: params.permissions,
    versionTag: params.pluginSetupRef.versionTag,
    pluginAddress: params.plugin,
    pluginRepo: params.pluginSetupRef.pluginSetupRepo,
    initData: hexToBytes(params.initData),
  };
}

export function permissionParamsToContract(
  params: GrantPermissionParams | RevokePermissionParams,
): ContractPermissionParams {
  return [params.where, params.who, keccak256(toUtf8Bytes(params.permission))];
}
export function permissionWithConditionParamsToContract(
  params: GrantPermissionWithConditionParams,
): ContractPermissionWithConditionParams {
  return [
    ...permissionParamsToContract({
      who: params.who,
      where: params.where,
      permission: params.permission,
    }),
    params.condition,
  ];
}

export function permissionParamsFromContract(
  result: Result,
): GrantPermissionDecodedParams | RevokePermissionDecodedParams {
  return {
    where: result[0],
    who: result[1],
    permissionId: result[2],
    permission: Object.keys(PermissionIds)
      .find((k) => PermissionIds[k] === result[2])
      ?.replace(/_ID$/, "") || "",
  };
}
export function permissionParamsWitConditionFromContract(
  result: Result,
): GrantPermissionWithConditionDecodedParams {
  return {
    ...permissionParamsFromContract(result),
    condition: result[3],
  };
}

export function withdrawParamsFromContract(
  to: string,
  _value: bigint,
  result: Result,
  tokenStandard: TokenType,
  isBatch: boolean,
): WithdrawParams {
  switch (tokenStandard) {
    case TokenType.ERC20:
      return {
        type: TokenType.ERC20,
        tokenAddress: to,
        recipientAddressOrEns: result[0],
        amount: BigInt(result[1]),
      };
    case TokenType.ERC721:
      return {
        type: TokenType.ERC721,
        tokenAddress: to,
        recipientAddressOrEns: result[1],
        tokenId: BigInt(result[2]),
        daoAddressOrEns: result[0],
      };
    case TokenType.ERC1155:
      let tokenIds: bigint[], amounts: bigint[];
      if (isBatch) {
        tokenIds = result[2].map((id: string) => BigInt(id));
        amounts = result[3].map((amount: string) => BigInt(amount));
      } else {
        tokenIds = [BigInt(result[2])];
        amounts = [BigInt(result[3])];
      }
      return {
        type: TokenType.ERC1155,
        tokenAddress: to,
        recipientAddressOrEns: result[1],
        tokenIds,
        amounts,
        daoAddressOrEns: result[0],
      };
  }
  throw new NotImplementedError("Token standard not supported");
}

export async function estimateNativeDeposit(
  signer: Signer,
  params: DepositEthParams,
): Promise<BigNumber> {
  await DepositEthSchema.strict().validate(params);
  const daoInstance = DAO__factory.connect(params.daoAddressOrEns, signer);
  return await daoInstance.estimateGas.deposit(
    AddressZero,
    params.amount,
    "",
  );
}

export async function estimateErc20Deposit(
  signer: Signer,
  params: DepositErc20Params,
): Promise<BigNumber> {
  await DepositErc20Schema.strict().validate(params);
  const daoInstance = DAO__factory.connect(params.daoAddressOrEns, signer);
  return await daoInstance.estimateGas.deposit(
    params.tokenAddress,
    params.amount,
    "",
  );
}

export async function estimateErc721Deposit(
  signer: Signer,
  params: DepositErc721Params,
): Promise<BigNumber> {
  await DepositErc721Schema.strict().validate(params);
  const erc721Contract = new Contract(
    params.tokenAddress,
    ERC721_ABI,
    signer,
  );
  return erc721Contract.estimateGas
    ["safeTransferFrom(address,address,uint256)"](
      await signer.getAddress(),
      params.daoAddressOrEns,
      params.tokenId,
    );
}

export async function estimateErc1155Deposit(
  signer: Signer,
  params: DepositErc1155Params,
): Promise<BigNumber> {
  await DepositErc1155Schema.strict().validate(params);
  const erc1155Contract = new Contract(
    params.tokenAddress,
    ERC1155_ABI,
    signer,
  );
  let estimation: BigNumber;
  if (params.tokenIds.length === 1) {
    estimation = await erc1155Contract.estimateGas
      ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        await signer.getAddress(),
        params.daoAddressOrEns,
        params.tokenIds[0],
        params.amounts[0],
        new Uint8Array(0),
      );
  } else {
    estimation = await erc1155Contract.estimateGas
      ["safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)"](
        await signer.getAddress(),
        params.daoAddressOrEns,
        params.tokenIds,
        params.amounts,
        new Uint8Array(0),
      );
  }
  return estimation;
}

export function decodeGrantAction(
  data: Uint8Array,
): GrantPermissionDecodedParams {
  const daoInterface = DAO__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = daoInterface.getFunction("grant");
  const result = daoInterface.decodeFunctionData(expectedFunction, hexBytes);
  return permissionParamsFromContract(result);
}
export function decodeRevokeAction(
  data: Uint8Array,
): RevokePermissionDecodedParams {
  const daoInterface = DAO__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = daoInterface.getFunction("revoke");
  const result = daoInterface.decodeFunctionData(expectedFunction, hexBytes);
  return permissionParamsFromContract(result);
}

export function decodeApplyUpdateAction(
  data: Uint8Array,
): DecodedApplyUpdateParams {
  const pspInterface = PluginSetupProcessor__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = pspInterface.getFunction("applyUpdate");
  const result = pspInterface.decodeFunctionData(expectedFunction, hexBytes);
  return applyUpdateParamsFromContract(result);
}

export function findInterface(
  data: Uint8Array,
  functionSignatures: string[],
): InterfaceParams | null {
  try {
    const func = getFunctionFragment(data, functionSignatures);
    return {
      id: func.format("minimal"),
      functionName: func.name,
      hash: bytesToHex(data).substring(0, 10),
    };
  } catch {
    return null;
  }
}

export function findActionIndex(
  actions: DaoAction[],
  functionSignature: string,
): number {
  for (const [index, action] of actions.entries()) {
    const iface = findInterface(action.data, [functionSignature]);
    if (iface) {
      return index;
    }
  }
  return -1;
}

export function toDaoActions(actions: SubgraphAction[]): DaoAction[] {
  return actions.map((action) => ({
    to: action.to,
    value: BigInt(action.value),
    data: hexToBytes(action.data),
  }));
}

export function hashPermissions(permissions: MultiTargetPermission[]) {
  return keccak256(
    defaultAbiCoder.encode(
      ["tuple(uint8,address,address,address,bytes32)[]"],
      [permissions],
    ),
  );
}

export function getPreparedSetupId(
  params: DecodedApplyInstallationParams | DecodedApplyUpdateParams,
  preparationType: PreparationType,
) {
  return keccak256(
    defaultAbiCoder.encode(
      [
        "tuple(uint8, uint16)",
        "address",
        "bytes32",
        "bytes32",
        "bytes32",
        "uint8",
      ],
      [
        [params.versionTag.release, params.versionTag.build],
        params.pluginRepo,
        hashPermissions(params.permissions),
        params.helpersHash,
        keccak256(new Uint8Array()), // there is no data so we pass an empty uint8Array
        preparationType,
      ],
    ),
  );
}

export function decodeUpgradeToAndCallAction(
  data: Uint8Array,
): UpgradeToAndCallParams {
  const daoInterface = DAO__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = daoInterface.getFunction(
    "upgradeToAndCall",
  );
  const result = daoInterface.decodeFunctionData(expectedFunction, hexBytes);
  return {
    implementationAddress: result[0],
    data: hexToBytes(result[1]),
  };
}

export function decodeUpgradeToAction(
  data: Uint8Array,
) {
  const daoInterface = DAO__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = daoInterface.getFunction(
    "upgradeTo",
  );
  const result = daoInterface.decodeFunctionData(expectedFunction, hexBytes);
  return result[0];
}

export function decodeInitializeFromAction(
  data: Uint8Array,
): DecodedInitializeFromParams {
  const daoInterface = DAO__factory.createInterface();
  const hexBytes = bytesToHex(data);
  const expectedFunction = daoInterface.getFunction(
    "initializeFrom",
  );
  const result = daoInterface.decodeFunctionData(expectedFunction, hexBytes);
  return {
    previousVersion: result[0],
    initData: hexToBytes(result[1]),
  };
}

export function toPluginPreparationListItem(
  pluginPreparation: SubgraphPluginPreparationListItem,
): PluginPreparationListItem {
  return {
    id: pluginPreparation.id,
    type: pluginPreparation.type,
    creator: pluginPreparation.creator,
    dao: pluginPreparation.dao.id,
    pluginRepo: pluginPreparation.pluginRepo,
    versionTag: {
      build: pluginPreparation.pluginVersion.build,
      release: pluginPreparation.pluginVersion.release.release,
    },
    pluginAddress: pluginPreparation.pluginAddress,
    permissions: pluginPreparation.permissions.map((permission) => ({
      id: permission.id,
      operation: toPluginPermissionOperationType(permission.operation),
      who: permission.who,
      where: permission.where,
      condition: permission.condition,
      permissionId: permission.permissionId,
    })),
    helpers: pluginPreparation.helpers,
    data: hexToBytes(pluginPreparation.data),
  };
}

export function toPluginPermissionOperationType(
  operation: SubgraphPluginPermissionOperation,
): PermissionOperationType {
  switch (operation) {
    case SubgraphPluginPermissionOperation.GRANT:
      return PermissionOperationType.GRANT;
    case SubgraphPluginPermissionOperation.REVOKE:
      return PermissionOperationType.REVOKE;
    case SubgraphPluginPermissionOperation.GRANT_WITH_CONDITION:
      return PermissionOperationType.GRANT_WITH_CONDITION;
    default:
      throw new InvalidPermissionOperationType();
  }
}

// function that compares 2 generic arrays
// and returns true if they are equal
// and false if they are not
export function compareArrays<T>(array1: T[], array2: T[]): boolean {
  return JSON.stringify(array1) === JSON.stringify(array2);
}
async function getPluginInstallations(
  daoAddress: string,
  pluginAddress: string,
  graphql: IClientGraphQLCore,
): Promise<SubgraphPluginInstallationListItem[]> {
  const name = "pluginInstallations";
  type U = { pluginInstallations: SubgraphPluginInstallationListItem[] };
  const query = QueryPluginInstallations;
  const params = {
    where: {
      plugin: pluginAddress.toLowerCase(),
      dao: daoAddress.toLowerCase(),
    },
  };
  const res = await graphql.request<U>({
    query,
    params,
    name,
  });
  const { pluginInstallations } = res;
  return pluginInstallations;
}
export async function validateGrantUpgradePluginPermissionAction(
  action: DaoAction,
  pspAddress: string,
  daoAddress: string,
  graphql: IClientGraphQLCore,
): Promise<PluginUpdateProposalInValidityCause[]> {
  const causes: PluginUpdateProposalInValidityCause[] = [];
  // decode the action
  const decodedPermission = decodeGrantAction(action.data);
  // retrieve the plugin installations from subgraph
  // with the same plugin address and the specified
  // dao address
  const pluginInstallations = await getPluginInstallations(
    daoAddress,
    decodedPermission.where,
    graphql,
  );
  // if the plugin installations length is 0 means that
  // that the address in the where field is not a plugin
  // or is not installed in the specified dao
  if (pluginInstallations.length === 0) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .PLUGIN_NOT_INSTALLED,
    );
  }
  // Value must be 0
  if (action.value.toString() !== "0") {
    causes.push(
      PluginUpdateProposalInValidityCause
        .NON_ZERO_GRANT_UPGRADE_PLUGIN_PERMISSION_CALL_VALUE,
    );
  }
  // The action should be sent to the DAO
  if (action.to !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_TO_ADDRESS,
    );
  }

  // The permission should be granted to the PSP
  if (decodedPermission.who !== pspAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_WHO_ADDRESS,
    );
  }
  // The permission should be `UPGRADE_PLUGIN_PERMISSION`
  if (
    decodedPermission.permission !== Permissions.UPGRADE_PLUGIN_PERMISSION
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_PERMISSION_NAME,
    );
  }
  // The permissionId should be `UPGRADE_PLUGIN_PERMISSION_ID`
  if (
    decodedPermission.permissionId !==
      PermissionIds.UPGRADE_PLUGIN_PERMISSION_ID
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_UPGRADE_PLUGIN_PERMISSION_PERMISSION_ID,
    );
  }
  return causes;
}

export async function validateRevokeUpgradePluginPermissionAction(
  action: DaoAction,
  pspAddress: string,
  daoAddress: string,
  graphql: IClientGraphQLCore,
): Promise<PluginUpdateProposalInValidityCause[]> {
  const causes: PluginUpdateProposalInValidityCause[] = [];
  const decodedPermission = decodeRevokeAction(action.data);
  const pluginInstallations = await getPluginInstallations(
    daoAddress,
    decodedPermission.where,
    graphql,
  );
  if (pluginInstallations.length === 0) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .PLUGIN_NOT_INSTALLED,
    );
  }
  // The action should be sent to the DAO
  if (action.to !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_TO_ADDRESS,
    );
  }
  if (action.value.toString() !== "0") {
    causes.push(
      PluginUpdateProposalInValidityCause
        .NON_ZERO_REVOKE_UPGRADE_PLUGIN_PERMISSION_CALL_VALUE,
    );
  }
  if (decodedPermission.who !== pspAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_WHO_ADDRESS,
    );
  }
  if (
    decodedPermission.permission !== Permissions.UPGRADE_PLUGIN_PERMISSION
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_PERMISSION_NAME,
    );
  }
  if (
    decodedPermission.permissionId !==
      PermissionIds.UPGRADE_PLUGIN_PERMISSION_ID
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_UPGRADE_PLUGIN_PERMISSION_PERMISSION_ID,
    );
  }
  return causes;
}
export function validateGrantRootPermissionAction(
  action: DaoAction,
  daoAddress: string,
  pspAddress: string,
): PluginUpdateProposalInValidityCause[] {
  const causes: PluginUpdateProposalInValidityCause[] = [];
  const decodedPermission = decodeGrantAction(action.data);
  if (action.value.toString() !== "0") {
    causes.push(
      PluginUpdateProposalInValidityCause
        .NON_ZERO_GRANT_ROOT_PERMISSION_CALL_VALUE,
    );
  }
  // The action should be sent to the DAO
  // both come from subgraph so they are already lowercase
  if (action.to !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_ROOT_PERMISSION_TO_ADDRESS,
    );
  }
  // decodedPermission.where is checksummed so we need to lowercase it
  // to compare it with the daoAddress because it comes from the subgraph
  if (decodedPermission.where.toLowerCase() !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_ROOT_PERMISSION_WHERE_ADDRESS,
    );
  }
  if (decodedPermission.who !== pspAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_ROOT_PERMISSION_WHO_ADDRESS,
    );
  }
  if (
    decodedPermission.permission !== Permissions.ROOT_PERMISSION
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_ROOT_PERMISSION_PERMISSION_NAME,
    );
  }
  if (
    decodedPermission.permissionId !==
      PermissionIds.ROOT_PERMISSION_ID
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_GRANT_ROOT_PERMISSION_PERMISSION_ID,
    );
  }
  return causes;
}
export function validateRevokeRootPermissionAction(
  action: DaoAction,
  daoAddress: string,
  pspAddress: string,
): PluginUpdateProposalInValidityCause[] {
  const causes: PluginUpdateProposalInValidityCause[] = [];
  const decodedPermission = decodeRevokeAction(action.data);
  if (action.value.toString() !== "0") {
    causes.push(
      PluginUpdateProposalInValidityCause
        .NON_ZERO_REVOKE_ROOT_PERMISSION_CALL_VALUE,
    );
  }
  // The action should be sent to the DAO
  if (action.to !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_ROOT_PERMISSION_TO_ADDRESS,
    );
  }
  if (decodedPermission.where !== daoAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_ROOT_PERMISSION_WHERE_ADDRESS,
    );
  }
  if (decodedPermission.who !== pspAddress) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_ROOT_PERMISSION_WHO_ADDRESS,
    );
  }
  if (
    decodedPermission.permission !== Permissions.ROOT_PERMISSION
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_ROOT_PERMISSION_PERMISSION_NAME,
    );
  }
  if (
    decodedPermission.permissionId !==
      PermissionIds.ROOT_PERMISSION_ID
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause
        .INVALID_REVOKE_ROOT_PERMISSION_PERMISSION_ID,
    );
  }
  return causes;
}
/**
 * Validate a plugin update proposal
 *
 * @export
 * @param {DaoAction} action
 * @param {string} daoAddress
 * @param {IClientGraphQLCore} graphql
 * @param {IClientIpfsCore} ipfs
 * @return {Promise<PluginUpdateProposalInValidityCause[]>}
 */
export async function validateApplyUpdateFunction(
  action: DaoAction,
  daoAddress: string,
  graphql: IClientGraphQLCore,
  ipfs: IClientIpfsCore,
): Promise<PluginUpdateProposalInValidityCause[]> {
  const causes: PluginUpdateProposalInValidityCause[] = [];
  if (action.value.toString() !== "0") {
    causes.push(
      PluginUpdateProposalInValidityCause.NON_ZERO_APPLY_UPDATE_CALL_VALUE,
    );
  }
  const decodedParams = decodeApplyUpdateAction(
    action.data,
  );
  // get dao with plugins
  type U = { dao: SubgraphDao };
  const { dao } = await graphql.request<U>({
    query: QueryDao,
    params: { address: daoAddress },
    name: "dao",
  });
  // find the plugin with the same address
  const plugin = dao.plugins.find((plugin) =>
    plugin.appliedPreparation?.pluginAddress ===
      decodedParams.pluginAddress.toLowerCase()
  );
  if (!plugin) {
    causes.push(PluginUpdateProposalInValidityCause.PLUGIN_NOT_INSTALLED);
    return causes;
  }
  // check release is the same as the one installed
  if (
    plugin.appliedVersion?.release.release !==
      decodedParams.versionTag.release
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause.UPDATE_TO_INCOMPATIBLE_RELEASE,
    );
  }
  // check build is higher than the one installed
  if (
    !plugin.appliedVersion?.build ||
    plugin.appliedVersion?.build >=
      decodedParams.versionTag.build
  ) {
    causes.push(
      PluginUpdateProposalInValidityCause.UPDATE_TO_OLDER_OR_SAME_BUILD,
    );
  }
  // check if plugin repo (pluginSetupRepo) exist
  type V = { pluginRepo: SubgraphPluginRepo };
  const { pluginRepo } = await graphql.request<V>({
    query: QueryPlugin,
    params: { id: decodedParams.pluginRepo.toLowerCase() },
    name: "pluginRepo",
  });
  if (!pluginRepo) {
    causes.push(PluginUpdateProposalInValidityCause.MISSING_PLUGIN_REPO);
    return causes;
  }
  // check if is one of the aragon plugin repos
  if (
    !SupportedPluginRepoArray.includes(
      pluginRepo.subdomain as SupportedPluginRepo,
    )
  ) {
    causes.push(PluginUpdateProposalInValidityCause.NOT_ARAGON_PLUGIN_REPO);
  }

  // get the prepared setup id
  const preparedSetupId = getPreparedSetupId(
    decodedParams,
    PreparationType.UPDATE,
  );
  // get plugin preparation
  type W = { pluginPreparations: SubgraphPluginUpdatePreparation[] };
  const { pluginPreparations } = await graphql.request<W>({
    query: QueryPluginPreparations,
    params: {
      where: {
        preparedSetupId: preparedSetupId.toLowerCase(),
        pluginAddress: decodedParams.pluginAddress.toLowerCase(),
      },
    },
    name: "pluginPreparations",
  });
  if (!pluginPreparations.length) {
    causes.push(
      PluginUpdateProposalInValidityCause.MISSING_PLUGIN_PREPARATION,
    );
    return causes;
  }
  // get the metadata of the plugin repo
  // for the release and build specified
  const release = pluginRepo.releases.find((
    release: SubgraphPluginRepoRelease,
  ) => release.release === decodedParams.versionTag.release);
  const build = release?.builds.find((
    build: { build: number; metadata: string },
  ) => build.build === decodedParams.versionTag.build);
  if (!build) {
    causes.push(
      PluginUpdateProposalInValidityCause.INVALID_PLUGIN_REPO_METADATA,
    );
    return causes;
  }
  const metadataUri = build.metadata;

  // fetch the metadata
  const metadataCid = new MultiUri(metadataUri).ipfsCid;
  const metadata = await ipfs.fetchString(metadataCid!);
  const metadataJson = JSON.parse(metadata);
  // Due to an human error the build metadata on the plugins
  // was not correct on the first release of the plugin repos
  // this is on chain so we cannot change it and we need to
  // handle it here. So we check if the metadata has the fields
  // for the fixed metadata and if it does not we try with the
  // old metadata fields
  // Original PR: https://github.com/aragon/osx/pull/375
  // Fix PR: https://github.com/aragon/osx/pull/481
  let updateAbi = [];
  updateAbi = metadataJson?.pluginSetup?.prepareUpdate
    ?.[plugin.appliedVersion?.build!]?.inputs;
  if (!updateAbi) {
    updateAbi = metadataJson?.pluginSetup?.prepareInstallation?.prepareUpdate
      ?.[plugin.appliedVersion?.build!]?.inputs;
  }
  // get the update abi for the specified build
  if (updateAbi) {
    try {
      if (
        decodedParams.initData.length > 0 &&
        updateAbi.length === 0
      ) {
        throw new Error();
      }
      // if the decode does not throw an error the data is valid
      defaultAbiCoder.decode(
        getNamedTypesFromMetadata(updateAbi),
        decodedParams.initData,
      );
    } catch {
      // if the decode throws an error the data is invalid
      causes.push(
        PluginUpdateProposalInValidityCause.INVALID_DATA,
      );
    }
  } else {
    causes.push(
      PluginUpdateProposalInValidityCause.INVALID_PLUGIN_REPO_METADATA,
    );
  }
  return causes;
}

/**
 * Given a list of actions, it decodes the actions and returns the
 * type of action
 *
 * @export
 * @param {DaoAction[]} actions
 * @return {ProposalActionTypes[]}
 */
export function classifyProposalActions(
  actions: DaoAction[],
): ProposalActionTypes[] {
  const classifiedActions: ProposalActionTypes[] = [];

  for (const action of actions) {
    try {
      let decodedPermission:
        | GrantPermissionDecodedParams
        | RevokePermissionDecodedParams;
      const func = getFunctionFragment(action.data, UPDATE_PLUGIN_SIGNATURES);
      switch (func.name) {
        case "upgradeTo":
          classifiedActions.push(ProposalActionTypes.UPGRADE_TO);
          break;
        case "upgradeToAndCall":
          classifiedActions.push(ProposalActionTypes.UPGRADE_TO_AND_CALL);
          break;
        case "grant":
          decodedPermission = decodeGrantAction(action.data);
          // check the permission that is being granted
          switch (decodedPermission.permission) {
            case Permissions.UPGRADE_PLUGIN_PERMISSION:
              classifiedActions.push(
                ProposalActionTypes.GRANT_PLUGIN_UPGRADE_PERMISSION,
              );
              break;
            case Permissions.ROOT_PERMISSION:
              classifiedActions.push(
                ProposalActionTypes.GRANT_ROOT_PERMISSION,
              );
              break;
            default:
              classifiedActions.push(
                ProposalActionTypes.UNKNOWN,
              );
              break;
          }
          break;
        case "revoke":
          decodedPermission = decodeRevokeAction(action.data);
          // check the permission that is being granted
          switch (decodedPermission.permission) {
            case Permissions.UPGRADE_PLUGIN_PERMISSION:
              classifiedActions.push(
                ProposalActionTypes.REVOKE_PLUGIN_UPGRADE_PERMISSION,
              );
              break;
            case Permissions.ROOT_PERMISSION:
              classifiedActions.push(
                ProposalActionTypes.REVOKE_ROOT_PERMISSION,
              );
              break;
            default:
              classifiedActions.push(
                ProposalActionTypes.UNKNOWN,
              );
              break;
          }
          break;
        case "applyUpdate":
          classifiedActions.push(ProposalActionTypes.APPLY_UPDATE);
          break;
        default:
          classifiedActions.push(ProposalActionTypes.ACTION_NOT_ALLOWED);
          break;
      }
    } catch {
      classifiedActions.push(ProposalActionTypes.UNKNOWN);
    }
  }
  return classifiedActions;
}

/**
 * Returns true if the actions are valid for a plugin update proposal with root permission
 *
 * @export
 * @param {ProposalActionTypes[]} actions
 * @return {boolean}
 */
export function containsPluginUpdateActionBlockWithRootPermission(
  actions: ProposalActionTypes[],
): boolean {
  // get the first 5 actions
  const receivedPattern = actions.slice(0, 5);
  // check if it matches the expected pattern
  // length should be 5
  return receivedPattern.length === 5 &&
    compareArrays(receivedPattern, PLUGIN_UPDATE_WITH_ROOT_ACTION_PATTERN);
}

/**
 * Returns true if the actions are valid for a plugin update proposal without root permission
 *
 * @export
 * @param {ProposalActionTypes[]} actions
 * @return {boolean}
 */
export function containsPluginUpdateActionBlock(
  actions: ProposalActionTypes[],
): boolean {
  // get the first 3 action
  const receivedPattern = actions.slice(0, 3);
  // check if it matches the expected pattern
  // length should be 3
  return receivedPattern.length === 3 &&
    compareArrays(receivedPattern, PLUGIN_UPDATE_ACTION_PATTERN);
}
/**
 * Returns true if the actions are valid for a plugin update proposal
 *
 * @export
 * @param {ProposalActionTypes[]} actions
 * @return {boolean}
 */
export function startsWithDaoUpdateAction(
  actions: ProposalActionTypes[],
): boolean {
  // UpgradeTo or UpgradeToAndCall should be the first action
  return actions[0] === ProposalActionTypes.UPGRADE_TO ||
    actions[0] === ProposalActionTypes.UPGRADE_TO_AND_CALL;
}

export function validateUpdateDaoProposalActions(
  actions: DaoAction[],
  daoAddress: string,
  expectedImplementationAddress: string,
  currentDaoVersion: [number, number, number],
): DaoUpdateProposalValidity {
  const classifiedActions = classifyProposalActions(actions);
  const actionErrorCauses: DaoUpdateProposalInvalidityCause[] = [];
  const proposalSettingsErrorCauses: ProposalSettingsErrorCause[] = [];
  // check if the actions are valid
  if (!startsWithDaoUpdateAction(classifiedActions)) {
    // If actions are not valid, add the cause to the causes array
    // and return
    return {
      isValid: false,
      proposalSettingsErrorCauses: [ProposalSettingsErrorCause.INVALID_ACTIONS],
      actionErrorCauses: [],
    };
  }
  // if they are valid, this means that
  // the upgrade action must be the first one
  const upgradeActionType = classifiedActions[0];
  const upgradeAction = actions[0];
  // if the to address is not the dao address
  // add the cause to the causes array
  if (upgradeAction.to !== daoAddress) {
    actionErrorCauses.push(
      DaoUpdateProposalInvalidityCause.INVALID_TO_ADDRESS,
    );
  }
  // if the value is different from 0
  // add the cause to the causes array
  if (upgradeAction.value.toString() !== "0") {
    actionErrorCauses.push(
      DaoUpdateProposalInvalidityCause.NON_ZERO_CALL_VALUE,
    );
  }
  switch (upgradeActionType) {
    case ProposalActionTypes.UPGRADE_TO:
      // decode the upgradeTo action
      const decodedImplementationAddress = decodeUpgradeToAction(
        actions[0].data,
      );
      // check that the implementation address is the same
      if (expectedImplementationAddress !== decodedImplementationAddress) {
        actionErrorCauses.push(
          DaoUpdateProposalInvalidityCause
            .INVALID_UPGRADE_TO_IMPLEMENTATION_ADDRESS,
        );
      }
      break;
    case ProposalActionTypes.UPGRADE_TO_AND_CALL: // decode the action
      const upgradeToAndCallDecodedParams = decodeUpgradeToAndCallAction(
        actions[0].data,
      );
      // the call data should be the initializeFrom function encoded
      // so we decode the initialize from function
      const initializeFromDecodedParams = decodeInitializeFromAction(
        upgradeToAndCallDecodedParams.data,
      );
      // check that the implementation address is the same as specified
      // in the upgradeToAndCall action
      if (
        expectedImplementationAddress !==
          upgradeToAndCallDecodedParams.implementationAddress
      ) {
        actionErrorCauses.push(
          DaoUpdateProposalInvalidityCause
            .INVALID_UPGRADE_TO_AND_CALL_IMPLEMENTATION_ADDRESS,
        );
      }
      // check that the current version version of the dao is the same
      // as the one specified as previous version in the initializeFrom function
      if (
        JSON.stringify(initializeFromDecodedParams.previousVersion) !==
          JSON.stringify(currentDaoVersion)
      ) {
        actionErrorCauses.push(
          DaoUpdateProposalInvalidityCause.INVALID_UPGRADE_TO_AND_CALL_VERSION,
        );
      }

      // For now, we check that the `bytes calldata _initData` parameter of the `initializeFrom` function call is empty (because updates related to 1.0.0, 1.3.0, or 1.4.0 don't require `_initData`).
      // TODO For future upgrade requiring non-empty `_initData`, we must define a place to obtain this information from permissionlessly.
      if (initializeFromDecodedParams.initData.length !== 0) {
        actionErrorCauses.push(
          DaoUpdateProposalInvalidityCause.INVALID_UPGRADE_TO_AND_CALL_DATA,
        );
      }
      break;
    default:
      proposalSettingsErrorCauses.push(
        ProposalSettingsErrorCause.INVALID_ACTIONS,
      );
      break;
  }
  // return the validity of the proposal
  return {
    isValid: actionErrorCauses.length === 0 &&
      proposalSettingsErrorCauses.length === 0,
    actionErrorCauses,
    proposalSettingsErrorCauses,
  };
}

export async function validateUpdatePluginProposalActions(
  actions: DaoAction[],
  daoAddress: string,
  pspAddress: string,
  graphql: IClientGraphQLCore,
  ipfs: IClientIpfsCore,
): Promise<PluginUpdateProposalValidity> {
  // Declare variables
  let actionErrorCauses: PluginUpdateProposalInValidityCause[][] = [];
  let resCauses: PluginUpdateProposalInValidityCause[];
  let proposalSettingsErrorCauses: ProposalSettingsErrorCause[] = [];
  const classifiedActions = classifyProposalActions(actions);
  // check if is an update plugin proposal
  if (containsPluginUpdateActionBlock(classifiedActions)) {
    // initialize the causes array
    // we always use the index 0
    // because this is going to be called recursively
    // and then joined
    actionErrorCauses[0] = [];
    // iterate over the first 3 actions actions
    for (const [index, action] of classifiedActions.slice(0, 3).entries()) {
      switch (action) {
        // if the action is grant plugin update permission
        // validate the action
        case ProposalActionTypes.GRANT_PLUGIN_UPGRADE_PERMISSION:
          resCauses = await validateGrantUpgradePluginPermissionAction(
            actions[index],
            pspAddress,
            daoAddress,
            graphql,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is revoke plugin update permission
          // validate the action
        case ProposalActionTypes.REVOKE_PLUGIN_UPGRADE_PERMISSION:
          resCauses = await validateRevokeUpgradePluginPermissionAction(
            actions[index],
            pspAddress,
            daoAddress,
            graphql,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is grant root permission
          // validate the action
        case ProposalActionTypes.APPLY_UPDATE:
          resCauses = await validateApplyUpdateFunction(
            actions[index],
            daoAddress,
            graphql,
            ipfs,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // other cases are not allowed and should have been
          // caught by the containsPluginUpdateActionBlock function
      }
    }
    // slice the first 3 actions
    // because they have already been validated
    // and recursively call the function
    actions = actions.slice(3);
    if (actions.length !== 0) {
      // recursively call the function
      const recCauses = await validateUpdatePluginProposalActions(
        actions,
        daoAddress,
        pspAddress,
        graphql,
        ipfs,
      );
      // join the causes
      actionErrorCauses = [
        ...actionErrorCauses,
        ...recCauses.actionErrorCauses,
      ];
      proposalSettingsErrorCauses = [
        ...proposalSettingsErrorCauses,
        ...recCauses.proposalSettingsErrorCauses,
      ];
    }
    return {
      // every item in the array should be empty
      isValid: actionErrorCauses.every((cause) => cause.length === 0) &&
        proposalSettingsErrorCauses.length === 0,
      actionErrorCauses,
      proposalSettingsErrorCauses,
    };
  }

  if (containsPluginUpdateActionBlockWithRootPermission(classifiedActions)) {
    // initialize the causes array
    // we always use the index 0
    // because this is going to be called recursively
    // and then joined
    actionErrorCauses[0] = [];
    // iterate over the first 5 actions actions
    for (const [index, action] of classifiedActions.slice(0, 5).entries()) {
      switch (action) {
        // if the action is grant plugin update permission
        // validate the action
        case ProposalActionTypes.GRANT_PLUGIN_UPGRADE_PERMISSION:
          resCauses = await validateGrantUpgradePluginPermissionAction(
            actions[index],
            pspAddress,
            daoAddress,
            graphql,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is revoke plugin update permission
          // validate the action
        case ProposalActionTypes.REVOKE_PLUGIN_UPGRADE_PERMISSION:
          resCauses = await validateRevokeUpgradePluginPermissionAction(
            actions[index],
            pspAddress,
            daoAddress,
            graphql,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is grant root permission
          // validate the action
        case ProposalActionTypes.GRANT_ROOT_PERMISSION:
          resCauses = validateGrantRootPermissionAction(
            actions[index],
            daoAddress,
            pspAddress,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is revoke root permission
          // validate the action

        case ProposalActionTypes.REVOKE_ROOT_PERMISSION:
          resCauses = validateRevokeRootPermissionAction(
            actions[index],
            daoAddress,
            pspAddress,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;
          // if the action is apply update
          // validate the action
        case ProposalActionTypes.APPLY_UPDATE:
          resCauses = await validateApplyUpdateFunction(
            actions[index],
            daoAddress,
            graphql,
            ipfs,
          );
          actionErrorCauses[0] = [...actionErrorCauses[0], ...resCauses];
          break;

          // other cases are not allowed and should have been
          // caught by the containsPluginUpdateActionBlockWithRootPermission function
      }
    }
    // slice the first 5 actions
    // because they have already been validated
    actions = actions.slice(5);
    if (actions.length !== 0) {
      // recursively call the function
      const recCauses = await validateUpdatePluginProposalActions(
        actions,
        daoAddress,
        pspAddress,
        graphql,
        ipfs,
      );
      // join the causes
      actionErrorCauses = [
        ...actionErrorCauses,
        ...recCauses.actionErrorCauses,
      ];
      proposalSettingsErrorCauses = [
        ...proposalSettingsErrorCauses,
        ...recCauses.proposalSettingsErrorCauses,
      ];
    }
    return {
      // every item in the array should be empty
      isValid: actionErrorCauses.every((cause) => cause.length === 0) &&
        proposalSettingsErrorCauses.length === 0,
      actionErrorCauses,
      proposalSettingsErrorCauses,
    };
  }
  // add invalid actions to the causes array
  // return, if this is inside the recursion
  // it will be added to the array
  return {
    isValid: false,
    proposalSettingsErrorCauses: [ProposalSettingsErrorCause.INVALID_ACTIONS],
    actionErrorCauses: actionErrorCauses,
  };
}

export function toSubgraphActions(actions: DaoAction[]): SubgraphAction[] {
  return actions.map((action) => ({
    to: action.to,
    value: action.value.toString(),
    data: bytesToHex(action.data),
  }));
}
