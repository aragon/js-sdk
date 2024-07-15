import { gql } from "graphql-request";

export const QueryMultisigMembers = gql`
query MultisigMembers($where: MultisigApprover_filter!, $block: Block_height, $limit: Int!, $skip: Int!, $sortBy: MultisigApprover_orderBy!, $direction: OrderDirection!) {
  multisigApprovers(
    where: $where
    block: $block
    first: $limit
    skip: $skip
    orderBy: $sortBy
    orderDirection: $direction
  ) {
    address
    isActive
  }
}
`;

export const QueryMultisigIsMember = gql`
query MultisigIsMember($id: ID!, $block: Block_height) {
  multisigApprover(
    id: $id
    block: $block
  ) {
    id
  }
}`;
