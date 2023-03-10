/* MARKDOWN
---
title: Set DAO URI
---

## Set the DAO URI

Encodes the action of setting the DAO's URI.

### Encoding
*/

import { Client, ContextPlugin, DaoAction } from "@aragon/sdk-client";
import { context } from "../../index";

// Initializes the Context pluigin from the Aragon SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Initializes the general purpose client using the plugin's context.
const client: Client = new Client(contextPlugin);

const daoAddressOrEns: string = "0x123123123123123123123123123123123123";

const daoUri: string = "https://the.dao/uri"; // the URI to be defined for the DAO.

const action: DaoAction = client.encoding.setDaoUriAction(
  daoAddressOrEns,
  daoUri
);
console.log({ action });

/* MARKDOWN
Returns:

```json
  {
    to: "0x123123123...",
    value: 0n,
    data: Uint8Array[12,34,45...]
  }
```

### Decoding

Decodes the action of setting a DAO's URI
*/

const decodedParams: string = client.decoding.setDaoUriAction(action.data);
console.log({ decodedParams });

/* MARKDOWN
Returns:

```
  { decodedParams: "https://the.dao.uri" }
```
*/