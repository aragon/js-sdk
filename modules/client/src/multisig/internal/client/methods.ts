import { isAddress } from "@ethersproject/address";
import {
  ApproveMultisigProposalParams,
  ApproveProposalStep,
  ApproveProposalStepValue,
  CanApproveParams,
  CreateMultisigProposalParams,
  MultisigPluginPrepareInstallationParams,
  MultisigPluginPrepareUpdateParams,
  MultisigProposal,
  MultisigProposalListItem,
  MultisigVotingSettings,
} from "../../types";
import {
  SubgraphMultisigProposal,
  SubgraphMultisigProposalListItem,
  SubgraphMultisigVotingSettings,
} from "../types";
import {
  ExecuteProposalStep,
  ExecuteProposalStepValue,
  MembersQueryParams,
  MembersSortBy,
  ProposalCreationSteps,
  ProposalCreationStepValue,
  ProposalQueryParams,
  ProposalSortBy,
} from "../../../client-common";
import { Multisig__factory } from "@aragon/osx-ethers";
import {
  QueryMultisigIsMember,
  QueryMultisigMembers,
  QueryMultisigProposal,
  QueryMultisigProposals,
  QueryMultisigVotingSettings,
} from "../graphql-queries";
import {
  computeProposalStatusFilter,
  toMultisigProposal,
  toMultisigProposalListItem,
} from "../utils";
import { toUtf8Bytes } from "@ethersproject/strings";
import { IMultisigClientMethods } from "../interfaces";
import {
  boolArrayToBitmap,
  ClientCore,
  decodeProposalId,
  EMPTY_PROPOSAL_METADATA_LINK,
  encodeProposalId,
  findLog,
  getExtendedProposalId,
  InvalidAddressOrEnsError,
  InvalidCidError,
  InvalidProposalIdError,
  IpfsPinError,
  IsMemberParams,
  IsMemberSchema,
  isProposalId,
  MULTI_FETCH_TIMEOUT,
  NoProviderError,
  prepareGenericInstallation,
  prepareGenericUpdate,
  PrepareInstallationStepValue,
  PrepareUpdateStepValue,
  promiseWithTimeout,
  ProposalCreationError,
  ProposalMetadata,
  resolveIpfsCid,
  SizeMismatchError,
  SortDirection,
  UNAVAILABLE_PROPOSAL_METADATA,
  UNSUPPORTED_PROPOSAL_METADATA_LINK,
  UnsupportedNetworkError,
} from "@aragon/sdk-client-common";
import { INSTALLATION_ABI, UPDATE_ABI } from "../constants";
import {
  FrameworkContractsNames,
  getNetworkNameByAlias,
  NonFrameworkContractsNames,
} from "@aragon/osx-commons-configs";

/**
 * Methods module the SDK Address List Client
 */
export class MultisigClientMethods extends ClientCore
  implements IMultisigClientMethods {
  /**
   * Creates a new proposal on the given multisig plugin contract
   *
   * @param {CreateMultisigProposalParams} params
   * @return {AsyncGenerator<ProposalCreationStepValue>}
   * @memberof MultisigClientMethods
   */
  public async *createProposal(
    params: CreateMultisigProposalParams,
  ): AsyncGenerator<ProposalCreationStepValue> {
    const signer = this.web3.getConnectedSigner();
    // TODO
    // implement a more sophisticated isFailingProposal function
    // if (isFailingProposal(params.actions)) {
    //   throw new AlwaysFailingProposalError();
    // }

    const multisigContract = Multisig__factory.connect(
      params.pluginAddress,
      signer,
    );

    if (
      params.failSafeActions?.length &&
      params.failSafeActions.length !== params.actions?.length
    ) {
      throw new SizeMismatchError("failSafeActions", "actions");
    }
    const allowFailureMap = boolArrayToBitmap(params.failSafeActions);

    const startTimestamp = params.startDate?.getTime() || 0;
    const endTimestamp = params.endDate?.getTime() || 0;

    const tx = await multisigContract.createProposal(
      toUtf8Bytes(params.metadataUri),
      params.actions || [],
      allowFailureMap,
      params.approve || false,
      params.tryExecution || false,
      Math.round(startTimestamp / 1000),
      Math.round(endTimestamp / 1000),
    );

    yield {
      key: ProposalCreationSteps.CREATING,
      txHash: tx.hash,
    };

    const receipt = await tx.wait();
    const multisigContractInterface = Multisig__factory
      .createInterface();
    const log = findLog(
      receipt,
      multisigContractInterface,
      "ProposalCreated",
    );
    if (!log) {
      throw new ProposalCreationError();
    }

    const parsedLog = multisigContractInterface.parseLog(log);
    const proposalId = parsedLog.args["proposalId"];
    if (!proposalId) {
      throw new ProposalCreationError();
    }

    yield {
      key: ProposalCreationSteps.DONE,
      proposalId: encodeProposalId(params.pluginAddress, Number(proposalId)),
    };
  }

  /**
   * Pins a metadata object into IPFS and retruns the generated hash
   *
   * @param {ProposalMetadata} params
   * @return {Promise<string>}
   * @memberof MultisigClientMethods
   */
  public async pinMetadata(params: ProposalMetadata): Promise<string> {
    try {
      const cid = await this.ipfs.add(JSON.stringify(params));
      await this.ipfs.pin(cid);
      return `ipfs://${cid}`;
    } catch (e) {
      throw new IpfsPinError(e);
    }
  }
  /**
   * Allow a wallet in the multisig give approval to a proposal
   *
   * @param {ApproveMultisigProposalParams} params
   * @return {AsyncGenerator<ApproveProposalStepValue>}
   * @memberof MultisigClientMethods
   */
  public async *approveProposal(
    params: ApproveMultisigProposalParams,
  ): AsyncGenerator<ApproveProposalStepValue> {
    const signer = this.web3.getConnectedSigner();
    const { pluginAddress, id } = decodeProposalId(params.proposalId);

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      signer,
    );

    const tx = await multisigContract.approve(
      id,
      params.tryExecution,
    );

    yield {
      key: ApproveProposalStep.APPROVING,
      txHash: tx.hash,
    };

    await tx.wait();

    yield {
      key: ApproveProposalStep.DONE,
    };
  }
  /**
   * Allow a wallet in the multisig give approval to a proposal
   *
   * @param {string} proposalId
   * @return {AsyncGenerator<ExecuteMultisigProposalStepValue>}
   * @memberof MultisigClientMethods
   */
  public async *executeProposal(
    proposalId: string,
  ): AsyncGenerator<ExecuteProposalStepValue> {
    const signer = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(proposalId);

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      signer,
    );

    const tx = await multisigContract.execute(
      id,
    );

    yield {
      key: ExecuteProposalStep.EXECUTING,
      txHash: tx.hash,
    };

    await tx.wait();

    yield {
      key: ExecuteProposalStep.DONE,
    };
  }
  /**
   * Prepares the installation of a multisig plugin in a given dao
   *
   * @param {MultisigPluginPrepareInstallationParams} params
   * @return {AsyncGenerator<PrepareInstallationStepValue>}
   * @memberof MultisigClientMethods
   */
  public async *prepareInstallation(
    params: MultisigPluginPrepareInstallationParams,
  ): AsyncGenerator<PrepareInstallationStepValue> {
    const network = await this.web3.getProvider().getNetwork();
    const networkName = network.name;
    const aragonNetwork = getNetworkNameByAlias(networkName);
    if (!aragonNetwork) {
      throw new UnsupportedNetworkError(networkName);
    }
    // TODO
    // Check params with yup
    yield* prepareGenericInstallation(this.web3, {
      daoAddressOrEns: params.daoAddressOrEns,
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.MULTISIG_REPO_PROXY,
      ),
      version: params.versionTag,
      installationAbi: INSTALLATION_ABI,
      installationParams: [
        params.settings.members,
        [
          params.settings.votingSettings.onlyListed,
          params.settings.votingSettings.minApprovals,
        ],
      ],
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }
  /**
   * Prepares the update of a multisig plugin in a given dao
   *
   * @param {MultisigPluginPrepareUpdateParams} params
   * @return {AsyncGenerator<PrepareUpdateStepValue>}
   * @memberof MultisigClientMethods
   */
  public async *prepareUpdate(
    params: MultisigPluginPrepareUpdateParams,
  ): AsyncGenerator<PrepareUpdateStepValue> {
    yield* prepareGenericUpdate(this.web3, this.graphql, {
      ...params,
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.MULTISIG_REPO_PROXY,
      ),
      updateAbi: UPDATE_ABI[params.newVersion.build] ||
        params.updateAbi || [],
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }

  /**
   * Checks whether the current proposal can be approved by the given address
   *
   * @param {string} addressOrEns
   * @return {Promise<boolean>}
   * @memberof MultisigClientMethods
   */
  public async canApprove(
    params: CanApproveParams,
  ): Promise<boolean> {
    const provider = this.web3.getProvider();
    if (!isAddress(params.approverAddressOrEns)) {
      throw new InvalidAddressOrEnsError();
    }
    const { pluginAddress, id } = decodeProposalId(params.proposalId);

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      provider,
    );

    return multisigContract.canApprove(id, params.approverAddressOrEns);
  }
  /**
   * Checks whether the current proposal can be executed
   *
   * @param {string} proposalId
   * @return {Promise<boolean>}
   * @memberof MultisigClientMethods
   */
  public async canExecute(
    proposalId: string,
  ): Promise<boolean> {
    const provider = this.web3.getProvider();

    const { pluginAddress, id } = decodeProposalId(proposalId);

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      provider,
    );

    return multisigContract.canExecute(id);
  }
  /**
   * Returns the voting settings
   *
   * @param {string} addressOrEns
   * @param {number} blockNumber
   * @return {Promise<MultisigVotingSettings>}
   * @memberof MultisigClientMethods
   */
  public async getVotingSettings(
    pluginAddress: string,
    blockNumber?: number,
  ): Promise<MultisigVotingSettings> {
    // TODO
    // update this with yup validation
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressOrEnsError();
    }
    const query = QueryMultisigVotingSettings;
    const params = {
      address: pluginAddress.toLowerCase(),
      block: blockNumber ? { number: blockNumber } : null,
    };
    const name = "Multisig settings";
    type T = { multisigPlugin: SubgraphMultisigVotingSettings };
    const { multisigPlugin } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return {
      onlyListed: multisigPlugin.onlyListed,
      minApprovals: multisigPlugin.minApprovals,
    };
  }
  /**
   * returns the members of the multisig
   *
   * @param {MembersQueryParams} params
   *     - pluginAddress
   *     - blockNumber
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = MembersSortBy.ADDRESS
   * @return {Promise<string[]>}
   * @memberof MultisigClientMethods
   */
  public async getMembers({
    pluginAddress,
    blockNumber,
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = MembersSortBy.ADDRESS,
  }: MembersQueryParams): Promise<string[]> {
    // TODO
    // update this with yup validation
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressOrEnsError();
    }
    const query = QueryMultisigMembers;
    const params = {
      where: { plugin: pluginAddress.toLowerCase() },
      block: blockNumber ? { number: blockNumber } : null,
      skip,
      limit,
      direction,
      sortBy,
    };
    const name = "Multisig members";
    type T = { multisigApprovers: any };
    const { multisigApprovers } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return multisigApprovers.filter((member: any) => member.isActive).map((member: any) => {member.address});
  }

  /**
   * Returns the details of the given proposal
   *
   * @param {string} proposalId
   * @return {(Promise<MultisigProposal | null>)}
   * @memberof MultisigClientMethods
   */
  public async getProposal(
    proposalId: string,
  ): Promise<MultisigProposal | null> {
    if (!isProposalId(proposalId)) {
      throw new InvalidProposalIdError();
    }
    const extendedProposalId = getExtendedProposalId(proposalId);
    const query = QueryMultisigProposal;
    const params = {
      proposalId: extendedProposalId,
    };
    const name = "Multisig proposal";
    type T = { multisigProposal: SubgraphMultisigProposal };
    const { multisigProposal } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (!multisigProposal) {
      return null;
    } else if (!multisigProposal.metadata) {
      return toMultisigProposal(
        multisigProposal,
        EMPTY_PROPOSAL_METADATA_LINK,
      );
    }
    try {
      const metadataCid = resolveIpfsCid(multisigProposal.metadata);
      const metadataString = await this.ipfs.fetchString(metadataCid);
      const metadata = JSON.parse(metadataString) as ProposalMetadata;
      return toMultisigProposal(multisigProposal, metadata);
      // TODO: Parse and validate schema
    } catch (err) {
      if (err instanceof InvalidCidError) {
        return toMultisigProposal(
          multisigProposal,
          UNSUPPORTED_PROPOSAL_METADATA_LINK,
        );
      }
      return toMultisigProposal(
        multisigProposal,
        UNAVAILABLE_PROPOSAL_METADATA,
      );
    }
  }

  /**
   * Returns a list of proposals on the Plugin, filtered by the given criteria
   *
   * @param {ProposalQueryParams} params
   *       - daoAddressOrEns
   *       - limit = 10
   *       - status
   *       - skip = 0
   *       - direction = SortDirection.ASC
   *       - sortBy = ProposalSortBy.CREATED_AT
   * @return {Promise<MultisigProposalListItem[]>}
   * @memberof MultisigClientMethods
   */
  public async getProposals({
    daoAddressOrEns,
    limit = 10,
    status,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = ProposalSortBy.CREATED_AT,
  }: ProposalQueryParams): Promise<MultisigProposalListItem[]> {
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
    if (status) {
      where = { ...where, ...computeProposalStatusFilter(status) };
    }
    const query = QueryMultisigProposals;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "Multisig proposals";
    type T = { multisigProposals: SubgraphMultisigProposalListItem[] };
    const { multisigProposals } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return Promise.all(
      multisigProposals.map(
        async (
          proposal: SubgraphMultisigProposalListItem,
        ): Promise<MultisigProposalListItem> => {
          if (!proposal.metadata) {
            return toMultisigProposalListItem(
              proposal,
              EMPTY_PROPOSAL_METADATA_LINK,
            );
          }
          // format in the metadata field
          try {
            const metadataCid = resolveIpfsCid(proposal.metadata);
            // Avoid blocking Promise.all if this individual fetch takes too long
            const stringMetadata = await promiseWithTimeout(
              this.ipfs.fetchString(metadataCid),
              MULTI_FETCH_TIMEOUT,
            );
            const metadata = JSON.parse(stringMetadata) as ProposalMetadata;
            return toMultisigProposalListItem(proposal, metadata);
          } catch (err) {
            if (err instanceof InvalidCidError) {
              return toMultisigProposalListItem(
                proposal,
                UNSUPPORTED_PROPOSAL_METADATA_LINK,
              );
            }
            return toMultisigProposalListItem(
              proposal,
              UNAVAILABLE_PROPOSAL_METADATA,
            );
          }
        },
      ),
    );
  }

  /**
   * Checks if a given address is a member of the tokenVoting contract.
   * @param params - The parameters for the isMember method.
   * @param params.pluginAddress - The address of the plugin.
   * @param params.address - The address to check.
   * @param params.blockNumber - The block number for specifying a specific block.
   * @returns {boolean} A boolean indicating whether the address is a member or not.
   */
  public async isMember(params: IsMemberParams): Promise<boolean> {
    IsMemberSchema.strict().validateSync(params);
    const query = QueryMultisigIsMember;
    const name = "multisig isMember";
    type T = { multisigApprover: { id: string } };
    const { multisigApprover } = await this.graphql.request<T>({
      query,
      params: {
        id:
          `${params.pluginAddress.toLowerCase()}_${params.address.toLowerCase()}`,
        blockHeight: params.blockNumber ? { number: params.blockNumber } : null,
      },
      name,
    });
    return !!multisigApprover;
  }
}
