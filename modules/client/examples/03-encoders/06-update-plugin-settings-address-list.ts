/* MARKDOWN
### Set Plugin Config (Address List)
*/
import {
  ClientAddressList,
  Context,
  ContextPlugin,
  VotingSettings,
} from "@aragon/sdk-client";
import { contextParams } from "../00-client/00-context";

const context: Context = new Context(contextParams);
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
const client = new ClientAddressList(contextPlugin);

// create config action
const configActionPrarms: VotingSettings = {
  minDuration: 60 * 60 * 24 * 2, // seconds
  minParticipation: 0.25, // 25%
  supportThreshold: 0.5, // 50%
  minProposerVotingPower: BigInt("5000"), // default 0
  earlyExecution: true, // default false
  voteReplacement: false, // default false,
};

const pluginAddress = "0x1234567890123456789012345678901234567890";

const configAction = client.encoding.updatePluginSettingsAction(
  pluginAddress,
  configActionPrarms,
);
console.log(configAction);
