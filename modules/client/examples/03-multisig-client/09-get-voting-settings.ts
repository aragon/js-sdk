/* MARKDOWN
### Get voting settings (Multisig)

Get the settings of a Multisig plugin from a specific DAO.
*/

import {
  ContextPlugin,
  MultisigClient,
  MultisigVotingSettings
} from "@aragon/sdk-client";
import { context } from "../01-client/index";

// Instantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Insantiate a Multisig client.
const multisigClient: MultisigClient = new MultisigClient(contextPlugin);

const daoAddressorEns: string = "0x12345348523485623984752394854320";

const multisigSettings: MultisigVotingSettings = await multisigClient.methods.getVotingSettings(daoAddressorEns);
console.log({ multisigSettings });

/* MARKDOWN
Returns:
```json
{
  votingSettings: {
    minApprovals: 4,
    onlyListed: true
  }
}
```
*/