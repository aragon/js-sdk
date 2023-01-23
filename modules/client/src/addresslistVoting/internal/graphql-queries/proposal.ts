import { gql } from "graphql-request";

export const QueryAddresslistVotingProposal = gql`
query AddresslistVotingProposal($proposalId: ID!) {
  addresslistVotingProposal(id: $proposalId){
    id
    dao {
      id
      name
    }
    creator
    metadata
    createdAt
    creationBlockNumber
    executionDate
    executionBlockNumber
    actions {
      to
      value
      data
    }
    yes,
    no,
    abstain
    votingMode
    supportThreshold
    minParticipation
    startDate
    endDate
    executed
    executable
    voters{
      voter{
        address
      }
      voteOption
    }
    totalVotingPower
  }
}
`;
export const QueryAddresslistVotingProposals = gql`
query AddresslistVotingProposals($where: AddresslistVotingProposal_filter!, $limit:Int!, $skip: Int!, $direction: OrderDirection!, $sortBy: AddresslistVotingProposal_orderBy!) {
  addresslistVotingProposals(where: $where, first: $limit, skip: $skip, orderDirection: $direction, orderBy: $sortBy){
    id
    dao {
      id
      name
    }
    creator
    metadata
    yes
    no
    abstain
    startDate
    endDate
    executed
    executable
  }
}
`;
