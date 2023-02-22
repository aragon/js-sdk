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

export type MajorityVotingSettingsBase = {
  /** Float between 0 and 1 */
  supportThreshold: number;
  /** Float between 0 and 1 */
  minParticipation: number;
};

export type MajorityVotingProposalSettings = MajorityVotingSettingsBase & {
  duration: number;
};
export type MajorityVotingSettings = MajorityVotingSettingsBase & {
  /* default is standard */
  votingMode?: VotingMode;
  /* minimum is 3600 */
  minDuration: number;
  /* default is 0 */
  minProposerVotingPower?: bigint;
};

export type VotingSettings = MajorityVotingSettings

export enum VotingMode {
  STANDARD = "Standard",
  EARLY_EXECUTION = "EarlyExecution",
  VOTE_REPLACEMENT = "VoteReplacement",
}

export type ContractVotingSettings = [
  BigNumber, // votingMode
  BigNumber, // supportThreshold
  BigNumber, // minParticipation
  BigNumber, // minDuration
  BigNumber, // minProposerVotingPower
];


export type CreateProposalBaseParams = {
  pluginAddress: string;
  actions?: DaoAction[];
  /** For every action item, denotes whether its execution could fail
   * without aborting the whole proposal execution */
  failSafeActions?: Array<boolean>;
  metadataUri: string;
};

export type CreateMajorityVotingProposalParams = CreateProposalBaseParams & {
  startDate?: Date;
  endDate?: Date;
  executeOnPass?: boolean;
  creatorVote?: VoteValues;
}

export interface IVoteProposalParams {
  vote: VoteValues;
  proposalId: string;
}

export interface ICanVoteParams {
  proposalId: string;
  address: string;
  vote: VoteValues;
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
    address: string;
  };
  voteReplaced: boolean;
  voteOption: SubgraphVoteValues;
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
    subdomain: string;
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
  | { key: VoteProposalStep.DONE };

// PROPOSAL EXECUTION
export enum ExecuteProposalStep {
  EXECUTING = "executing",
  DONE = "done",
}

export type ExecuteProposalStepValue =
  | { key: ExecuteProposalStep.EXECUTING; txHash: string }
  | { key: ExecuteProposalStep.DONE };

export type ContractPluginSettings = [BigNumber, BigNumber, BigNumber];

export type SubgraphVotingSettings = {
  minDuration: string;
  minProposerVotingPower: string;
  minParticipation: string;
  supportThreshold: string;
  votingMode: VotingMode;
};
