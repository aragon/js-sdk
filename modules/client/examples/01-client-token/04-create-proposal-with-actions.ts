/* MARKDOWN
### Creating a TokenVoting proposal with an action
*/
import {
  Context,
  ContextPlugin,
  ICreateProposalParams,
  ProposalCreationSteps,
  TokenVotingClient,
  VoteValues,
  VotingSettings,
} from "@aragon/sdk-client";
import { contextParams } from "../00-client/00-context";

// Create a simple context
const context: Context = new Context(contextParams);
// Create a plugin context from the simple context
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Create a TokenVoting client
const client = new TokenVotingClient(contextPlugin);

// create config action
const configActionPrarms: VotingSettings = {
  minDuration: 60 * 60 * 24 * 2, // seconds
  minParticipation: 0.25, // 25%
  supportThreshold: 0.5, // 50%
  minProposerVotingPower: BigInt("5000"), // default 0
  earlyExecution: true, // default false
  voteReplacement: false, // default false
};

const pluginAddress = "0x1234567890123456789012345678901234567890";

const configAction = client.encoding.updatePluginSettingsAction(
  pluginAddress,
  configActionPrarms,
);

const proposalParams: ICreateProposalParams = {
  pluginAddress: "0x1234567890123456789012345678901234567890",
  metadataUri: "ipfs://123456",
  actions: [configAction],
  startDate: new Date(),
  endDate: new Date(),
  executeOnPass: false,
  creatorVote: VoteValues.YES,
};

const steps = client.methods.createProposal(proposalParams);
for await (const step of steps) {
  try {
    switch (step.key) {
      case ProposalCreationSteps.CREATING:
        console.log(step.txHash);
        break;
      case ProposalCreationSteps.DONE:
        console.log(step.proposalId);
        break;
    }
  } catch (err) {
    console.error(err);
  }
}