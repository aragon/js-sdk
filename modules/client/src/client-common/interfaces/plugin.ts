import { BigNumber } from "@ethersproject/bignumber";
import { DaoAction, IPagination } from "./common";


/**
 * Contains the states of a proposal. Note that on chain
 * proposals cannot be in draft state
 */
export enum ProposalStatus {
  ACTIVE = "Active",
  PENDING = "Pending",
  SUCCEEDED = "Succeeded",
  EXECUTED = "Executed",
  DEFEATED = "Defeated",
}

export enum VoteValues {
  // NONE = 0,
  ABSTAIN = 1,
  YES = 2,
  NO = 3,
}

// TYPES
export interface IProposalSettings {
  /** Float: 0 to 1 */
  minSupport: number;
  /** Float: 0 to 1 */
  minTurnout: number;
  /** In seconds */
  duration: number;
}

export interface IPluginSettings {
  /** Float: 0 to 1 */
  minSupport: number;
  /** Float: 0 to 1 */
  minTurnout: number;
  /** In seconds */
  minDuration: number;
}

export interface ICreateProposalParams {
  pluginAddress: string;
  metadata: ProposalMetadata;
  actions?: DaoAction[];
  startDate?: Date;
  endDate?: Date;
  executeOnPass?: boolean;
  creatorVote?: VoteValues;
}

export interface IVoteProposalParams {
  pluginAddress: string;
  vote: VoteValues;
  proposalId: string;
}

export interface IExecuteProposalParams {
  pluginAddress: string;
  proposalId: string;
}

export interface ICanVoteParams {
  pluginAddress: string;
  proposalId: string;
  address: string;
}

/**
 * Contains the human-readable information about a proposal
 */
export type ProposalMetadata = {
  title: string;
  summary: string;
  description: string;
  resources: Array<{ url: string; name: string }>;
  media?: {
    header?: string;
    logo?: string;
  };
};

/**
 * Contains the human-readable information about a proposal
 */
export type ProposalMetadataSummary = {
  title: string;
  summary: string;
};

// Long version
export type ProposalBase = {
  id: string;
  dao: {
    address: string;
    name: string;
  };
  creatorAddress: string;
  metadata: ProposalMetadata;
  startDate: Date;
  endDate: Date;
  creationDate: Date;
  actions: Array<DaoAction>;
  status: ProposalStatus;
};

// Short version
export type ProposalListItemBase = {
  id: string;
  dao: {
    address: string;
    name: string;
  };
  creatorAddress: string;
  metadata: ProposalMetadataSummary;
  startDate: Date;
  endDate: Date;
  status: ProposalStatus;
};

export enum SubgraphVoteValues {
  YES = "Yes",
  NO = "No",
  ABSTAIN = "Abstain",
}
export const SubgraphVoteValuesMap: Map<
  SubgraphVoteValues,
  VoteValues
> = new Map([
  [SubgraphVoteValues.YES, VoteValues.YES],
  [SubgraphVoteValues.NO, VoteValues.NO],
  [SubgraphVoteValues.ABSTAIN, VoteValues.ABSTAIN],
]);

export type SubgraphVoterListItemBase = {
  voter: {
    id: string;
  };
  vote: SubgraphVoteValues;
};

export type SubgraphAction = {
  to: string;
  value: string;
  data: string;
};

export type SubgraphProposalBase = {
  id: string;
  dao: {
    id: string;
    name: string;
  };
  creator: string;
  metadata: string;
  yes: string;
  no: string;
  abstain: string;
  startDate: string;
  endDate: string;
  executed: boolean;
  executable: boolean;
};

export interface IComputeStatusProposal {
  startDate: string;
  endDate: string;
  executed: boolean;
  executable: boolean;
}

export interface IProposalQueryParams extends IPagination {
  sortBy?: ProposalSortBy;
  status?: ProposalStatus;
  daoAddressOrEns?: string;
}

export enum ProposalSortBy {
  CREATED_AT = "createdAt",
  NAME = "name",
  POPULARITY = "popularity",
  VOTES = "votes", // currently defined as number of proposals
}

// STEPS

// PROPOSAL CREATION
export enum ProposalCreationSteps {
  CREATING = "creating",
  DONE = "done",
}

export type ProposalCreationStepValue =
  | { key: ProposalCreationSteps.CREATING; txHash: string }
  | { key: ProposalCreationSteps.DONE; proposalId: string };

// PROPOSAL VOTING
export enum VoteProposalStep {
  VOTING = "voting",
  DONE = "done",
}

export type VoteProposalStepValue =
  | { key: VoteProposalStep.VOTING; txHash: string }
  | { key: VoteProposalStep.DONE; voteId: string };

// PROPOSAL EXECUTION
export enum ExecuteProposalStep {
  EXECUTING = "executing",
  DONE = "done",
}

export type ExecuteProposalStepValue =
  | { key: ExecuteProposalStep.EXECUTING; txHash: string }
  | { key: ExecuteProposalStep.DONE };

export type ContractPluginSettings = [BigNumber, BigNumber, BigNumber];
