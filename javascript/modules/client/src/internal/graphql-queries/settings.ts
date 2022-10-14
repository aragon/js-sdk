import { gql } from "graphql-request";

export const QueryErc20PluginSettings = gql`
query erc20PluginSettings($address: ID!) {
  erc20VotingPackage(id: $address){
    supportRequiredPct
    participationRequiredPct
    minDuration
  }
}
`;
export const QueryAddressListPluginSettings = gql`
query AddressListPluginSettings($address: ID!) {
  allowlistPackage(id: $address){
    supportRequiredPct
    participationRequiredPct
    minDuration
  }
}
`;
