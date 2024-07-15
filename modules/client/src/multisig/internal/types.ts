import { SubgraphProposalBase } from "../../client-common";

export type SubgraphMultisigProposalBase = SubgraphProposalBase & {
  plugin: SubgraphMultisigVotingSettings;
  minApprovals: number;
  approvalReached: boolean;
  approvals: SubgraphMultisigApproversListItem[];
};

export type SubgraphMultisigProposalListItem = SubgraphMultisigProposalBase;

export type SubgraphMultisigProposal = SubgraphMultisigProposalBase & {
  createdAt: string;
  executionTxHash: string;
  executionDate: string;
  executionBlockNumber: string;
  creationBlockNumber: string;
};

export type Approver = {
  address: string,
  isActive: boolean
}

export type SubgraphMultisigApproversListItem = {
  approver: { address: string };
};

export type SubgraphMultisigVotingSettings = {
  minApprovals: number;
  onlyListed: boolean;
};
