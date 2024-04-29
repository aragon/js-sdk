import { gql } from "graphql-request";

export const QueryMultisigProposal = gql`
query MultisigProposal($proposalId: ID!) {
  multisigProposal(id: $proposalId){
    id
    dao {
      id
      subdomain
    }
    creator
    metadata
    createdAt
    startDate
    endDate
    actions {
      to
      value
      data
    }
    executionDate
    executionBlockNumber
    creationBlockNumber
    plugin {
      onlyListed
    }
    minApprovals
    executionTxHash
    executed
    approvalReached
    isSignaling
    approvals(first: 1000){
      approver{
        address
      }
    }
  }
}
`;
export const QueryMultisigProposals = gql`
query MultisigProposals($where: MultisigProposal_filter!, $limit:Int!, $skip: Int!, $direction: OrderDirection!, $sortBy: MultisigProposal_orderBy!) {
  multisigProposals(where: $where, first: $limit, skip: $skip, orderDirection: $direction, orderBy: $sortBy){
    id
    dao {
      id
      subdomain
    }
    creator
    metadata
    executed
    approvalReached
    isSignaling
    approvalCount
    startDate
    endDate
    executionDate
    executionBlockNumber
    creationBlockNumber
    approvals(first: 1000){
      approver{
        address
      }
    }
    actions {
      to
      value
      data
    }
    minApprovals
    plugin{
      onlyListed
    }
  }
}
`;
