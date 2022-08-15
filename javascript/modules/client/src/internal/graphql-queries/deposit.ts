import { gql } from "graphql-request";

export const QueryDeposits = gql`
query deposits($address: ID!, $limit: Int = 10, $skip: Int = 0) {
  vaultDeposits(where: {to: $address}, limit: $limit, skip: $skip){
    id
    token {
      symbol
      decimals
      symbol
    }
    sender
    dao {
      id
      name
    }
    amount
    reference
    transaction
    creationDate
  }
}
`