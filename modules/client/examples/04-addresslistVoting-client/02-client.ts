/* MARKDOWN
### Create an Address List client
*/
import { AddresslistVotingClient, Context, ContextPlugin } from "@aragon/sdk-client";
import { contextParams } from "../00-client/00-context";

const context = new Context(contextParams);
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);

const client = new AddresslistVotingClient(contextPlugin);

console.log(client);
