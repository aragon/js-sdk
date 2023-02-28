/* MARKDOWN
### Execute the actions of a Multisig proposal

Executes the actions set within a proposal made using the Multisig plugin.
*/

import {
  ContextPlugin,
  ExecuteProposalStep,
  MultisigClient
} from "@aragon/sdk-client";
import { context } from "../00-setup/00-getting-started";

// Insantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Insantiate a Multisig client.
const multisigClient = new MultisigClient(contextPlugin);

const executeProposalParams = {
  pluginAddress: "0x1234567890123456789012345678901234567890" // the address of the Multisig plugin contract installed into the DAO.
}

// Executes the actions of a Multisig proposal.
const steps = multisigClient.methods.executeProposal(executeProposalParams);

for await (const step of steps) {
  try {
    switch (step.key) {
      case ExecuteProposalStep.EXECUTING:
        console.log(step.txHash);
        break;
      case ExecuteProposalStep.DONE:
        break;
    }
  } catch (err) {
    console.error({ err });
  }
}
