import {
  SubgraphAction,
  SubgraphVoteValuesMap,
  VoteValues,
  votingSettingsToContract,
} from "../../client-common";
import {
  AddresslistVotingPluginInstall,
  AddresslistVotingProposal,
  AddresslistVotingProposalListItem,
} from "../types";
import {
  ContractAddresslistVotingInitParams,
  SubgraphAddresslistVotingProposal,
  SubgraphAddresslistVotingProposalListItem,
  SubgraphAddresslistVotingVoterListItem,
} from "./types";
import {
  DaoAction,
  decodeRatio,
  getCompactProposalId,
  hexToBytes,
  InvalidProposalStatusError,
  ProposalMetadata,
  ProposalStatus,
} from "@aragon/sdk-client-common";

export function toAddresslistVotingProposal(
  proposal: SubgraphAddresslistVotingProposal,
  metadata: ProposalMetadata,
): AddresslistVotingProposal {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const creationDate = new Date(
    parseInt(proposal.createdAt) * 1000,
  );
  const executionDate = proposal.executionDate
    ? new Date(
      parseInt(proposal.executionDate) * 1000,
    )
    : null;
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
      description: metadata.description,
      resources: metadata.resources,
      media: metadata.media,
    },
    metadataHash: proposal.metadata,
    startDate,
    endDate,
    creationDate,
    executionTxHash: proposal.executionTxHash || null,
    creationBlockNumber: parseInt(proposal.creationBlockNumber),
    executionDate,
    executionBlockNumber: parseInt(proposal.executionBlockNumber) || null,
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(action.data),
          to: action.to,
          value: BigInt(action.value),
        };
      },
    ),
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? parseInt(proposal.yes) : 0,
      no: proposal.no ? parseInt(proposal.no) : 0,
      abstain: proposal.abstain ? parseInt(proposal.abstain) : 0,
    },
    settings: {
      supportThreshold: decodeRatio(BigInt(proposal.supportThreshold), 6),
      minParticipation: decodeRatio(
        (BigInt(proposal.minVotingPower) * BigInt(1000000)) /
          BigInt(proposal.totalVotingPower),
        6,
      ),
      duration: parseInt(proposal.endDate) -
        parseInt(proposal.startDate),
    },
    totalVotingWeight: parseInt(proposal.totalVotingPower),
    votes: proposal.voters.map(
      (voter: SubgraphAddresslistVotingVoterListItem) => {
        return {
          voteReplaced: voter.voteReplaced,
          address: voter.voter.address,
          vote: SubgraphVoteValuesMap.get(voter.voteOption) as VoteValues,
        };
      },
    ),
  };
}
export function toAddresslistVotingProposalListItem(
  proposal: SubgraphAddresslistVotingProposalListItem,
  metadata: ProposalMetadata,
): AddresslistVotingProposalListItem {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
    },
    metadataHash: proposal.metadata,
    startDate,
    endDate,
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? parseInt(proposal.yes) : 0,
      no: proposal.no ? parseInt(proposal.no) : 0,
      abstain: proposal.abstain ? parseInt(proposal.abstain) : 0,
    },
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(action.data),
          to: action.to,
          value: BigInt(action.value),
        };
      },
    ),
    votes: proposal.voters.map(
      (voter: SubgraphAddresslistVotingVoterListItem) => {
        return {
          voteReplaced: voter.voteReplaced,
          address: voter.voter.address,
          vote: SubgraphVoteValuesMap.get(voter.voteOption) as VoteValues,
        };
      },
    ),
  };
}

export function addresslistVotingInitParamsToContract(
  params: AddresslistVotingPluginInstall,
): ContractAddresslistVotingInitParams {
  return [
    votingSettingsToContract(params.votingSettings),
    params.addresses,
  ];
}

export function computeProposalStatus(
  proposal:
    | SubgraphAddresslistVotingProposal
    | SubgraphAddresslistVotingProposalListItem,
): ProposalStatus {
  const now = new Date();
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  // The proposal is executed so the status becomes EXECUTED
  // independently of the other conditions
  if (proposal.executed) {
    return ProposalStatus.EXECUTED;
  }
  // The proposal is not executed and the start date is in the future
  // so the status becomes PENDING
  if (startDate >= now) {
    return ProposalStatus.PENDING;
  }
  // The proposal is not executed and the start date is in the past.
  // Accordingly, we check if the proposal reached enough approval
  // (i.e., that the supportThreshold and minParticipation criteria are both met).
  // If approvalReached is true and the vote has ended (end date is in the past), it has succeeded.
  // This applies to normal mode and vote replacement mode.
  if (proposal.approvalReached && endDate <= now) {
    return ProposalStatus.SUCCEEDED;
  }
  // In early exeuction mode, we calculate if subsequent voting can change the result of the vote.
  // If not, the proposal is early executable and is therefore succeeded as well.
  if (proposal.earlyExecutable) {
    return ProposalStatus.SUCCEEDED;
  }
  // The proposal is not executed and the start date is in the past
  // and the approval threshold is not reached
  // If the end date is in the future this means that you can still vote
  // so the status becomes ACTIVE
  if (now < endDate) {
    return ProposalStatus.ACTIVE;
  }
  // If none of the other conditions are met the status becomes DEFEATED
  return ProposalStatus.DEFEATED;
}

export function computeProposalStatusFilter(status: ProposalStatus) {
  let where = {};
  const now = Math.round(new Date().getTime() / 1000).toString();
  switch (status) {
    case ProposalStatus.PENDING:
      where = { startDate_gte: now };
      break;
    case ProposalStatus.ACTIVE:
      where = { startDate_lt: now, endDate_gte: now, executed: false };
      break;
    case ProposalStatus.EXECUTED:
      where = { executed: true };
      break;
    case ProposalStatus.SUCCEEDED:
      where = {
        or: [
          { approvalReached: true, endDate_lt: now },
          { earlyExecutable: true },
        ],
      };
      break;
    case ProposalStatus.DEFEATED:
      where = {
        potentiallyExecutable: false,
        endDate_lt: now,
        executed: false,
      };
      break;
    default:
      throw new InvalidProposalStatusError();
  }
  return where;
}
