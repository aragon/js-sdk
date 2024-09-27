import { isAddress } from "@ethersproject/address";
import {
  CanVoteParams,
  CreateMajorityVotingProposalParams,
  ExecuteProposalStep,
  ExecuteProposalStepValue,
  ProposalCreationSteps,
  ProposalCreationStepValue,
  ProposalQueryParams,
  ProposalSortBy,
  SubgraphVotingSettings,
  VoteProposalParams,
  VoteProposalStep,
  VoteProposalStepValue,
  VotingSettings,
} from "../../../client-common";
import {
  DelegateTokensParams,
  DelegateTokensStep,
  DelegateTokensStepValue,
  Erc20TokenDetails,
  Erc20WrapperTokenDetails,
  Erc721TokenDetails,
  TokenVotingMember,
  TokenVotingPluginPrepareInstallationParams,
  TokenVotingPluginPrepareUpdateParams,
  TokenVotingProposal,
  TokenVotingProposalListItem,
  UndelegateTokensStepValue,
  UnwrapTokensParams,
  UnwrapTokensStep,
  UnwrapTokensStepValue,
  WrapTokensParams,
  WrapTokensStep,
  WrapTokensStepValue,
} from "../../types";
import {
  SubgraphContractType,
  SubgraphErc20Token,
  SubgraphErc20WrapperToken,
  SubgraphErc721Token,
  SubgraphTokenVotingMember,
  SubgraphTokenVotingProposal,
  SubgraphTokenVotingProposalListItem,
  TokenVotingMembersQueryParams,
  TokenVotingMembersSortBy,
  TokenVotingTokenCompatibility,
} from "../types";
import {
  QueryTokenVotingIsMember,
  QueryTokenVotingMembers,
  QueryTokenVotingPlugin,
  QueryTokenVotingProposal,
  QueryTokenVotingProposals,
  QueryTokenVotingSettings,
} from "../graphql-queries";
import {
  computeProposalStatusFilter,
  isERC20Token,
  tokenVotingInitParamsToContract,
  toTokenVotingMember,
  toTokenVotingProposal,
  toTokenVotingProposalListItem,
} from "../utils";
import {
  GovernanceERC20__factory,
  GovernanceWrappedERC20__factory,
  TokenVoting__factory,
} from "@aragon/osx-ethers";
import { toUtf8Bytes } from "@ethersproject/strings";
import { ITokenVotingClientMethods } from "../interfaces";
import {
  boolArrayToBitmap,
  ClientCore,
  decodeProposalId,
  decodeRatio,
  EMPTY_PROPOSAL_METADATA_LINK,
  encodeProposalId,
  findLog,
  getExtendedProposalId,
  InvalidAddressError,
  InvalidAddressOrEnsError,
  InvalidCidError,
  InvalidProposalIdError,
  IpfsPinError,
  IsMemberParams,
  IsMemberSchema,
  isProposalId,
  MULTI_FETCH_TIMEOUT,
  NoProviderError,
  NotAContractError,
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
  TokenType,
  UNAVAILABLE_PROPOSAL_METADATA,
  UNSUPPORTED_PROPOSAL_METADATA_LINK,
  UnsupportedNetworkError,
} from "@aragon/sdk-client-common";
import {
  ERC165_INTERFACE_ID,
  GOVERNANCE_SUPPORTED_INTERFACE_IDS,
  INSTALLATION_ABI,
  UPDATE_ABI,
} from "../constants";
import { abi as ERC165_ABI } from "@openzeppelin/contracts/build/contracts/ERC165.json";
import { Contract } from "@ethersproject/contracts";
import { AddressZero } from "@ethersproject/constants";
import {
  FrameworkContractsNames,
  getNetworkNameByAlias,
  NonFrameworkContractsNames,
} from "@aragon/osx-commons-configs";

/**
 * Methods module the SDK TokenVoting Client
 */
export class TokenVotingClientMethods extends ClientCore
  implements ITokenVotingClientMethods {
  /**
   * Creates a new proposal on the given TokenVoting plugin contract
   *
   * @param {CreateMajorityVotingProposalParams} params
   * @return {AsyncGenerator<ProposalCreationStepValue>}
   * @memberof TokenVotingClient
   */
  public async *createProposal(
    params: CreateMajorityVotingProposalParams,
  ): AsyncGenerator<ProposalCreationStepValue> {
    const signer = this.web3.getConnectedSigner();

    const tokenVotingContract = TokenVoting__factory.connect(
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

    const tx = await tokenVotingContract.createProposal(
      toUtf8Bytes(params.metadataUri),
      params.actions || [],
      allowFailureMap,
      Math.round(startTimestamp / 1000),
      Math.round(endTimestamp / 1000),
      params.creatorVote || 0,
      params.executeOnPass || false,
    );

    yield {
      key: ProposalCreationSteps.CREATING,
      txHash: tx.hash,
    };

    const receipt = await tx.wait();
    const tokenVotingContractInterface = TokenVoting__factory.createInterface();
    const log = findLog(
      receipt,
      tokenVotingContractInterface,
      "ProposalCreated",
    );
    if (!log) {
      throw new ProposalCreationError();
    }

    const parsedLog = tokenVotingContractInterface.parseLog(log);
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
   * @memberof ClientMethods
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
   * Cast a vote on the given proposal using the client's wallet. Depending on the proposal settings, an affirmative vote may execute the proposal's actions on the DAO.
   *
   * @param {VoteProposalParams} params
   * @param {VoteValues} vote
   * @return {AsyncGenerator<VoteProposalStepValue>}
   * @memberof TokenVotingClient
   */
  public async *voteProposal(
    params: VoteProposalParams,
  ): AsyncGenerator<VoteProposalStepValue> {
    const signer = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(params.proposalId);

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      signer,
    );

    const tx = await tokenVotingContract.vote(
      id,
      params.vote,
      false,
    );

    yield {
      key: VoteProposalStep.VOTING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: VoteProposalStep.DONE,
    };
  }
  /**
   * Executes the given proposal, provided that it has already passed
   *
   * @param {string} proposalId
   * @return {AsyncGenerator<ExecuteProposalStepValue>}
   * @memberof TokenVotingClient
   */
  public async *executeProposal(
    proposalId: string,
  ): AsyncGenerator<ExecuteProposalStepValue> {
    const signer = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(proposalId);

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      signer,
    );
    const tx = await tokenVotingContract.execute(id);

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
   * Prepares the installation of a token voting plugin in a given dao
   *
   * @param {TokenVotingPluginPrepareInstallationParams} params
   * @return {AsyncGenerator<PrepareInstallationStepValue>}
   * @memberof TokenVotingClientMethods
   */
  public async *prepareInstallation(
    params: TokenVotingPluginPrepareInstallationParams,
  ): AsyncGenerator<PrepareInstallationStepValue> {
    const network = await this.web3.getProvider().getNetwork();
    const networkName = network.name;
    const aragonNetwork = getNetworkNameByAlias(networkName);
    if (!aragonNetwork) {
      throw new UnsupportedNetworkError(networkName);
    }
    yield* prepareGenericInstallation(this.web3, {
      daoAddressOrEns: params.daoAddressOrEns,
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.TOKEN_VOTING_REPO_PROXY,
      ),
      version: params.versionTag,
      installationAbi: INSTALLATION_ABI,
      installationParams: tokenVotingInitParamsToContract(params.settings),
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }
  /**
   * Prepares the update of a token voting plugin in a given dao
   *
   * @param {TokenVotingPluginPrepareUpdateParams} params
   * @return {AsyncGenerator<PrepareUpdateStepValue>}
   * @memberof TokenVotingClientMethods
   */
  public async *prepareUpdate(
    params: TokenVotingPluginPrepareUpdateParams,
  ): AsyncGenerator<PrepareUpdateStepValue> {
    yield* prepareGenericUpdate(this.web3, this.graphql, {
      ...params,
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.TOKEN_VOTING_REPO_PROXY,
      ),
      updateAbi: UPDATE_ABI[params.newVersion.build] ||
        params.updateAbi || [],
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }

  public async *wrapTokens(
    params: WrapTokensParams,
  ): AsyncGenerator<WrapTokensStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!isAddress(params.wrappedTokenAddress)) {
      throw new InvalidAddressError();
    }
    const wrappedErc20Contract = GovernanceWrappedERC20__factory.connect(
      params.wrappedTokenAddress,
      signer,
    );

    const account = await signer.getAddress();

    const tx = await wrappedErc20Contract.depositFor(
      account,
      params.amount,
    );

    yield {
      key: WrapTokensStep.WRAPPING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: WrapTokensStep.DONE,
    };
  }
  public async *unwrapTokens(
    params: UnwrapTokensParams,
  ): AsyncGenerator<UnwrapTokensStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!isAddress(params.wrappedTokenAddress)) {
      throw new InvalidAddressError();
    }
    const wrappedErc20Contract = GovernanceWrappedERC20__factory.connect(
      params.wrappedTokenAddress,
      signer,
    );

    const account = await signer.getAddress();

    const tx = await wrappedErc20Contract.withdrawTo(
      account,
      params.amount,
    );

    yield {
      key: UnwrapTokensStep.UNWRAPPING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: UnwrapTokensStep.DONE,
    };
  }
  /**
   * Delegates all the signer's voting power to a delegatee
   *
   * @param {DelegateTokensParams} params
   * @return {AsyncGenerator<DelegateTokensStepValue>}
   * @memberof TokenVotingClientMethods
   */
  public async *delegateTokens(
    params: DelegateTokensParams,
  ): AsyncGenerator<DelegateTokensStepValue> {
    const signer = this.web3.getConnectedSigner();
    const governanceErc20Contract = GovernanceERC20__factory.connect(
      params.tokenAddress,
      signer,
    );
    const tx = await governanceErc20Contract.delegate(params.delegatee);
    yield {
      key: DelegateTokensStep.DELEGATING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: DelegateTokensStep.DONE,
    };
  }
  /**
   * Delegates all the signer's tokens back to itself
   *
   * @param {string} tokenAddress
   * @return {AsyncGenerator<UndelegateTokensStepValue>}
   * @memberof TokenVotingClientMethods
   */
  public async *undelegateTokens(
    tokenAddress: string,
  ): AsyncGenerator<UndelegateTokensStepValue> {
    const signer = this.web3.getConnectedSigner();
    yield* this.delegateTokens({
      tokenAddress,
      delegatee: await signer.getAddress(),
    });
  }
  /**
   * Retrieves the current signer's delegatee for the given token
   *
   * @param {string} tokenAddress
   * @return {Promise<string | null>}
   * @memberof TokenVotingClientMethods
   */
  public async getDelegatee(tokenAddress: string): Promise<string | null> {
    const signer = this.web3.getConnectedSigner();
    const governanceErc20Contract = GovernanceERC20__factory.connect(
      tokenAddress,
      signer,
    );
    const address = await signer.getAddress();
    const delegatee = await governanceErc20Contract.delegates(address);
    return address === delegatee ? null : delegatee;
  }

  /**
   * Checks if an user can vote in a proposal
   *
   * @param {CanVoteParams} params
   * @returns   {Promise<boolean>}
   */
  public async canVote(params: CanVoteParams): Promise<boolean> {
    const provider = this.web3.getProvider();

    if (!isAddress(params.voterAddressOrEns)) {
      throw new InvalidAddressError();
    }

    const { pluginAddress, id } = decodeProposalId(params.proposalId);

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      provider,
    );
    return tokenVotingContract.callStatic.canVote(
      id,
      params.voterAddressOrEns,
      params.vote,
    );
  }

  /**
   * Checks whether the current proposal can be executed
   *
   * @param {string} proposalId
   * @return {Promise<boolean>}
   * @memberof TokenVotingClientMethods
   */
  public async canExecute(
    proposalId: string,
  ): Promise<boolean> {
    const provider = this.web3.getProvider();

    const { pluginAddress, id } = decodeProposalId(proposalId);

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      provider,
    );

    return tokenVotingContract.canExecute(id);
  }
  /**
   * Returns the list of wallet addresses holding tokens from the underlying Token contract used by the plugin
   *
   * @param {MembersQueryParams} params
   *     - pluginAddress
   *     - blockNumber
   *     - limit = 10
   *     - skip = 0
   *     - direction = SortDirection.ASC
   *     - sortBy = MembersSortBy.ADDRESS
   * @return {Promise<string[]>}
   * @memberof TokenVotingClientMethods
   */
  public async getMembers({
    pluginAddress,
    blockNumber,
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = TokenVotingMembersSortBy.VOTING_POWER,
  }: TokenVotingMembersQueryParams): Promise<TokenVotingMember[]> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    const query = QueryTokenVotingMembers;
    const params = {
      where: { plugin: pluginAddress.toLowerCase() },
      block: blockNumber ? { number: blockNumber } : null,
      skip,
      limit,
      direction,
      sortBy,
    };
    const name = "TokenVoting members";
    type T = { tokenVotingMembers: SubgraphTokenVotingMember[] };
    const { tokenVotingMembers } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return tokenVotingMembers.map((
      member: SubgraphTokenVotingMember,
    ) => toTokenVotingMember(member));
  }

  /**
   * Returns the details of the given proposal
   *
   * @param {string} proposalId
   * @return {Promise<TokenVotingProposal>}
   * @memberof TokenVotingClient
   */
  public async getProposal(
    proposalId: string,
  ): Promise<TokenVotingProposal | null> {
    if (!isProposalId(proposalId)) {
      throw new InvalidProposalIdError();
    }
    const extendedProposalId = getExtendedProposalId(proposalId);
    const query = QueryTokenVotingProposal;
    const params = {
      proposalId: extendedProposalId,
    };
    const name = "TokenVoting proposal";
    type T = { tokenVotingProposal: SubgraphTokenVotingProposal };
    const { tokenVotingProposal } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (!tokenVotingProposal) {
      return null;
    } else if (!tokenVotingProposal.metadata) {
      return toTokenVotingProposal(
        tokenVotingProposal,
        EMPTY_PROPOSAL_METADATA_LINK,
      );
    }
    // format in the metadata field
    try {
      const metadataCid = resolveIpfsCid(tokenVotingProposal.metadata);
      const metadataString = await this.ipfs.fetchString(metadataCid);
      const metadata = JSON.parse(metadataString) as ProposalMetadata;
      return toTokenVotingProposal(tokenVotingProposal, metadata);
      // TODO: Parse and validate schema
    } catch (err) {
      if (err instanceof InvalidCidError) {
        return toTokenVotingProposal(
          tokenVotingProposal,
          UNSUPPORTED_PROPOSAL_METADATA_LINK,
        );
      }
      return toTokenVotingProposal(
        tokenVotingProposal,
        UNAVAILABLE_PROPOSAL_METADATA,
      );
    }
  }
  /**
   * Returns a list of proposals on the Plugin, filtered by the given criteria
   *
   * @param {ProposalQueryParams} params
   * @return {Promise<TokenVotingProposalListItem[]>}
   * @memberof TokenVotingClient
   */
  public async getProposals({
    daoAddressOrEns,
    limit = 10,
    status,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = ProposalSortBy.CREATED_AT,
  }: ProposalQueryParams): Promise<TokenVotingProposalListItem[]> {
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
    const query = QueryTokenVotingProposals;
    const params = {
      where,
      limit,
      skip,
      direction,
      sortBy,
    };
    const name = "TokenVoting proposals";
    type T = { tokenVotingProposals: SubgraphTokenVotingProposalListItem[] };
    const { tokenVotingProposals } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    return Promise.all(
      tokenVotingProposals.map(
        async (
          proposal: SubgraphTokenVotingProposalListItem,
        ): Promise<TokenVotingProposalListItem> => {
          // format in the metadata field
          if (!proposal.metadata) {
            return toTokenVotingProposalListItem(
              proposal,
              EMPTY_PROPOSAL_METADATA_LINK,
            );
          }
          try {
            const metadataCid = resolveIpfsCid(proposal.metadata);
            // Avoid blocking Promise.all if this individual fetch takes too long
            const stringMetadata = await promiseWithTimeout(
              this.ipfs.fetchString(metadataCid),
              MULTI_FETCH_TIMEOUT,
            );
            const metadata = JSON.parse(stringMetadata) as ProposalMetadata;
            return toTokenVotingProposalListItem(proposal, metadata);
          } catch (err) {
            if (err instanceof InvalidCidError) {
              return toTokenVotingProposalListItem(
                proposal,
                UNSUPPORTED_PROPOSAL_METADATA_LINK,
              );
            }
            return toTokenVotingProposalListItem(
              proposal,
              UNAVAILABLE_PROPOSAL_METADATA,
            );
          }
        },
      ),
    );
  }

  /**
   * Returns the settings of a plugin given the address of the plugin instance
   *
   * @param {string} pluginAddress
   * @param {number} blockNumber
   * @return {Promise<VotingSettings>}
   * @memberof TokenVotingClient
   */
  public async getVotingSettings(
    pluginAddress: string,
    blockNumber?: number,
  ): Promise<VotingSettings | null> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    const query = QueryTokenVotingSettings;
    const params = {
      address: pluginAddress.toLowerCase(),
      block: blockNumber ? { number: blockNumber } : null,
    };
    const name = "TokenVoting settings";
    type T = { tokenVotingPlugin: SubgraphVotingSettings };
    const { tokenVotingPlugin } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (!tokenVotingPlugin) {
      return null;
    }
    return {
      minDuration: parseInt(tokenVotingPlugin.minDuration),
      supportThreshold: decodeRatio(
        BigInt(tokenVotingPlugin.supportThreshold),
        6,
      ),
      minParticipation: decodeRatio(
        BigInt(tokenVotingPlugin.minParticipation),
        6,
      ),
      minProposerVotingPower: BigInt(
        tokenVotingPlugin.minProposerVotingPower,
      ),
      votingMode: tokenVotingPlugin.votingMode,
    };
  }

  /**
   * Returns the details of the token used in a specific plugin instance
   *
   * @param {string} pluginAddress
   * @return {Promise<Erc20TokenDetails | null>}
   * @memberof TokenVotingClient
   */
  public async getToken(
    pluginAddress: string,
  ): Promise<
    Erc20TokenDetails | Erc721TokenDetails | Erc20WrapperTokenDetails | null
  > {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    const query = QueryTokenVotingPlugin;
    const params = {
      address: pluginAddress.toLowerCase(),
    };
    const name = "TokenVoting token";
    type T = {
      tokenVotingPlugin: {
        token:
          | SubgraphErc20Token
          | SubgraphErc721Token
          | SubgraphErc20WrapperToken;
      };
    };
    const { tokenVotingPlugin } = await this.graphql.request<T>({
      query,
      params,
      name,
    });
    if (!tokenVotingPlugin) {
      return null;
    }
    let token:
      | SubgraphErc20Token
      | SubgraphErc721Token
      | SubgraphErc20WrapperToken = tokenVotingPlugin.token;
    // type erc20
    if (token.__typename === SubgraphContractType.ERC20) {
      return {
        address: token.id,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        type: TokenType.ERC20,
      };
      // type erc721
    } else if (token.__typename === SubgraphContractType.ERC721) {
      return {
        address: token.id,
        name: token.name,
        symbol: token.symbol,
        type: TokenType.ERC721,
      };
      // type erc20Wrapper
    } else if (token.__typename === SubgraphContractType.ERC20_WRAPPER) {
      return {
        address: token.id,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        underlyingToken: {
          address: token.underlyingToken.id,
          name: token.underlyingToken.name,
          symbol: token.underlyingToken.symbol,
          decimals: token.underlyingToken.decimals,
          type: TokenType.ERC20,
        },
        type: TokenType.ERC20,
      };
    }
    return null;
  }

  /**
   * Checks if the given token is compatible with the TokenVoting plugin
   *
   * @param {string} tokenAddress
   * @return {Promise<TokenVotingTokenCompatibility>}
   * @memberof TokenVotingClientMethods
   */
  public async isTokenVotingCompatibleToken(
    tokenAddress: string,
  ): Promise<TokenVotingTokenCompatibility> {
    // check if is address
    if (!isAddress(tokenAddress) || tokenAddress === AddressZero) {
      throw new InvalidAddressError();
    }
    const provider = this.web3.getProvider();
    // check if is a contract
    if (await provider.getCode(tokenAddress) === "0x") {
      throw new NotAContractError();
    }
    const contract = new Contract(
      tokenAddress,
      ERC165_ABI,
      provider,
    );

    if (!await isERC20Token(tokenAddress, provider)) {
      return TokenVotingTokenCompatibility.INCOMPATIBLE;
    }
    try {
      if (!await contract.supportsInterface(ERC165_INTERFACE_ID)) {
        return TokenVotingTokenCompatibility.NEEDS_WRAPPING;
      }
      for (const interfaceId of GOVERNANCE_SUPPORTED_INTERFACE_IDS) {
        const isSupported = await contract.supportsInterface(interfaceId);
        if (isSupported) {
          return TokenVotingTokenCompatibility.COMPATIBLE;
        }
      }
      return TokenVotingTokenCompatibility.NEEDS_WRAPPING;
    } catch (e) {
      return TokenVotingTokenCompatibility.NEEDS_WRAPPING;
    }
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
    const query = QueryTokenVotingIsMember;
    const name = "TokenVoting isMember";
    type T = { tokenVotingMember: { id: string } };
    const { tokenVotingMember } = await this.graphql.request<T>({
      query,
      params: {
        id:
          `${params.address.toLowerCase()}_${params.pluginAddress.toLowerCase()}`,
        blockHeight: params.blockNumber ? { number: params.blockNumber } : null,
      },
      name,
    });
    return !!tokenVotingMember;
  }
}
