// @ts-ignore
declare const describe, it, expect, beforeAll, afterAll;

// mocks need to be at the top of the imports
import "../../mocks/aragon-sdk-ipfs";

import {
  ClientErc20,
  Context,
  ContextPlugin,
  ICreateProposalParams,
  IExecuteProposalParams,
  IVoteProposalParams,
  VoteValues,
} from "../../../src";

import { contextParamsLocalChain } from "../constants";
import * as ganacheSetup from "../../helpers/ganache-setup";
import * as deployContracts from "../../helpers/deployContracts";
import { Server } from "ganache";

describe("Client ERC20", () => {
  describe("Estimation Module", () => {
    let server: Server;

    beforeAll(async () => {
      server = await ganacheSetup.start();
      const deployment = await deployContracts.deploy();
      contextParamsLocalChain.daoFactoryAddress = deployment.daoFactory.address;
    });

    afterAll(async () => {
      await server.close();
    });

    it("Should estimate the gas fees for creating a new proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientErc20(ctxPlugin);

      const proposalParams: ICreateProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        metadataUri: "ipfs://QmeJ4kRW21RRgjywi9ydvY44kfx71x2WbRq7ik5xh5zBZK",
      };

      const estimation = await client.estimation.createProposal(proposalParams);

      expect(typeof estimation).toEqual("object");
      expect(typeof estimation.average).toEqual("bigint");
      expect(typeof estimation.max).toEqual("bigint");
      expect(estimation.max).toBeGreaterThan(BigInt(0));
      expect(estimation.max).toBeGreaterThan(estimation.average);
    });
    it("Should estimate the gas fees for casting a vote", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientErc20(ctxPlugin);

      const voteParams: IVoteProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        proposalId: "0x1234567890123456789012345678901234567890",
        vote: VoteValues.YES,
      };
      const estimation = await client.estimation.voteProposal(voteParams);

      expect(typeof estimation).toEqual("object");
      expect(typeof estimation.average).toEqual("bigint");
      expect(typeof estimation.max).toEqual("bigint");
      expect(estimation.max).toBeGreaterThan(BigInt(0));
      expect(estimation.max).toBeGreaterThan(estimation.average);
    });
    it("Should estimate the gas fees for executing a proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientErc20(ctxPlugin);

      const executeParams: IExecuteProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        proposalId: "0x1234567890123456789012345678901234567890",
      };
      const estimation = await client.estimation.executeProposal(executeParams);

      expect(typeof estimation).toEqual("object");
      expect(typeof estimation.average).toEqual("bigint");
      expect(typeof estimation.max).toEqual("bigint");
      expect(estimation.max).toBeGreaterThan(BigInt(0));
      expect(estimation.max).toBeGreaterThan(estimation.average);
    });
  });
});
