/* MARKDOWN
---
title: Pin Metadata
---

## Add and Pin Metadata

Adds and pins data with into one of the specified IPFS nodes and return an IPFS CID preceded by "ipfs://".
*/

import {
  ContextPlugin,
  ProposalMetadata,
  TokenVotingClient,
} from "@aragon/sdk-client";
import { context } from "../index";

// Instantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Create an TokenVoting client.
const tokenVotingClient: TokenVotingClient = new TokenVotingClient(
  contextPlugin,
);

const metadata: ProposalMetadata = {
  title: "Test Proposal",
  summary: "This is a short description",
  description: "This is a long description",
  resources: [
    {
      name: "Discord",
      url: "https://discord.com/...",
    },
    {
      name: "Website",
      url: "https://website...",
    },
  ],
  media: {
    logo: "https://...",
    header: "https://...",
  },
};

// Pin the metadata in IPFS to get back the URI.
const metadataUri: string = await tokenVotingClient.methods.pinMetadata(
  metadata,
);
console.log(metadataUri);

/* MARKDOWN
Returns:

```json
"ipfs://Qm..."
```
*/
