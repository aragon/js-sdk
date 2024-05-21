import {
  DAO__factory,
  DAOFactory,
  DAOFactory__factory,
  DAORegistry__factory,
  IProtocolVersion__factory,
  PluginRepo__factory,
  PluginSetupProcessor__factory,
} from "@aragon/osx-ethers";
// HEAD

//
//079ce5f1 (merge common packages and deprecate sdk-common)
import { defaultAbiCoder } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { abi as ERC721_ABI } from "@openzeppelin/contracts/build/contracts/ERC721.json";
import { abi as ERC1155_ABI } from "@openzeppelin/contracts/build/contracts/ERC1155.json";
import {
  QueryDao,
  QueryDaos,
  QueryIPlugin,
  QueryIProposal,
  QueryPlugin,
  QueryPluginPreparationsExtended,
  QueryPlugins,
  QueryTokenBalances,
  QueryTokenTransfers,
} from "../graphql-queries";
import {
  AssetBalance,
  AssetBalanceSortBy,
  CreateDaoParams,
  DaoBalancesQueryParams,
  DaoCreationSteps,
  DaoCreationStepValue,
  DaoDepositSteps,
  DaoDepositStepValue,
  DaoDetails,
  DaoListItem,
  DaoMetadata,
  DaoQueryParams,
  DaoSortBy,
  DaoUpdateProposalValidity,
  DepositErc1155Params,
  DepositErc20Params,
  DepositErc721Params,
  DepositEthParams,
  DepositParams,
  HasPermissionParams,
  PluginPreparationListItem,
  PluginPreparationQueryParams,
  PluginPreparationSortBy,
  PluginQueryParams,
  PluginRepo,
  PluginRepoBuildMetadata,
  PluginRepoListItem,
  PluginRepoReleaseMetadata,
  PluginSortBy,
  PluginUpdateProposalValidity,
  ProposalSettingsErrorCause,
  SetAllowanceParams,
  SetAllowanceSteps,
  SetAllowanceStepValue,
  Transfer,
  TransferQueryParams,
  TransferSortBy,
} from "../../types";
import {
  ProposalActionTypes,
  SubgraphBalance,
  SubgraphDao,
  SubgraphDaoListItem,
  SubgraphIProposal,
  SubgraphPluginInstallation,
  SubgraphPluginPreparationListItem,
  SubgraphPluginRepo,
  SubgraphPluginRepoListItem,
  SubgraphTransferListItem,
  SubgraphTransferTypeMap,
} from "../types";
import {
  classifyProposalActions,
  startsWithDaoUpdateAction,
  toAssetBalance,
  toDaoActions,
  toDaoDetails,
  toDaoListItem,
  toPluginPreparationListItem,
  toPluginRepo,
  toTokenTransfer,
  validateUpdateDaoProposalActions,
  validateUpdatePluginProposalActions,
} from "../utils";
import { isAddress } from "@ethersproject/address";
import { toUtf8Bytes } from "@ethersproject/strings";
import { id } from "@ethersproject/hash";
import {
  EMPTY_BUILD_METADATA_LINK,
  EMPTY_DAO_METADATA_LINK,
  EMPTY_RELEASE_METADATA_LINK,
  UNAVAILABLE_BUILD_METADATA,
  UNAVAILABLE_DAO_METADATA,
  UNAVAILABLE_RELEASE_METADATA,
  UNSUPPORTED_BUILD_METADATA_LINK,
  UNSUPPORTED_DAO_METADATA_LINK,
  UNSUPPORTED_RELEASE_METADATA_LINK,
} from "../constants";
import { IClientMethods } from "../interfaces";
import {
  AddressOrEnsSchema,
  AmountMismatchError,
  ClientCore,
  DaoCreationError,
  EmptyMultiUriError,
  FailedDepositError,
  findLog,
  getExtendedProposalId,
  InstallationNotFoundError,
  InvalidAddressOrEnsError,
  InvalidCidError,
  IpfsPinError,
  MissingExecPermissionError,
  MULTI_FETCH_TIMEOUT,
  MultiTargetPermission,
  NoProviderError,
  NotImplementedError,
  PermissionIds,
  PluginUninstallationPreparationError,
  prepareGenericInstallation,
  prepareGenericUpdate,
  PrepareInstallationParams,
  PrepareInstallationSchema,
  PrepareInstallationStepValue,
  PrepareUninstallationParams,
  PrepareUninstallationSchema,
  PrepareUninstallationSteps,
  PrepareUninstallationStepValue,
  PrepareUpdateParams,
  PrepareUpdateStepValue,
  promiseWithTimeout,
  resolveIpfsCid,
  SortDirection,
  TokenType,
  UpdateAllowanceError,
} from "@aragon/sdk-client-common";
import {
  CreateDaoSchema,
  DaoBalancesQuerySchema,
  DaoMetadataSchema,
  DaoQuerySchema,
  DepositErc1155Schema,
  DepositErc20Schema,
  DepositErc721Schema,
  DepositEthSchema,
  HasPermissionSchema,
  PluginPreparationQuerySchema,
  PluginQuerySchema,
} from "../schemas";
import {
  contracts,
  FrameworkContractsNames,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

/**
 * Methods module the SDK Generic Client
 */
export class ClientMethods extends ClientCore implements IClientMethods {
  public async *prepareInstallation(
    params: PrepareInstallationParams,
  ): AsyncGenerator<PrepareInstallationStepValue> {
    await PrepareInstallationSchema.strict().validate(params);
    yield* prepareGenericInstallation(this.web3, {
      ...params,
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }
  /**
   * Creates a DAO with the given settings and plugins

   * @param {CreateDaoParams} params
   * @return {AsyncGenerator<DaoCreationStepValue>}
   * @memberof ClientMethods
   */
  public async *createDao(
    params: CreateDaoParams,
  ): AsyncGenerator<DaoCreationStepValue> {
    await CreateDaoSchema.strict().validate(params);
    const signer = this.web3.getConnectedSigner();

    const daoFactoryInstance = DAOFactory__factory.connect(
      this.web3.getAddress(FrameworkContractsNames.DAO_FACTORY),
      signer,
    );

    const pluginInstallationData: DAOFactory.PluginSettingsStruct[] = [];
    for (const plugin of params.plugins) {
      const repo = PluginRepo__factory.connect(plugin.id, signer);

      const currentRelease = await repo.latestRelease();
      const latestVersion = await repo["getLatestVersion(uint8)"](
        currentRelease,
      );
      pluginInstallationData.push({
        pluginSetupRef: {
          pluginSetupRepo: repo.address,
          versionTag: latestVersion.tag,
        },
        data: plugin.data,
      });
    }

    // check if at least one plugin requests EXECUTE_PERMISSION on the DAO
    // This check isn't 100% correct all the time
    // simulate the DAO creation to get an address
    const pluginSetupProcessorAddr = await daoFactoryInstance
      .pluginSetupProcessor();
    const pluginSetupProcessor = PluginSetupProcessor__factory.connect(
      pluginSetupProcessorAddr,
      signer,
    );
    let execPermissionFound = false;

    // using the DAO base because it reflects a newly created DAO the best
    const daoBaseAddr = await daoFactoryInstance.daoBase();
    // simulates each plugin installation seperately to get the requested permissions
    for (const installData of pluginInstallationData) {
      const pluginSetupProcessorResponse = await pluginSetupProcessor.callStatic
        .prepareInstallation(daoBaseAddr, installData);
      const found = pluginSetupProcessorResponse[1].permissions.find(
        (permission) =>
          permission.permissionId === PermissionIds.EXECUTE_PERMISSION_ID,
      );
      if (found) {
        execPermissionFound = true;
        break;
      }
    }

    if (!execPermissionFound) {
      throw new MissingExecPermissionError();
    }

    const tx = await daoFactoryInstance.connect(signer).createDao(
      {
        subdomain: params.ensSubdomain ?? "",
        metadata: toUtf8Bytes(params.metadataUri),
        daoURI: params.daoUri ?? "",
        trustedForwarder: params.trustedForwarder ?? AddressZero,
      },
      pluginInstallationData,
    );

    yield {
      key: DaoCreationSteps.CREATING,
      txHash: tx.hash,
    };
    // start tx
    const receipt = await tx.wait();
    const daoFactoryInterface = DAORegistry__factory.createInterface();
    // find dao address using the dao registry address
    const log = receipt.logs?.find(
      (e) =>
        e.topics[0] ===
          id(daoFactoryInterface.getEvent("DAORegistered").format("sighash")),
    );

    if (!log) {
      throw new DaoCreationError();
    }

    // Plugin logs
    const pspInterface = PluginSetupProcessor__factory.createInterface();
    const installedLogs = receipt.logs?.filter(
      (e) =>
        e.topics[0] ===
          id(pspInterface.getEvent("InstallationApplied").format("sighash")),
    );

    // DAO logs
    const parsedLog = daoFactoryInterface.parseLog(log);
    if (!parsedLog.args["dao"]) {
      throw new DaoCreationError();
    }

    yield {
      key: DaoCreationSteps.DONE,
      address: parsedLog.args["dao"],
      pluginAddresses: installedLogs.map(
        (log) => pspInterface.parseLog(log).args[1],
      ),
    };
  }
  /**
   * Pins a metadata object into IPFS and retruns the generated hash
   *
   * @param {DaoMetadata} params
   * @return {Promise<string>}
   * @memberof ClientMethods
   */
  public async pinMetadata(params: DaoMetadata): Promise<string> {
    await DaoMetadataSchema.strict().validate(params);
    try {
      const cid = await this.ipfs.add(JSON.stringify(params));
      await this.ipfs.pin(cid);
      return `ipfs://${cid}`;
    } catch (e) {
      throw new IpfsPinError(e);
    }
  }
  /**
   * Deposits ether or an ERC20 token into the DAO
   *
   * @param {DepositParams} params
   * @return {AsyncGenerator<DaoDepositStepValue>}
   * @memberof ClientMethods
   */
  public async *deposit(
    params: DepositParams,
  ): AsyncGenerator<DaoDepositStepValue> {
    switch (params.type) {
      case TokenType.NATIVE:
        yield* this.depositNative(params);
        break;
      case TokenType.ERC20:
        yield* this.depositErc20(params);
        break;
      case TokenType.ERC721:
        yield* this.depositErc721(params);
        break;
      case TokenType.ERC1155:
        yield* this.depositErc1155(params);
        break;
      default:
        throw new NotImplementedError(
          "Token type not valid, use transfer function instead",
        );
    }
  }

  private async *depositNative(
    params: DepositEthParams,
  ): AsyncGenerator<DaoDepositStepValue> {
    await DepositEthSchema.strict().validate(params);
    const signer = this.web3.getConnectedSigner();
    const { daoAddressOrEns, amount } = params;
    const override: { value?: bigint } = { value: params.amount };
    const daoInstance = DAO__factory.connect(daoAddressOrEns, signer);

    const tx = await daoInstance.deposit(
      AddressZero,
      amount,
      "",
      override,
    );
    yield { key: DaoDepositSteps.DEPOSITING, txHash: tx.hash };

    const cr = await tx.wait();
    const log = findLog(cr, daoInstance.interface, "Deposited");
    if (!log) {
      throw new FailedDepositError();
    }

    const daoInterface = DAO__factory.createInterface();
    const parsedLog = daoInterface.parseLog(log);

    if (!amount.toString() === parsedLog.args["amount"]) {
      throw new AmountMismatchError(
        amount,
        parsedLog.args["amount"].toBigInt(),
      );
    }
    yield { key: DaoDepositSteps.DONE, amount: amount };
  }

  private async *depositErc20(
    params: DepositErc20Params,
  ): AsyncGenerator<DaoDepositStepValue> {
    await DepositErc20Schema.strict().validate(params);
    const signer = this.web3.getConnectedSigner();
    const { tokenAddress, daoAddressOrEns, amount } = params;
    // check current allowance
    const tokenContract = new Contract(
      tokenAddress,
      ERC20_ABI,
      signer,
    );
    const currentAllowance = await tokenContract.allowance(
      await signer.getAddress(),
      daoAddressOrEns,
    );
    yield {
      key: DaoDepositSteps.CHECKED_ALLOWANCE,
      allowance: currentAllowance.toBigInt(),
    };
    // if its lower than the needed, set it to the correct one
    if (currentAllowance.lt(params.amount)) {
      // If the target is an ERC20 token, ensure that the amount can be transferred
      // Relay the yield steps to the caller as they are received
      yield* this.setAllowance(
        {
          amount: params.amount,
          spender: params.daoAddressOrEns,
          tokenAddress: params.tokenAddress,
        },
      );
    }
    // Doing the transfer
    const daoInstance = DAO__factory.connect(daoAddressOrEns, signer);

    const tx = await daoInstance.deposit(
      tokenAddress,
      amount,
      "",
    );
    yield { key: DaoDepositSteps.DEPOSITING, txHash: tx.hash };

    const cr = await tx.wait();
    const log = findLog(cr, daoInstance.interface, "Deposited");
    if (!log) {
      throw new FailedDepositError();
    }

    const daoInterface = DAO__factory.createInterface();
    const parsedLog = daoInterface.parseLog(log);

    if (!amount.toString() === parsedLog.args["amount"]) {
      throw new AmountMismatchError(
        amount,
        parsedLog.args["amount"].toBigInt(),
      );
    }
    yield { key: DaoDepositSteps.DONE, amount: amount };
  }

  private async *depositErc721(
    params: DepositErc721Params,
  ): AsyncGenerator<DaoDepositStepValue> {
    await DepositErc721Schema.strict().validate(params) as DepositErc721Params;
    const signer = this.web3.getConnectedSigner();
    const erc721Contract = new Contract(
      params.tokenAddress,
      ERC721_ABI,
      signer,
    );
    const tx = await erc721Contract
      ["safeTransferFrom(address,address,uint256)"](
        await signer.getAddress(),
        params.daoAddressOrEns,
        params.tokenId,
      );

    const cr = await tx.wait();

    const log = findLog(cr, erc721Contract.interface, "Transfer");

    if (!log) {
      throw new FailedDepositError();
    }

    const parsedLog = erc721Contract.interface.parseLog(log);
    if (
      !parsedLog.args["tokenId"] ||
      parsedLog.args["tokenId"].toString() !== params.tokenId.toString()
    ) {
      throw new FailedDepositError();
    }
    yield {
      key: DaoDepositSteps.DONE,
      tokenId: params.tokenId,
    };
  }

  private async *depositErc1155(
    params: DepositErc1155Params,
  ): AsyncGenerator<DaoDepositStepValue> {
    await DepositErc1155Schema.strict().validate(params);
    const signer = this.web3.getConnectedSigner();
    const erc1155Contract = new Contract(
      params.tokenAddress,
      ERC1155_ABI,
      signer,
    );

    let tx: ContractTransaction, logName: string, logArg: string;
    if (params.tokenIds.length === 1) {
      tx = await erc1155Contract
        ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
          await signer.getAddress(),
          params.daoAddressOrEns,
          params.tokenIds[0],
          params.amounts[0],
          new Uint8Array([]),
        );
      logName = "TransferSingle";
      logArg = "id";
    } else {
      tx = await erc1155Contract
        ["safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)"](
          await signer.getAddress(),
          params.daoAddressOrEns,
          params.tokenIds,
          params.amounts,
          new Uint8Array([]),
        );
      logName = "TransferBatch";
      logArg = "ids";
    }

    const cr = await tx.wait();

    const log = findLog(cr, erc1155Contract.interface, logName);

    if (!log) {
      throw new FailedDepositError();
    }

    const parsedLog = erc1155Contract.interface.parseLog(log);
    if (
      !parsedLog.args[logArg] ||
      parsedLog.args[logArg].toString() !== params.tokenIds.toString()
    ) {
      throw new FailedDepositError();
    }
    yield {
      key: DaoDepositSteps.DONE,
      tokenIds: params.tokenIds,
      amounts: params.amounts,
    };
  }

  /**
   * Checks if the allowance is enough and updates it
   *
   * @param {SetAllowanceParams} params
   * @return {AsyncGenerator<SetAllowanceStepValue>}
   * @memberof ClientMethods
   */
  public async *setAllowance(
    params: SetAllowanceParams,
  ): AsyncGenerator<SetAllowanceStepValue> {
    const signer = this.web3.getConnectedSigner();
    // TODO
    // add params check with yup
    const tokenInstance = new Contract(
      params.tokenAddress,
      ERC20_ABI,
      signer,
    );
    const tx: ContractTransaction = await tokenInstance.approve(
      params.spender,
      params.amount,
    );

    yield {
      key: SetAllowanceSteps.SETTING_ALLOWANCE,
      txHash: tx.hash,
    };

    const cr = await tx.wait();
    const log = findLog(cr, tokenInstance.interface, "Approval");

    if (!log) {
      throw new UpdateAllowanceError();
    }
    const value = log.data;
    if (!value || BigNumber.from(params.amount).gt(BigNumber.from(value))) {
      throw new UpdateAllowanceError();
    }

    yield {
      key: SetAllowanceSteps.ALLOWANCE_SET,
      allowance: params.amount,
    };
  }
  /**
   * Prepare uninstallation of a plugin
   *
   * @param {PrepareUninstallationParams} params
   * @return {AsyncGenerator<PrepareUninstallationStepValue>}
   * @memberof ClientMethods
   */
  public async *prepareUninstallation(
    params: PrepareUninstallationParams,
  ): AsyncGenerator<PrepareUninstallationStepValue> {
    await PrepareUninstallationSchema.strict().validate(
      params,
    );
    const signer = this.web3.getConnectedSigner();
    type T = {
      iplugin: { installations: SubgraphPluginInstallation[] };
    };
    const { iplugin } = await this.graphql.request<T>({
      query: QueryIPlugin,
      params: {
        address: params.pluginAddress.toLowerCase(),
        where: { dao: params.daoAddressOrEns.toLowerCase() },
      },
      name: "plugin",
    });

    // filter specified installation
    const { pluginInstallationIndex = 0 } = params;
    const selectedInstallation = iplugin.installations[pluginInstallationIndex];
    if (!selectedInstallation) {
      throw new InstallationNotFoundError();
    }
    // encode uninstallation params
    const { uninstallationParams = [], uninstallationAbi = [] } = params;
    const data = defaultAbiCoder.encode(
      uninstallationAbi,
      uninstallationParams,
    );
    // connect to psp contract
    const pspContract = PluginSetupProcessor__factory.connect(
      this.web3.getAddress(FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR),
      signer,
    );
    const tx = await pspContract.prepareUninstallation(
      params.daoAddressOrEns,
      {
        pluginSetupRef: {
          pluginSetupRepo:
            selectedInstallation.appliedPreparation.pluginRepo.id,
          versionTag: {
            build: selectedInstallation.appliedVersion.build,
            release: selectedInstallation.appliedVersion.release.release,
          },
        },
        setupPayload: {
          plugin: params.pluginAddress,
          currentHelpers: selectedInstallation.appliedPreparation.helpers,
          data,
        },
      },
    );
    yield {
      key: PrepareUninstallationSteps.PREPARING,
      txHash: tx.hash,
    };
    const cr = await tx.wait();

    const log = findLog(cr, pspContract.interface, "UninstallationPrepared");
    if (!log) {
      throw new PluginUninstallationPreparationError();
    }
    const parsedLog = pspContract.interface.parseLog(log);
    const permissions = parsedLog.args["permissions"];
    if (!permissions) {
      throw new PluginUninstallationPreparationError();
    }
    yield {
      key: PrepareUninstallationSteps.DONE,
      permissions: permissions.map((permission: MultiTargetPermission) => ({
        operation: permission.operation,
        where: permission.where,
        who: permission.who,
        permissionId: permission.permissionId,
      })),
      pluginRepo: selectedInstallation.appliedPreparation.pluginRepo.id,
      pluginAddress: params.pluginAddress,
      versionTag: {
        build: selectedInstallation.appliedVersion.build,
        release: selectedInstallation.appliedVersion.release.release,
      },
    };
  }
  /**
   * Prepare update of a plugin
   *
   * @param {PrepareUpdateParams} params
   * @return {AsyncGenerator<PrepareUpdateStepValue>}
   * @memberof ClientMethods
   */
  public async *prepareUpdate(
    params: PrepareUpdateParams,
  ): AsyncGenerator<PrepareUpdateStepValue> {
    yield* prepareGenericUpdate(
      this.web3,
      this.graphql,
      {
        ...params,
        pluginSetupProcessorAddress: this.web3.getAddress(
          FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
        ),
      },
    );
  }
  /**
   * Checks whether a role is granted by the current DAO's ACL settings
   *
   * @param {HasPermissionParams} params
   * @return {Promise<boolean>}
   * @memberof ClientMethods
   */
  public async hasPermission(params: HasPermissionParams): Promise<boolean> {
    await HasPermissionSchema.strict().validate(params);
    const provider = this.web3.getProvider();
    // connect to the managing dao
    const daoInstance = DAO__factory.connect(params.daoAddressOrEns, provider);
    return daoInstance.hasPermission(
      params.where,
      params.who,
      id(params.permission),
      params.data || new Uint8Array([]),
    );
  }
  /**
   * Retrieves metadata for DAO with given identifier (address or ens domain)
   *
   * @param {string} daoAddressOrEns
   * @return {(Promise<DaoDetails | null>)}
   * @memberof ClientMethods
   */
  public async getDao(daoAddressOrEns: string): Promise<DaoDetails | null> {
    await AddressOrEnsSchema.strict().validate(daoAddressOrEns);
    let address = daoAddressOrEns.toLowerCase();
    if (!isAddress(address)) {
      await this.web3.ensureOnline();
      const provider = this.web3.getProvider();
      if (!provider) {
        throw new NoProviderError();
      }
      try {
        const resolvedAddress = await provider.resolveName(address);
        if (!resolvedAddress) {
          throw new InvalidAddressOrEnsError();
        }
        address = resolvedAddress.toLowerCase();
      } catch (e) {
        throw new InvalidAddressOrEnsError(e);
      }
    }
    const query = QueryDao;
    const params = { address };
    const name = "DAO";
    type T = { dao: SubgraphDao };
    const { dao } = await this.graphql.request<T>({ query, params, name });
    if (!dao) {
      return null;
    } else if (!dao.metadata) {
      return toDaoDetails(
        dao,
        EMPTY_DAO_METADATA_LINK,
      );
    }
    try {
      const metadataCid = resolveIpfsCid(dao.metadata);
      const metadataString = await this.ipfs.fetchString(metadataCid);
      const metadata = JSON.parse(metadataString) as DaoMetadata;
      return toDaoDetails(dao, metadata);
    } catch (err) {
      if (err instanceof InvalidCidError) {
        return toDaoDetails(dao, UNSUPPORTED_DAO_METADATA_LINK);
      }
      return toDaoDetails(dao, UNAVAILABLE_DAO_METADATA);
    }
  }
  /**
   * Retrieves metadata for DAO with given identifier (address or ens domain)
   *
   * @param {DaoQueryParams} params
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = DaoSortBy.CREATED_AT
   * @return {Promise<DaoListItem[]>}
   * @memberof ClientMethods
   */
  public async getDaos({
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = DaoSortBy.CREATED_AT,
  }: DaoQueryParams): Promise<DaoListItem[]> {
    await DaoQuerySchema.strict().validate({
      limit,
      skip,
      direction,
      sortBy,
    });
    const query = QueryDaos;
    const params = {
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "DAOs";
    type T = { daos: SubgraphDaoListItem[] };
    const { daos } = await this.graphql.request<T>({ query, params, name });
    return Promise.all(
      daos.map(
        async (dao: SubgraphDaoListItem): Promise<DaoListItem> => {
          if (!dao.metadata) {
            return toDaoListItem(
              dao,
              EMPTY_DAO_METADATA_LINK,
            );
          }
          try {
            const metadataCid = resolveIpfsCid(dao.metadata);
            // Avoid blocking Promise.all if this individual fetch takes too long
            const stringMetadata = await promiseWithTimeout(
              this.ipfs.fetchString(metadataCid),
              MULTI_FETCH_TIMEOUT,
            );
            const metadata = JSON.parse(stringMetadata);
            return toDaoListItem(dao, metadata);
          } catch (err) {
            if (err instanceof InvalidCidError) {
              return toDaoListItem(dao, UNSUPPORTED_DAO_METADATA_LINK);
            }
            return toDaoListItem(dao, UNAVAILABLE_DAO_METADATA);
          }
        },
      ),
    );
  }
  /**
   * Retrieves the asset balances of the given DAO, by default, ETH, DAI, USDC and USDT on Mainnet
   *
   * @param {DaoBalancesQueryParams} params
   *     - daoAddressOrEns
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = AssetBalanceSortBy.LAST_UPDATED
   * @return {(Promise<AssetBalance[] | null>)}
   * @memberof ClientMethods
   */
  public async getDaoBalances({
    daoAddressOrEns,
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = AssetBalanceSortBy.LAST_UPDATED,
  }: DaoBalancesQueryParams): Promise<AssetBalance[] | null> {
    await DaoBalancesQuerySchema.strict().validate({
      daoAddressOrEns,
      limit,
      skip,
      direction,
      sortBy,
    });
    let where = {};
    let address = daoAddressOrEns;
    if (address) {
      if (!isAddress(address)) {
        await this.web3.ensureOnline();
        const provider = this.web3.getProvider();
        if (!provider) {
          throw new NoProviderError();
        }
        const resolvedAddress = await provider.resolveName(address);
        if (!resolvedAddress) {
          throw new InvalidAddressOrEnsError();
        }
        address = resolvedAddress;
      }
      where = { dao: address.toLowerCase() };
    }
    const query = QueryTokenBalances;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "dao balances";
    type T = { tokenBalances: SubgraphBalance[] };
    const { tokenBalances } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (tokenBalances.length === 0) {
      return [];
    }
    return tokenBalances.map(
      (balance: SubgraphBalance): AssetBalance => toAssetBalance(balance),
    );
  }
  /**
   * Retrieves the list of asset transfers to and from the given DAO (by default, from ETH, DAI, USDC and USDT, on Mainnet)
   *
   * @param {TransferQueryParams} params
   *     - daoAddressOrEns
   *     - type
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = TransferSortBy.CREATED_AT
   * @return {(Promise<Transfer[] | null>)}
   * @memberof ClientMethods
   */
  public async getDaoTransfers({
    daoAddressOrEns,
    type,
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = TransferSortBy.CREATED_AT,
  }: TransferQueryParams): Promise<Transfer[] | null> {
    let where = {};
    let address = daoAddressOrEns;
    if (address) {
      if (!isAddress(address)) {
        await this.web3.ensureOnline();
        const provider = this.web3.getProvider();
        if (!provider) {
          throw new NoProviderError();
        }
        try {
          const resolvedAddress = await provider.resolveName(address);
          if (!resolvedAddress) {
            throw new InvalidAddressOrEnsError();
          }
          address = resolvedAddress;
        } catch (e) {
          throw new InvalidAddressOrEnsError(e);
        }
      }
      where = { dao: address.toLowerCase() };
    }
    if (type) {
      where = { ...where, type: SubgraphTransferTypeMap.get(type) };
    }
    const query = QueryTokenTransfers;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "dao transfers";
    type T = { tokenTransfers: SubgraphTransferListItem[] };
    const { tokenTransfers } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (!tokenTransfers) {
      return null;
    }
    return tokenTransfers.map(
      (transfer: SubgraphTransferListItem): Transfer =>
        toTokenTransfer(transfer),
    );
  }
  private async getMetadata(
    ipfsUri: string,
  ) {
    const metadataCid = resolveIpfsCid(ipfsUri);
    const stringMetadata = await this.ipfs.fetchString(metadataCid);
    const resolvedMetadata = JSON.parse(stringMetadata);
    return resolvedMetadata;
  }

  private async getPluginRepo(
    pluginRepo: SubgraphPluginRepo,
  ): Promise<PluginRepo> {
    let releaseMetadata: PluginRepoReleaseMetadata;
    // releases are ordered son the index 0 will be the latest
    const releaseIpfsUri = pluginRepo?.releases[0]?.metadata;
    try {
      releaseMetadata = await this.getMetadata(releaseIpfsUri);
    } catch (err) {
      releaseMetadata = UNAVAILABLE_RELEASE_METADATA;
      if (err instanceof InvalidCidError) {
        releaseMetadata = UNSUPPORTED_RELEASE_METADATA_LINK;
      } else if (err instanceof EmptyMultiUriError) {
        releaseMetadata = EMPTY_RELEASE_METADATA_LINK;
      }
    }

    let buildMetadata: PluginRepoBuildMetadata;
    // builds are ordered son the index 0 will be the latest
    const buildIpfsUri = pluginRepo?.releases[0]?.builds[0]?.metadata;
    try {
      buildMetadata = await this.getMetadata(buildIpfsUri);
    } catch (err) {
      buildMetadata = UNAVAILABLE_BUILD_METADATA;
      if (err instanceof InvalidCidError) {
        buildMetadata = UNSUPPORTED_BUILD_METADATA_LINK;
      } else if (err instanceof EmptyMultiUriError) {
        buildMetadata = EMPTY_BUILD_METADATA_LINK;
      }
    }
    return toPluginRepo(pluginRepo, releaseMetadata, buildMetadata);
  }

  /**
   * Retrieves the list of plugins available on the PluginRegistry
   *
   * @param {PluginQueryParams} params
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = PluginSortBy.SUBDOMAIN
   *     - subdomain
   * @return {(Promise<PluginRepo[] | null>)}
   * @memberof ClientMethods
   */
  public async getPlugins({
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = PluginSortBy.SUBDOMAIN,
    subdomain,
  }: PluginQueryParams = {}): Promise<PluginRepoListItem[]> {
    await PluginQuerySchema.strict().validate({
      limit,
      skip,
      direction,
      sortBy,
      subdomain,
    });

    let where = {};
    if (subdomain) {
      where = { subdomain_contains_nocase: subdomain };
    }
    const query = QueryPlugins;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "plugin repos";
    type T = { pluginRepos: SubgraphPluginRepoListItem[] };
    const { pluginRepos } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return Promise.all(
      pluginRepos.map(
        (pluginRepo: SubgraphPluginRepoListItem) => {
          return this.getPluginRepo(pluginRepo);
        },
      ),
    );
  }
  /**
   * Get plugin details given an address, release and build
   *
   * @param {string} pluginAddress
   * @return {Promise<PluginRepo>}
   * @memberof ClientMethods
   */
  public async getPlugin(pluginAddress: string): Promise<PluginRepo> {
    await AddressOrEnsSchema.strict().validate(pluginAddress);
    const name = "plugin version";
    const query = QueryPlugin;
    type T = { pluginRepo: SubgraphPluginRepo };
    const { pluginRepo } = await this.graphql.request<T>({
      query,
      params: { id: pluginAddress.toLowerCase() },
      name,
    });
    // get release metadata
    return this.getPluginRepo(pluginRepo);
  }
  /**
   * Returns the protocol version of a contract
   * if the transaction fails returns [1,0,0]
   *
   * @param {string} contractAddress
   * @return {Promise<number[]>}
   * @memberof ClientMethods
   */
  public async getProtocolVersion(
    contractAddress: string,
  ): Promise<[number, number, number]> {
    await AddressOrEnsSchema.strict().validate(contractAddress);
    const provider = this.web3.getProvider();
    const protocolInstance = IProtocolVersion__factory.connect(
      contractAddress,
      provider,
    );
    let version: [number, number, number];
    try {
      version = await protocolInstance.protocolVersion();
    } catch (e) {
      // ethers5 throws an call exception error which could mean a lot of things
      // so this is not accurate
      version = [1, 0, 0];
    }
    return version;
  }

  /**
   * Given a proposal id returns if that proposal is a dao update proposal
   *
   * @param {string} proposalId
   * @return {Promise<boolean>}
   * @memberof ClientMethods
   */
  public async isDaoUpdateProposal(
    proposalId: string,
  ): Promise<boolean> {
    const name = "iproposal";
    const query = QueryIProposal;
    type T = { iproposal: SubgraphIProposal };
    const { iproposal } = await this.graphql.request<T>({
      query,
      params: { id: getExtendedProposalId(proposalId.toLowerCase()) },
      name,
    });
    if (!iproposal) {
      return false;
    }
    const subgraphActions = iproposal.actions;
    let actions = toDaoActions(subgraphActions);
    const classifiedActions = classifyProposalActions(actions);
    return classifiedActions.includes(
      ProposalActionTypes.UPGRADE_TO_AND_CALL,
    ) || classifiedActions.includes(ProposalActionTypes.UPGRADE_TO);
  }
  /**
   * Given a proposal id returns if that proposal is a plugin update proposal
   *
   * @param {string} proposalId
   * @return {Promise<boolean>}
   * @memberof ClientMethods
   */
  public async isPluginUpdateProposal(
    proposalId: string,
  ): Promise<boolean> {
    const name = "iproposal";
    const query = QueryIProposal;
    type T = { iproposal: SubgraphIProposal };
    const { iproposal } = await this.graphql.request<T>({
      query,
      params: { id: getExtendedProposalId(proposalId.toLowerCase()) },
      name,
    });
    if (!iproposal) {
      return false;
    }
    let actions = toDaoActions(iproposal.actions);
    let classifiedActions = classifyProposalActions(actions);
    return classifiedActions.includes(ProposalActionTypes.APPLY_UPDATE);
  }
  /**
   * Check if the specified proposal id is valid for updating a plugin
   *
   * @param {string} proposalId
   * @return {Promise<PluginUpdateProposalValidity>}
   * @memberof ClientMethods
   */
  public async isPluginUpdateProposalValid(
    proposalId: string,
  ): Promise<PluginUpdateProposalValidity> {
    // not validating the proposalId because multiple proposal id formats can be used
    // get the iproposal given the proposal id
    const name = "iproposal";
    const query = QueryIProposal;
    type T = { iproposal: SubgraphIProposal };
    const { iproposal } = await this.graphql.request<T>({
      query,
      params: { id: getExtendedProposalId(proposalId.toLowerCase()) },
      name,
    });
    if (!iproposal) {
      // if the proposal does not exist return invalid
      return {
        isValid: false,
        actionErrorCauses: [],
        proposalSettingsErrorCauses: [
          ProposalSettingsErrorCause.PROPOSAL_NOT_FOUND,
        ],
      };
    }
    // check failure map
    if (iproposal.allowFailureMap !== "0") {
      // if the failure map is not 0 return invalid failure map
      return {
        isValid: false,
        actionErrorCauses: [],
        proposalSettingsErrorCauses: [
          ProposalSettingsErrorCause.NON_ZERO_ALLOW_FAILURE_MAP_VALUE,
        ],
      };
    }

    let daoActions = toDaoActions(iproposal.actions);
    const classifiedActions = classifyProposalActions(daoActions);

    // remove upgradeToAndCall action
    if (startsWithDaoUpdateAction(classifiedActions)) {
      daoActions = daoActions.slice(1);
    }

    // validate actions
    return validateUpdatePluginProposalActions(
      daoActions,
      iproposal.dao.id,
      this.web3.getAddress(FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR),
      this.graphql,
      this.ipfs,
    );
  }

  /**
   * Check if the specified proposalId actions are valid for updating a dao
   *
   * @param {string} proposalId
   * @param {SupportedVersion} [version]
   * @return {Promise<DaoUpdateProposalValidity>}
   * @memberof ClientMethods
   */
  public async isDaoUpdateProposalValid(
    proposalId: string,
    version?: SupportedVersions,
  ): Promise<DaoUpdateProposalValidity> {
    // omit input validation because we are receiving the proposal id

    // get the iproposal given the proposal id
    const name = "iproposal";
    const query = QueryIProposal;
    type T = { iproposal: SubgraphIProposal };
    const res = await this.graphql.request<T>({
      query,
      params: { id: getExtendedProposalId(proposalId.toLowerCase()) },
      name,
    });
    const { iproposal } = res;
    // if the proposal does not exist return invalid
    if (!iproposal) {
      return {
        isValid: false,
        proposalSettingsErrorCauses: [
          ProposalSettingsErrorCause.PROPOSAL_NOT_FOUND,
        ],
        actionErrorCauses: [],
      };
    }
    // check failure map
    if (iproposal.allowFailureMap !== "0") {
      // if the failure map is not 0 return invalid failure map
      return {
        isValid: false,
        actionErrorCauses: [],
        proposalSettingsErrorCauses: [
          ProposalSettingsErrorCause.NON_ZERO_ALLOW_FAILURE_MAP_VALUE,
        ],
      };
    }
    // get implementation address, use latest version as default
    let daoFactoryAddress = this.web3.getAddress(
      FrameworkContractsNames.DAO_FACTORY,
    );
    if (version) {
      // if version is specified get the dao factory address from the live contracts
      daoFactoryAddress =
        contracts[this.web3.getNetworkName()][version]!.DAOFactory.address;
    }

    return validateUpdateDaoProposalActions(
      toDaoActions(iproposal.actions),
      iproposal.dao.id,
      await this.getDaoImplementation(daoFactoryAddress),
      await this.getProtocolVersion(
        iproposal.dao.id,
      ),
    );
  }
  /**
   *  Return the implementation address for the specified dao factory
   *
   * @param {string} daoFactoryAddress
   * @return {Promise<string>}
   * @memberof ClientMethods
   */
  public async getDaoImplementation(
    daoFactoryAddress: string,
  ): Promise<string> {
    const daoFactoryImplementation = DAOFactory__factory.connect(
      daoFactoryAddress,
      this.web3.getProvider(),
    );
    return daoFactoryImplementation.daoBase();
  }

  public async getPluginPreparations(
    {
      type,
      pluginAddress,
      pluginRepoAddress,
      daoAddressOrEns,
      limit = 10,
      skip = 0,
      direction = SortDirection.ASC,
      sortBy = PluginPreparationSortBy.ID,
    }: PluginPreparationQueryParams,
  ): Promise<PluginPreparationListItem[]> {
    await PluginPreparationQuerySchema.strict().validate({
      type,
      pluginAddress,
      pluginRepoAddress,
      daoAddressOrEns,
      limit,
      skip,
      direction,
      sortBy,
    });

    let where = {};
    if (type) {
      where = { ...where, type };
    }
    if (pluginAddress) {
      where = { ...where, pluginAddress: pluginAddress.toLowerCase() };
    }
    if (pluginRepoAddress) {
      where = { ...where, pluginRepo: pluginRepoAddress.toLowerCase() };
    }
    if (daoAddressOrEns) {
      where = { ...where, dao: daoAddressOrEns.toLowerCase() };
    }
    const query = QueryPluginPreparationsExtended;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "plugin preparations";
    type T = { pluginPreparations: SubgraphPluginPreparationListItem[] };
    const { pluginPreparations } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return Promise.all(
      pluginPreparations.map(
        (pluginPreparation: SubgraphPluginPreparationListItem) => {
          return toPluginPreparationListItem(pluginPreparation);
        },
      ),
    );
  }
}
