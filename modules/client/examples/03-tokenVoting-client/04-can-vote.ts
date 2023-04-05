/* MARKDOWN
---
title: Check Voting Rights
---

## Check if an Address Can Vote in a Token Voting proposal

This function returns a boolean indicating whether an address can vote in a specific TokenVoting proposal.
*/

import {
  CanVoteParams,
  ContextPlugin,
  TokenVotingClient,
  VoteValues,
} from "@aragon/sdk-client";
import { context } from "../index";

// Instantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);

// Create an TokenVoting client.
const tokenVotingClient: TokenVotingClient = new TokenVotingClient(
  contextPlugin,
);

const canVoteParams: CanVoteParams = {
  proposalId: "0x1234567890123456789012345678901234567890_0x0",
  voterAddressOrEns: "0x1234567890123456789012345678901234567890", // your-plugin.plugin.dao.eth
  vote: VoteValues.YES, // alternatively, could be  NO or ABSTAIN.
};

// Returns true or false depending on whether the address can vote in the specific proposal.
const canVote: boolean = await tokenVotingClient.methods.canVote(canVoteParams);
console.log(canVote);

/* MARKDOWN
Returns:

```
true
```
*/
