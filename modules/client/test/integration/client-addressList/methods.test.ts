// @ts-ignore
declare const describe, it, beforeAll, afterAll, expect;

import * as ganacheSetup from "../../helpers/ganache-setup";
import * as deployContracts from "../../helpers/deployContracts";

import {
  Client,
  ClientAddressList,
  Context,
  ContextPlugin,
  ExecuteProposalStep,
  ICanVoteParams,
  ICreateProposalParams,
  IExecuteProposalParams,
  IProposalQueryParams,
  IVoteProposalParams,
  ProposalCreationSteps,
  ProposalSortBy,
  ProposalStatus,
  SortDirection,
  VoteProposalStep,
  VoteValues,
} from "../../../src";
import { InvalidAddressOrEnsError } from "@aragon/sdk-common";
import {
  contextParams,
  contextParamsLocalChain,
  TEST_ADDRESSLIST_DAO_ADDDRESS,
  TEST_ADDRESSLIST_PLUGIN_ADDRESS,
  TEST_ADDRESSLIST_PROPOSAL_ID,
  TEST_INVALID_ADDRESS,
  TEST_NON_EXISTING_ADDRESS,
} from "../constants";
import { Server } from "ganache";

describe("Client Address List", () => {
  let server: Server;

  beforeAll(async () => {
    server = await ganacheSetup.start();
    const deployment = await deployContracts.deploy();
    contextParamsLocalChain.daoFactoryAddress = deployment.daoFactory.address;
  });

  afterAll(async () => {
    await server.close();
  });

  describe("Proposal Creation", () => {
    it("Should create a new proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const addressListClient = new ClientAddressList(ctxPlugin);
      const client = new Client(ctx);

      // generate actions
      const action = await client.encoding.withdrawAction(
        "0x1234567890123456789012345678901234567890",
        {
          recipientAddress: "0x1234567890123456789012345678901234567890",
          amount: BigInt(1),
          reference: "test",
        }
      );

      const proposalParams: ICreateProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        metadata: {
          title: "Best Proposal",
          summary: "this is the sumnary",
          description: "This is a very long description",
          resources: [
            {
              name: "Website",
              url: "https://the.website",
            },
          ],
          media: {
            header: "https://no.media/media.jpeg",
            logo: "https://no.media/media.jpeg",
          },
        },
        actions: [action],
        creatorVote: VoteValues.YES,
        startDate: new Date(),
        endDate: new Date(),
        executeOnPass: true,
      };

      for await (const step of addressListClient.methods.createProposal(
        proposalParams
      )) {
        switch (step.key) {
          case ProposalCreationSteps.CREATING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case ProposalCreationSteps.DONE:
            expect(typeof step.proposalId).toBe("string");
            expect(step.proposalId).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          default:
            throw new Error(
              "Unexpected proposal creation step: " +
                Object.keys(step).join(", ")
            );
        }
      }
    });
  });

  describe("Vote on a proposal", () => {
    it("Should vote on a proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const voteParams: IVoteProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        proposalId: "0x1234567890123456789012345678901234567890",
        vote: VoteValues.YES,
      };

      for await (const step of client.methods.voteProposal(voteParams)) {
        switch (step.key) {
          case VoteProposalStep.VOTING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case VoteProposalStep.DONE:
            expect(typeof step.voteId).toBe("string");
            expect(step.voteId).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          default:
            throw new Error(
              "Unexpected vote proposal step: " + Object.keys(step).join(", ")
            );
        }
      }
    });
  });

  describe("Execute proposal", () => {
    it("Should execute a local proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const executeParams: IExecuteProposalParams = {
        pluginAddress: "0x1234567890123456789012345678901234567890",
        proposalId: "0x1234567890123456789012345678901234567890",
      };
      for await (const step of client.methods.executeProposal(executeParams)) {
        switch (step.key) {
          case ExecuteProposalStep.EXECUTING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case ExecuteProposalStep.DONE:
            break;
          default:
            throw new Error(
              "Unexpected execute proposal step: " +
                Object.keys(step).join(", ")
            );
        }
      }
    });
  });

  describe("Can vote", () => {
    it("Should check if an user can vote in an Address List proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const params: ICanVoteParams = {
        address: "0x1234567890123456789012345678901234567890",
        proposalId: "0x1234567890123456789012345678901234567890_0x1",
        pluginAddress: "0x1234567890123456789012345678901234567890",
      };
      const canVote = await client.methods.canVote(params);
      expect(typeof canVote).toBe("boolean");
    });
  });

  describe("Data retrieval", () => {
    it("Should get the list of members that can vote in a proposal", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const wallets = await client.methods.getMembers(
        TEST_ADDRESSLIST_DAO_ADDDRESS
      );

      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBeGreaterThan(0);
      expect(typeof wallets[0]).toBe("string");
      expect(wallets[0]).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
    });
    it("Should fetch the given proposal", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const proposalId = TEST_ADDRESSLIST_PROPOSAL_ID;
      const proposal = await client.methods.getProposal(proposalId);

      expect(typeof proposal).toBe("object");
      expect(proposal === null).toBe(false);
      if (proposal) {
        expect(proposal.id).toBe(proposalId);
        expect(typeof proposal.id).toBe("string");
        expect(proposal.id).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,}$/i);
        expect(typeof proposal.dao.address).toBe("string");
        expect(proposal.dao.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        expect(typeof proposal.dao.name).toBe("string");
        expect(typeof proposal.creatorAddress).toBe("string");
        expect(proposal.creatorAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        // check metadata
        expect(typeof proposal.metadata.title).toBe("string");
        expect(typeof proposal.metadata.summary).toBe("string");
        expect(typeof proposal.metadata.description).toBe("string");
        expect(Array.isArray(proposal.metadata.resources)).toBe(true);
        for (let i = 0; i < proposal.metadata.resources.length; i++) {
          const resource = proposal.metadata.resources[i];
          expect(typeof resource.name).toBe("string");
          expect(typeof resource.url).toBe("string");
        }
        if (proposal.metadata.media) {
          if (proposal.metadata.media.header) {
            expect(typeof proposal.metadata.media.header).toBe("string");
          }
          if (proposal.metadata.media.logo) {
            expect(typeof proposal.metadata.media.logo).toBe("string");
          }
        }
        expect(proposal.startDate instanceof Date).toBe(true);
        expect(proposal.endDate instanceof Date).toBe(true);
        expect(proposal.creationDate instanceof Date).toBe(true);
        expect(Array.isArray(proposal.actions)).toBe(true);
        // actions
        for (let i = 0; i < proposal.actions.length; i++) {
          const action = proposal.actions[i];
          expect(action.data instanceof Uint8Array).toBe(true);
          expect(typeof action.to).toBe("string");
          expect(typeof action.value).toBe("bigint");
        }
        // result
        expect(typeof proposal.result.yes).toBe("number");
        expect(typeof proposal.result.no).toBe("number");
        expect(typeof proposal.result.abstain).toBe("number");
        // setttings
        expect(typeof proposal.settings.duration).toBe("number");
        expect(typeof proposal.settings.minSupport).toBe("number");
        expect(typeof proposal.settings.minTurnout).toBe("number");
        // TODO
        // enable this tests when the subgrph have the correcto precision digits
        // expect(
        //   proposal.settings.minSupport >= 0 &&
        //     proposal.settings.minSupport <= 1,
        // ).toBe(true);
        // expect(
        //   proposal.settings.minTurnout >= 0 &&
        //     proposal.settings.minTurnout <= 1,
        // ).toBe(true);
        // token
        expect(typeof proposal.totalVotingWeight).toBe("number");
        expect(Array.isArray(proposal.votes)).toBe(true);
        for (let i = 0; i < proposal.votes.length; i++) {
          const vote = proposal.votes[i];
          expect(typeof vote.address).toBe("string");
          expect(vote.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
          expect(typeof vote.vote).toBe("number");
        }
      }
    });
    it("Should fetch the given proposal and fail because the proposal does not exist", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const proposalId = TEST_NON_EXISTING_ADDRESS + "_0x0";
      const proposal = await client.methods.getProposal(proposalId);

      expect(proposal === null).toBe(true);
    });
    it("Should get a list of proposals filtered by the given criteria", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);
      const limit = 5;
      const status = ProposalStatus.EXECUTED;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        status,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length <= limit).toBe(true);
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        expect(typeof proposal.id).toBe("string");
        expect(proposal.id).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,}$/i);
        expect(typeof proposal.dao.address).toBe("string");
        expect(proposal.dao.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        expect(typeof proposal.dao.name).toBe("string");
        expect(typeof proposal.creatorAddress).toBe("string");
        expect(proposal.creatorAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        expect(typeof proposal.metadata.title).toBe("string");
        expect(typeof proposal.metadata.summary).toBe("string");
        expect(proposal.startDate instanceof Date).toBe(true);
        expect(proposal.endDate instanceof Date).toBe(true);
        expect(proposal.status).toBe(status);
        // result
        expect(typeof proposal.result.yes).toBe("number");
        expect(typeof proposal.result.no).toBe("number");
        expect(typeof proposal.result.abstain).toBe("number");
      }
    });
    it("Should get a list of proposals from a specific dao", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);
      const limit = 5;
      const address = TEST_ADDRESSLIST_DAO_ADDDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length > 0 && proposals.length <= limit).toBe(true);
    });
    it("Should get a list of proposals from a dao that has no proposals", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);
      const limit = 5;
      const address = TEST_NON_EXISTING_ADDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length === 0).toBe(true);
    });
    it("Should get a list of proposals from an invalid address", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);
      const limit = 5;
      const address = TEST_INVALID_ADDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      await expect(() => client.methods.getProposals(params)).rejects.toThrow(
        new InvalidAddressOrEnsError()
      );
    });
    it("Should get the settings of a plugin given a plugin instance address", async () => {
      const ctx = new Context(contextParams);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new ClientAddressList(ctxPlugin);

      const pluginAddress: string = TEST_ADDRESSLIST_PLUGIN_ADDRESS;
      const settings = await client.methods.getSettings(pluginAddress);

      expect(settings === null).toBe(false);
      if (settings) {
        expect(typeof settings.minDuration).toBe("number");
        expect(typeof settings.minSupport).toBe("number");
        expect(typeof settings.minTurnout).toBe("number");
      }
    });
  });
});
