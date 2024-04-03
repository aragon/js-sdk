import { SubgraphProposalBase } from "../../client-common";

export type SubgraphMultisigProposalBase = SubgraphProposalBase & {
  plugin: SubgraphMultisigVotingSettings;
  minApprovals: number;
  approvalReached: boolean;
  approvers: { id: string, approver: { address: string} }[];
  // TODO change on subgraph fix
  // approvers: SubgraphMultisigApproversListItem[];
};

export type SubgraphMultisigProposalListItem = SubgraphMultisigProposalBase;

export type SubgraphMultisigProposal = SubgraphMultisigProposalBase & {
  createdAt: string;
  executionTxHash: string;
  executionDate: string;
  executionBlockNumber: string;
  creationBlockNumber: string;
};

export type SubgraphMultisigApproversListItem = {
  approver: { id: string };
};

export type SubgraphMultisigVotingSettings = {
  minApprovals: number;
  onlyListed: boolean;
};
