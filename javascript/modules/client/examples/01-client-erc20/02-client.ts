/* MARKDOWN
### Create an ERC20 client
*/
import { ClientErc20, Context, ContextPlugin } from "@aragon/sdk-client";
import { contextParams } from "../00-client/00-context";

const context = new Context(contextParams);
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);

const client = new ClientErc20(contextPlugin);

console.log(client);
