/* MARKDOWN
---
title: Withdraw ERC-721
---

## Withdraws ERC-721 Tokens

Withdraws ERC-721 tokens from the DAO when a proposal passes.
*/
import {
  Client,
  DaoAction,
  TokenType,
  WithdrawParams
} from "@aragon/sdk-client";
import { context } from "../index";

// Instantiate a general purpose client for Aragon OSx SDK context.
const client: Client = new Client(context);

const withdrawParams: WithdrawParams = {
  type: TokenType.ERC721,
  tokenAddress: "0x1234567890123456789012345678901234567890", // ERFC721's token contract address to withdraw
  amount: BigInt(10), // amount of tokens to withdraw
  recipientAddressOrEns: "0x1234567890123456789012345678901234567890" // the address to transfer the funds to
};

const nftWithdrawAction: DaoAction = await client.encoding.withdrawAction(withdrawParams);
console.log({ nftWithdrawAction });
