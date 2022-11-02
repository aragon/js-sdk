import {
  GraphQLError,
  InvalidAddressError,
  InvalidAddressOrEnsError,
  InvalidProposalIdError,
  NoProviderError,
  Random,
} from "@aragon/sdk-common";
import { delay } from "../../../client-common/temp-mock";
import { isAddress } from "@ethersproject/address";
import {
  AddressListProposal,
  AddressListProposalListItem,
  IClientAddressListMethods,
  SubgraphAddressListProposal,
  SubgraphAddressListProposalListItem,
} from "../../interfaces";
import {
  ClientCore,
  computeProposalStatusFilter,
  ContextPlugin,
  ExecuteProposalStep,
  ExecuteProposalStepValue,
  ICanVoteParams,
  ICreateProposalParams,
  IExecuteProposalParams,
  IPluginSettings,
  IProposalQueryParams,
  isProposalId,
  IVoteProposalParams,
  ProposalCreationSteps,
  ProposalCreationStepValue,
  ProposalMetadata,
  ProposalSortBy,
  SortDirection,
  VoteProposalStep,
  VoteProposalStepValue,
} from "../../../client-common";
import {
  QueryAddressListProposal,
  QueryAddressListProposals,
} from "../graphql-queries/proposal";
import { toAddressListProposal, toAddressListProposalListItem } from "../utils";
import { QueryAddressListPluginSettings } from "../graphql-queries/settings";

export class ClientAddressListMethods extends ClientCore
  implements IClientAddressListMethods {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(ClientAddressListMethods.prototype);
    Object.freeze(this);
  }
  /**
   * Creates a new proposal on the given AddressList plugin contract
   *
   * @param {ICreateProposalParams} _params
   * @return {*}  {AsyncGenerator<ProposalCreationStepValue>}
   * @memberof ClientAddressListMethods
   */
  public async *createProposal(
    _params: ICreateProposalParams,
  ): AsyncGenerator<ProposalCreationStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    // TODO: Implement
    await delay(1000);
    yield {
      key: ProposalCreationSteps.CREATING,
      txHash:
        "0x0123456789012345678901234567890123456789012345678901234567890123",
    };
    await delay(3000);
    yield {
      key: ProposalCreationSteps.DONE,
      proposalId:
        "0x0123456789012345678901234567890123456789012345678901234567890123",
    };
  }
  /**
   * Cast a vote on the given proposal using the client's wallet. Depending on the proposal settings, an affirmative vote may execute the proposal's actions on the DAO.
   *
   * @param {IVoteProposalParams} _params
   * @return {*}  {AsyncGenerator<VoteProposalStepValue>}
   * @memberof ClientAddressListMethods
   */
  public async *voteProposal(
    _params: IVoteProposalParams,
  ): AsyncGenerator<VoteProposalStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    // TODO: Implement
    await delay(1000);
    yield {
      key: VoteProposalStep.VOTING,
      txHash:
        "0x0123456789012345678901234567890123456789012345678901234567890123",
    };
    await delay(3000);
    yield {
      key: VoteProposalStep.DONE,
      voteId:
        "0x0123456789012345678901234567890123456789012345678901234567890123",
    };
  }

  /**
   * Executes the given proposal, provided that it has already passed
   *
   * @param {IExecuteProposalParams} _params
   * @return {*}  {AsyncGenerator<ExecuteProposalStepValue>}
   * @memberof ClientAddressListMethods
   */
  public async *executeProposal(
    _params: IExecuteProposalParams,
  ): AsyncGenerator<ExecuteProposalStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    // TODO: Implement
    await delay(1000);
    yield {
      key: ExecuteProposalStep.EXECUTING,
      txHash:
        "0x0123456789012345678901234567890123456789012345678901234567890123",
    };
    await delay(3000);
    yield {
      key: ExecuteProposalStep.DONE,
    };
  }
  /**
   * Checks if an user can vote in a proposal
   *
   * @param {ICanVoteParams} params
   * @return {*}  {Promise<boolean>}
   * @memberof ClientAddressListMethods
   */
  public async canVote(
    params: ICanVoteParams,
  ): Promise<boolean> {
    const signer = this.web3.getConnectedSigner();
    if (!signer.provider) {
      throw new NoProviderError();
    } else if (!isAddress(params.address) || !isAddress(params.pluginAddress)) {
      throw new InvalidAddressError();
    } else if (!isProposalId(params.proposalId)) {
      throw new InvalidProposalIdError();
    }

    // TODO: Implement
    await delay(1000);
    return parseInt(params.address.slice(-1), 16) % 2 === 1;
  }
  /**
   * Returns the list of wallet addresses with signing capabilities on the plugin
   *
   * @param {string} _daoAddressOrEns
   * @return {*}  {Promise<string[]>}
   * @memberof ClientAddressListMethods
   */
  public getMembers(_daoAddressOrEns: string): Promise<string[]> {
    const mockAddresses: string[] = [
      "0x0123456789012345678901234567890123456789",
      "0x1234567890123456789012345678901234567890",
      "0x2345678901234567890123456789012345678901",
      "0x3456789012345678901234567890123456789012",
      "0x4567890123456789012345678901234567890123",
    ];

    // TODO: Implement

    return new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
      mockAddresses.filter(() => Random.getFloat() > 0.4)
    );
  }
  /**
   * Returns the details of the given proposal
   *
   * @param {string} proposalId
   * @return {*}  {(Promise<AddressListProposal | null>)}
   * @memberof ClientAddressListMethods
   */
  public async getProposal(
    proposalId: string,
  ): Promise<AddressListProposal | null> {
    if (!proposalId) {
      throw new InvalidProposalIdError();
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const { allowlistProposal: addressListProposal }: {
        allowlistProposal: SubgraphAddressListProposal;
      } = await client.request(
        QueryAddressListProposal,
        {
          proposalId,
        },
      );
      if (!addressListProposal) {
        return null;
      }
      // TODO
      // delete this cid once the proposals in subgraph have the correct
      // format in the metadata field
      const test_cid = "QmXhJawTJ3PkoKMyF3a4D89zybAHjpcGivkb7F1NkHAjpo";
      const metadataString = await this.ipfs.fetchString(test_cid);
      // TODO: Parse and validate schema
      const metadata = JSON.parse(metadataString) as ProposalMetadata;
      return toAddressListProposal(addressListProposal, metadata);
    } catch (err) {
      throw new GraphQLError("AddressList proposal");
    }
  }

  /**
   * Returns a list of proposals on the Plugin, filtered by the given criteria
   *
   * @param {IProposalQueryParams} {
   *       daoAddressOrEns,
   *       limit = 10,
   *       status,
   *       skip = 0,
   *       direction = SortDirection.ASC,
   *       sortBy = ProposalSortBy.CREATED_AT,
   *     }
   * @return {*}  {Promise<AddressListProposalListItem[]>}
   * @memberof ClientAddressListMethods
   */
  public async getProposals(
    {
      daoAddressOrEns,
      limit = 10,
      status,
      skip = 0,
      direction = SortDirection.ASC,
      sortBy = ProposalSortBy.CREATED_AT,
    }: IProposalQueryParams,
  ): Promise<AddressListProposalListItem[]> {
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
    if (status) {
      where = { ...where, ...computeProposalStatusFilter(status) };
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const { allowlistProposals: addressListProposals }: {
        allowlistProposals: SubgraphAddressListProposalListItem[];
      } = await client.request(
        QueryAddressListProposals,
        {
          where,
          limit,
          skip,
          direction,
          sortBy,
        },
      );
      await this.ipfs.ensureOnline();
      return Promise.all(
        addressListProposals.map(
          (
            proposal: SubgraphAddressListProposalListItem,
          ): Promise<AddressListProposalListItem> => {
            // TODO
            // delete this cid once the proposals in subgraph have the correct
            // format in the metadata field
            const test_cid = "QmXhJawTJ3PkoKMyF3a4D89zybAHjpcGivkb7F1NkHAjpo";
            return this.ipfs.fetchString(test_cid).then(
              (stringMetadata: string) => {
                // TODO: Parse and validate schema
                const metadata = JSON.parse(stringMetadata) as ProposalMetadata;
                return toAddressListProposalListItem(proposal, metadata);
              },
            );
          },
        ),
      );
    } catch {
      throw new GraphQLError("AddressList proposals");
    }
  }

  /**
   * Returns the settings of a plugin given the address of the plugin instance
   *
   * @param {string} pluginAddress
   * @return {*}  {(Promise<IPluginSettings | null>)}
   * @memberof ClientAddressListMethods
   */
  public async getSettings(
    pluginAddress: string,
  ): Promise<IPluginSettings | null> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const { allowlistPackage } = await client.request(
        QueryAddressListPluginSettings,
        {
          address: pluginAddress,
        },
      );
      if (!allowlistPackage) {
        return null;
      }
      return {
        // TODO
        // the number of decimals in the minSupport and minTurnout
        // is wrong, they have no precision
        minDuration: parseInt(allowlistPackage.minDuration),
        minSupport: parseFloat(allowlistPackage.supportRequiredPct),
        minTurnout: parseFloat(allowlistPackage.participationRequiredPct),
      };
    } catch {
      throw new Error("Cannot fetch the settings data from GraphQL");
    }
  }
}
