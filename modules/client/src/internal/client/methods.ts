import {
  DAO__factory,
  DAOFactory,
  DAOFactory__factory,
  DAORegistry__factory,
  PluginRepo__factory,
  PluginSetupProcessor__factory,
} from "@aragon/core-contracts-ethers";
import {
  EnsureAllowanceError,
  GraphQLError,
  InvalidAddressOrEnsError,
  InvalidCidError,
  IpfsPinError,
  MissingExecPermissionError,
  NoProviderError,
  NoSignerError,
  resolveIpfsCid,
} from "@aragon/sdk-common";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import {
  Contract,
  ContractTransaction,
} from "@ethersproject/contracts";
import { erc20ContractAbi } from "../abi/erc20";
import {
  QueryBalances,
  QueryDao,
  QueryDaos,
  QueryTransfers,
} from "../graphql-queries";
import {
  AssetBalance,
  DaoCreationSteps,
  DaoCreationStepValue,
  DaoDepositSteps,
  DaoDepositStepValue,
  DaoDetails,
  DaoListItem,
  DaoSortBy,
  EnsureAllowanceParams,
  EnsureAllowanceStepValue,
  IClientMethods,
  ICreateParams,
  IDaoQueryParams,
  IDepositParams,
  IHasPermissionParams,
  IMetadata,
  ITransferQueryParams,
  PermissionIds,
  SubgraphBalance,
  SubgraphDao,
  SubgraphDaoListItem,
  SubgraphTransferListItem,
  SubgraphTransferTypeMap,
  Transfer,
  TransferSortBy,
} from "../../interfaces";
import {
  ClientCore,
  Context,
  findLog,
  SortDirection,
} from "../../client-common";
import {
  toAssetBalance,
  toDaoDetails,
  toDaoListItem,
  toTransfer,
  unwrapDepositParams,
} from "../utils";
import { isAddress } from "@ethersproject/address";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { id } from "@ethersproject/hash";
import {
  UNAVAILABLE_DAO_METADATA,
  UNSUPPORTED_DAO_METADATA_LINK,
} from "../constants";

/**
 * Methods module the SDK Generic Client
 */
export class ClientMethods extends ClientCore implements IClientMethods {
  constructor(context: Context) {
    super(context);
    Object.freeze(ClientMethods.prototype);
    Object.freeze(this);
  }
  /**
   * Creates a DAO with the given settings and plugins
   *
   * @param {ICreateParams} params
   * @return {*}  {AsyncGenerator<DaoCreationStepValue>}
   * @memberof ClientMethods
   */
  public async *create(
    params: ICreateParams,
  ): AsyncGenerator<DaoCreationStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const daoFactoryInstance = DAOFactory__factory.connect(
      this.web3.getDaoFactoryAddress(),
      signer,
    );

    const pluginInstallationData: DAOFactory.PluginSettingsStruct[] = [];
    for (const plugin of params.plugins) {
      const latestVersion = await PluginRepo__factory.connect(
        plugin.id,
        signer,
      ).getLatestVersion();
      pluginInstallationData.push({
        pluginSetup: latestVersion[1],
        pluginSetupRepo: plugin.id,
        data: toUtf8String(plugin.data),
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
    for (const plugin of pluginInstallationData) {
      const pluginSetupProcessorResponse = await pluginSetupProcessor.callStatic
        .prepareInstallation(
          daoBaseAddr,
          plugin.pluginSetup,
          plugin.pluginSetupRepo,
          plugin.data,
        );
      const found = pluginSetupProcessorResponse.permissions.find(
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
        name: params.ensSubdomain,
        metadata: toUtf8Bytes(params.metadataUri),
        trustedForwarder: params.trustedForwarder || AddressZero,
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
      throw new Error("Failed to create DAO");
    }

    const parsedLog = daoFactoryInterface.parseLog(log);

    if (!parsedLog.args["dao"]) {
      throw new Error("Failed to create DAO");
    }

    yield {
      key: DaoCreationSteps.DONE,
      address: parsedLog.args["dao"],
    };
  }
  /**
   * Pins a metadata object into IPFS and retruns the generated hash
   *
   * @param {IMetadata} params
   * @return {*}  {Promise<string>}
   * @memberof ClientMethods
   */
  public async pinMetadata(params: IMetadata): Promise<string> {
    try {
      const cid = await this.ipfs.add(JSON.stringify(params));
      await this.ipfs.pin(cid);
      return `ipfs://${cid}`;
    } catch {
      throw new IpfsPinError();
    }
  }
  /**
   * Deposits ether or an ERC20 token into the DAO
   *
   * @param {IDepositParams} params
   * @return {*}  {AsyncGenerator<DaoDepositStepValue>}
   * @memberof ClientMethods
   */
  public async *deposit(
    params: IDepositParams,
  ): AsyncGenerator<DaoDepositStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }
    const [daoAddress, amount, tokenAddress, reference] = unwrapDepositParams(
      params,
    );

    if (tokenAddress && tokenAddress !== AddressZero) {
      // If the target is an ERC20 token, ensure that the amount can be transferred
      // Relay the yield steps to the caller as they are received
      yield* this.ensureAllowance(
        {
          amount: params.amount,
          daoAddress,
          tokenAddress
        }
      );
    }

    // Doing the transfer
    const daoInstance = DAO__factory.connect(daoAddress, signer);
    const override: { value?: BigNumber } = {};

    if (tokenAddress === AddressZero) {
      // Ether
      override.value = amount;
    }

    const depositTx = await daoInstance.deposit(
      tokenAddress,
      amount,
      reference,
      override,
    );
    yield { key: DaoDepositSteps.DEPOSITING, txHash: depositTx.hash };

    await depositTx.wait().then((cr) => {
      if (!cr.logs?.length) {
        throw new Error("The deposit was not properly registered");
      }

      const daoInterface = DAO__factory.createInterface();
      const log = cr.logs?.find(
        (e) =>
          e?.topics[0] ===
            id(daoInterface.getEvent("Deposited").format("sighash")),
      );
      if (!log) {
        throw new Error("Failed to deposit");
      }

      const logParsed = daoInterface.parseLog(log);
      if (!amount.eq(logParsed.args["amount"])) {
        throw new Error(
          `Deposited amount mismatch. Expected: ${amount.toBigInt()}, received: ${
            logParsed.args[
              "amount"
            ].toBigInt()
          }`,
        );
      }
    });
    yield { key: DaoDepositSteps.DONE, amount: amount.toBigInt() };
  }

  /**
   * Checks if the allowance is enough and updates it
   *
   * @param {EnsureAllowanceParams} params
   * @return {*}  {AsyncGenerator<EnsureAllowanceStepValue>}
   * @memberof ClientMethods
   */
  public async *ensureAllowance(
    params: EnsureAllowanceParams,
  ): AsyncGenerator<EnsureAllowanceStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }
    // TODO
    // add params check with yup

    const tokenInstance = new Contract(
      params.tokenAddress,
      erc20ContractAbi,
      signer,
    );

    const currentAllowance = await tokenInstance.allowance(
      await signer.getAddress(),
      params.daoAddress,
    );

    yield {
      key: DaoDepositSteps.CHECKED_ALLOWANCE,
      allowance: currentAllowance.toBigInt(),
    };

    if (currentAllowance.gte(params.amount)) return;

    const tx: ContractTransaction = await tokenInstance.approve(
      params.daoAddress,
      BigNumber.from(params.amount),
    );

    yield {
      key: DaoDepositSteps.UPDATING_ALLOWANCE,
      txHash: tx.hash,
    };

    const cr = await tx.wait();
    const log = findLog(cr, tokenInstance.interface, "Approval");

    if (!log) {
      throw new EnsureAllowanceError();
    }
    const value = log.data;
    if (!value || BigNumber.from(params.amount).gt(BigNumber.from(value))) {
      throw new EnsureAllowanceError();
    }

    yield {
      key: DaoDepositSteps.UPDATED_ALLOWANCE,
      allowance: params.amount,
    };
  }
  /**
   * Checks whether a role is granted by the current DAO's ACL settings
   *
   * @param {IHasPermissionParams} params
   * @return {*}  {Promise<boolean>}
   * @memberof ClientMethods
   */
  public async hasPermission(params: IHasPermissionParams): Promise<boolean> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }
    // connect to the managing dao
    const daoInstance = DAO__factory.connect(params.daoAddressOrEns, signer);
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
   * @return {*}  {(Promise<DaoDetails | null>)}
   * @memberof ClientMethods
   */
  public async getDao(daoAddressOrEns: string): Promise<DaoDetails | null> {
    let address = daoAddressOrEns;
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
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const { dao }: { dao: SubgraphDao } = await client.request(QueryDao, {
        address,
      });
      if (!dao) {
        return null;
      }
      try {
        const metadataCid = resolveIpfsCid(dao.metadata);
        const metadataString = await this.ipfs.fetchString(metadataCid);
        const metadata = JSON.parse(metadataString) as IMetadata;
        return toDaoDetails(dao, metadata);
        // TODO: Parse and validate schema
      } catch (err) {
        if (err instanceof InvalidCidError) {
          return toDaoDetails(dao, UNSUPPORTED_DAO_METADATA_LINK);
        }
        return toDaoDetails(dao, UNAVAILABLE_DAO_METADATA);
      }
    } catch (err) {
      throw new GraphQLError("DAO");
    }
  }
  /**
   * Retrieves metadata for DAO with given identifier (address or ens domain)
   *
   * @param {IDaoQueryParams} {
   *     limit = 10,
   *     skip = 0,
   *     direction = SortDirection.ASC,
   *     sortBy = DaoSortBy.CREATED_AT,
   *   }
   * @return {*}  {Promise<DaoListItem[]>}
   * @memberof ClientMethods
   */
  public async getDaos({
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = DaoSortBy.CREATED_AT,
  }: IDaoQueryParams): Promise<DaoListItem[]> {
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const { daos }: { daos: SubgraphDaoListItem[] } = await client.request(
        QueryDaos,
        {
          limit,
          skip,
          direction,
          sortBy,
        },
      );
      await this.ipfs.ensureOnline();
      return Promise.all(
        daos.map(
          async (dao: SubgraphDaoListItem): Promise<DaoListItem> => {
            try {
              const metadataCid = resolveIpfsCid(dao.metadata);
              const stringMetadata = await this.ipfs.fetchString(metadataCid);
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
    } catch (err) {
      throw new GraphQLError("DAO");
    }
  }
  /**
   * Retrieves the asset balances of the given DAO, by default, ETH, DAI, USDC and USDT on Mainnet
   *
   * @param {string} daoAddressorEns
   * @return {*}  {(Promise<AssetBalance[] | null>)}
   * @memberof ClientMethods
   */
  public async getBalances(
    daoAddressorEns: string,
  ): Promise<AssetBalance[] | null> {
    let address = daoAddressorEns;
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
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const {
        balances,
      }: { balances: SubgraphBalance[] } = await client.request(QueryBalances, {
        address,
      });
      if (balances.length === 0) {
        return [];
      }
      // TODO
      // handle other tokens that are not ERC20 or eth
      return Promise.all(
        balances.map(
          (balance: SubgraphBalance): AssetBalance => toAssetBalance(balance),
        ),
      );
    } catch (err) {
      throw new GraphQLError("balance");
    }
  }
  /**
   * Retrieves the list of asset transfers to and from the given DAO (by default, from ETH, DAI, USDC and USDT, on Mainnet)
   *
   * @param {ITransferQueryParams} {
   *     daoAddressOrEns,
   *     type,
   *     limit = 10,
   *     skip = 0,
   *     direction = SortDirection.ASC,
   *     sortBy = TransferSortBy.CREATED_AT,
   *   }
   * @return {*}  {(Promise<Transfer[] | null>)}
   * @memberof ClientMethods
   */
  public async getTransfers({
    daoAddressOrEns,
    type,
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = TransferSortBy.CREATED_AT,
  }: ITransferQueryParams): Promise<Transfer[] | null> {
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
      where = { dao: address };
    }
    if (type) {
      where = { ...where, type: SubgraphTransferTypeMap.get(type) };
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const {
        vaultTransfers,
      }: { vaultTransfers: SubgraphTransferListItem[] } = await client.request(
        QueryTransfers,
        {
          where,
          limit,
          skip,
          direction,
          sortBy,
        },
      );
      if (!vaultTransfers) {
        return null;
      }
      return Promise.all(
        vaultTransfers.map(
          (transfer: SubgraphTransferListItem): Transfer =>
            toTransfer(transfer),
        ),
      );
    } catch {
      throw new GraphQLError("transfer");
    }
  }
}
