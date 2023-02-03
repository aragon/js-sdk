/* Markdown
## Setting up the clients

Next think you want to do is probably set up the general purpose client. This client is used to interact with any DAO on the network you're connected to.

The [Client](./src/client.ts) class allows you to perform operations that apply to all DAOs, regardless of the plugins they use.

We also have clients for each plugin, which allow us to use the plugin-specific functions.

Clients can be stored in a singleton and inherited from there. Can also be stored in a [context hook](https://www.freecodecamp.org/news/react-context-for-beginners/) for easier use throughout your Javascript framework.
*/

import { Client } from "@aragon/sdk-client";
import { context } from "../00-setup/00-getting-started";

// Instantiate the general purpose client.
const client: Client = new Client(context);
console.log({ client });



