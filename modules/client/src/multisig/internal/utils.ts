import { SubgraphAction } from "../../client-common";
import { MultisigProposal, MultisigProposalListItem } from "../types";
import {
  SubgraphMultisigProposal,
  SubgraphMultisigProposalListItem,
} from "./types";
import {
  DaoAction,
  getCompactProposalId,
  hexToBytes,
  InvalidProposalStatusError,
  ProposalMetadata,
  ProposalStatus,
} from "@aragon/sdk-client-common";

export function toMultisigProposal(
  proposal: SubgraphMultisigProposal,
  metadata: ProposalMetadata,
): MultisigProposal {
  const creationDate = new Date(
    parseInt(proposal.createdAt) * 1000,
  );
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(
    parseInt(proposal.endDate) * 1000,
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
    settings: {
      onlyListed: proposal.plugin.onlyListed,
      minApprovals: proposal.minApprovals,
    },
    creationBlockNumber: parseInt(proposal.creationBlockNumber) || 0,
    creationDate,
    startDate,
    endDate,
    executionDate,
    executionBlockNumber: parseInt(proposal.executionBlockNumber) || null,
    executionTxHash: proposal.executionTxHash || null,
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
    approvals: proposal.approvals.map(
      (a) => a.approver.address,
    ),
  };
}
export function toMultisigProposalListItem(
  proposal: SubgraphMultisigProposalListItem,
  metadata: ProposalMetadata,
): MultisigProposalListItem {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(
    parseInt(proposal.endDate) * 1000,
  );
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
    approvals: proposal.approvals.map(
      (a) => a.approver.address,
    ),
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(action.data),
          to: action.to,
          value: BigInt(action.value),
        };
      },
    ),
    settings: {
      onlyListed: proposal.plugin.onlyListed,
      minApprovals: proposal.minApprovals,
    },
    startDate,
    endDate,
    status: computeProposalStatus(proposal),
  };
}

export function computeProposalStatus(
  proposal: SubgraphMultisigProposal | SubgraphMultisigProposalListItem,
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
  // The proposal is not executed and the start date is in the past
  // So we must check if the proposal reached the approval threshold
  // If it reached the approval threshold and it's a signaling proposal
  // the status becomes SUCCEEDED
  // If it reached the approval threshold and it's not a signaling proposal
  // the status becomes SUCCEEDED if if it hasn't reached the end date
  if (proposal.approvalReached) {
    if (proposal.isSignaling) {
      return ProposalStatus.SUCCEEDED;
    }
    if (now <= endDate) {
      return ProposalStatus.SUCCEEDED;
    }
  }
  // The proposal is not executed and the start date is in the past
  // and the approval threshold is not reached
  // If the end date is in the future this means that you can still vote
  // so the status becomes ACTIVE
  if (now <= endDate) {
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
          { approvalReached: true, endDate_lt: now, isSignaling: false },
          { approvalReached: true, isSignaling: true },
        ],
      };
      break;
    case ProposalStatus.DEFEATED:
      where = {
        endDate_lt: now,
        executed: false,
      };
      break;
    default:
      throw new InvalidProposalStatusError();
  }
  return where;
}
