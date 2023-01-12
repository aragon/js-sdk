// @ts-ignore
declare const describe, it, beforeAll, afterAll, expect, test;

// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";

import {
  Client,
  Context,
  ContextPlugin,
  ExecuteProposalStep,
  ICanVoteParams,
  ICreateProposalParams,
  IExecuteProposalParams,
  IProposalQueryParams,
  IVoteProposalParams,
  ProposalCreationSteps,
  ProposalMetadata,
  ProposalSortBy,
  ProposalStatus,
  SortDirection,
  TokenVotingClient,
  VoteProposalStep,
  VoteValues,
} from "../../../src";
import * as ganacheSetup from "../../helpers/ganache-setup";
import * as deployContracts from "../../helpers/deployContracts";

import { InvalidAddressOrEnsError } from "@aragon/sdk-common";
import {
  contextParams,
  contextParamsLocalChain,
  TEST_INVALID_ADDRESS,
  TEST_NON_EXISTING_ADDRESS,
  TEST_TOKEN_VOTING_DAO_ADDRESS,
  TEST_TOKEN_VOTING_PLUGIN_ADDRESS,
  TEST_TOKEN_VOTING_PROPOSAL_ID,
  TEST_WALLET_ADDRESS,
} from "../constants";
import { EthereumProvider, Server } from "ganache";

describe("Token Voting Client", () => {
  let pluginAddress: string;
  let server: Server;

  beforeAll(async () => {
    server = await ganacheSetup.start();
    const deployment = await deployContracts.deploy();
    contextParamsLocalChain.daoFactoryAddress = deployment.daoFactory.address;
    const daoCreation = await deployContracts.createTokenVotingDAO(
      deployment,
      "testDAO",
      [TEST_WALLET_ADDRESS],
    );
    pluginAddress = daoCreation.pluginAddrs[0];
    // advance to get past the voting checkpoint
    await advanceBlocks(server.provider, 10);
  });

  afterAll(async () => {
    await server.close();
  });

  describe("Client instances", () => {
    describe("Proposal Creation", () => {
      it("Should create a new proposal locally", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const tokenVotingClient = new TokenVotingClient(ctxPlugin);
        const client = new Client(ctx);

        // generate actions
        const action = await client.encoding.withdrawAction(pluginAddress, {
          recipientAddress: "0x1234567890123456789012345678901234567890",
          amount: BigInt(1),
          reference: "test",
        });

        const metadata: ProposalMetadata = {
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
        };

        const ipfsUri = await tokenVotingClient.methods.pinMetadata(metadata);

        const proposalParams: ICreateProposalParams = {
          pluginAddress,
          metadataUri: ipfsUri,
          actions: [action],
          creatorVote: VoteValues.YES,
          executeOnPass: false,
        };

        for await (
          const step of tokenVotingClient.methods.createProposal(
            proposalParams,
          )
        ) {
          switch (step.key) {
            case ProposalCreationSteps.CREATING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case ProposalCreationSteps.DONE:
              expect(typeof step.proposalId).toBe("string");
              expect(step.proposalId).toMatch(/^0x[A-Fa-f0-9].*$/i);
              // TODO uncomment with new proposal ID
              // expect(step.proposalId).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            default:
              throw new Error(
                "Unexpected proposal creation step: " +
                  Object.keys(step).join(", "),
              );
          }
        }
      });
    });

    describe("Vote on a proposal", () => {
      it("Should vote on a proposal locally", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

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
              break;
            default:
              throw new Error(
                "Unexpected vote proposal step: " +
                  Object.keys(step).join(", "),
              );
          }
        }
      });
    });

    describe("Execute proposal", () => {
      it("Should execute a local proposal", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const executeParams: IExecuteProposalParams = {
          pluginAddress: "0x1234567890123456789012345678901234567890",
          proposalId: "0x1234567890123456789012345678901234567890",
        };

        for await (
          const step of client.methods.executeProposal(
            executeParams,
          )
        ) {
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
                  Object.keys(step).join(", "),
              );
          }
        }
      });
    });

    describe("Can vote", () => {
      it("Should check if an user can vote in a TokenVoting proposal", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const params: ICanVoteParams = {
          address: "0x1234567890123456789012345678901234567890",
          proposalId: "0x1234567890123456789012345678901234567890",
          pluginAddress,
        };
        const canVote = await client.methods.canVote(params);
        expect(typeof canVote).toBe("boolean");
      });
    });

    describe("Data retrieval", () => {
      it("Should get the list of members that can vote in a proposal", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const pluginAddress = TEST_TOKEN_VOTING_PLUGIN_ADDRESS;
        const wallets = await client.methods.getMembers(pluginAddress);

        expect(Array.isArray(wallets)).toBe(true);
        // TODO
        // for some reason subgraph does not have
        // addresses here
        if (wallets.length > 0) {
          expect(wallets.length).TobeGr(0);
          expect(typeof wallets[0]).toBe("string");
          expect(wallets[0]).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        }
      });
      it("Should fetch the given proposal", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify({
              title: "Title",
              summary: "Summary",
              description: "Description",
              resources: [{
                name: "Name",
                url: "url",
              }],
            }),
          ),
        );

        const proposalId = TEST_TOKEN_VOTING_PROPOSAL_ID;
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
          expect(typeof proposal.creationBlockNumber === "number").toBe(true);
          expect(proposal.executionDate instanceof Date).toBe(true);
          expect(typeof proposal.executionBlockNumber === "number").toBe(true);
          expect(Array.isArray(proposal.actions)).toBe(true);
          // actions
          for (let i = 0; i < proposal.actions.length; i++) {
            const action = proposal.actions[i];
            expect(action.data instanceof Uint8Array).toBe(true);
            expect(typeof action.to).toBe("string");
            expect(typeof action.value).toBe("bigint");
          }
          // result
          expect(typeof proposal.result.yes).toBe("bigint");
          expect(typeof proposal.result.no).toBe("bigint");
          expect(typeof proposal.result.abstain).toBe("bigint");
          // setttings
          expect(typeof proposal.settings.duration).toBe("number");
          expect(typeof proposal.settings.minSupport).toBe("number");
          expect(typeof proposal.settings.minTurnout).toBe("number");
          expect(
            proposal.settings.minSupport >= 0 &&
              proposal.settings.minSupport <= 1,
          ).toBe(true);
          expect(
            proposal.settings.minTurnout >= 0 &&
              proposal.settings.minTurnout <= 1,
          ).toBe(true);
          // token
          if (proposal.token) {
            expect(typeof proposal.token.name).toBe("string");
            expect(typeof proposal.token.symbol).toBe("string");
            expect(typeof proposal.token.address).toBe("string");
            expect(proposal.token.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            if ("decimals" in proposal.token) {
              expect(typeof proposal.token.decimals).toBe("number");
            } else if ("baseUri" in proposal.token) {
              expect(typeof proposal.token.baseUri).toBe("string");
            }
          }
          expect(typeof proposal.usedVotingWeight).toBe("bigint");
          expect(typeof proposal.totalVotingWeight).toBe("bigint");
          expect(Array.isArray(proposal.votes)).toBe(true);
          for (let i = 0; i < proposal.votes.length; i++) {
            const vote = proposal.votes[i];
            expect(typeof vote.address).toBe("string");
            expect(vote.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            if (vote.vote) {
              expect(typeof vote.vote).toBe("number");
            }
            expect(typeof vote.weight).toBe("bigint");
          }
        }
      });
      it("Should fetch the given proposal and fail because the proposal does not exist", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const proposalId = TEST_NON_EXISTING_ADDRESS + "_0x0";
        const proposal = await client.methods.getProposal(proposalId);

        expect(proposal === null).toBe(true);
      });
      it("Should get a list of proposals filtered by the given criteria", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);
        const limit = 5;
        const status = ProposalStatus.EXECUTED;
        const params: IProposalQueryParams = {
          limit,
          sortBy: ProposalSortBy.CREATED_AT,
          direction: SortDirection.ASC,
          status,
        };

        const defaultCatImplementation = mockedIPFSClient.cat
          .getMockImplementation();
        mockedIPFSClient.cat.mockResolvedValue(
          Buffer.from(
            JSON.stringify({
              title: "Title",
              summary: "Summary",
            }),
          ),
        );
        const proposals = await client.methods.getProposals(params);

        expect(Array.isArray(proposals)).toBe(true);
        expect(proposals.length <= limit).toBe(true);
        for (const proposal of proposals) {
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
          expect(typeof proposal.result.yes).toBe("bigint");
          expect(typeof proposal.result.no).toBe("bigint");
          expect(typeof proposal.result.abstain).toBe("bigint");
          // token
          if (proposal.token) {
            expect(typeof proposal.token.name).toBe("string");
            expect(typeof proposal.token.symbol).toBe("string");
            expect(typeof proposal.token.address).toBe("string");
            expect(proposal.token.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            if ("decimals" in proposal.token) {
              expect(typeof proposal.token.decimals).toBe("number");
            } else if ("baseUri" in proposal.token) {
              expect(typeof proposal.token.baseUri).toBe("string");
            }
          }
        }

        mockedIPFSClient.cat.mockImplementation(defaultCatImplementation);
      });
      it("Should get a list of proposals from a specific dao", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);
        const limit = 5;
        const address = TEST_TOKEN_VOTING_DAO_ADDRESS;
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
        const client = new TokenVotingClient(ctxPlugin);
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
        const client = new TokenVotingClient(ctxPlugin);
        const limit = 5;
        const address = TEST_INVALID_ADDRESS;
        const params: IProposalQueryParams = {
          limit,
          sortBy: ProposalSortBy.CREATED_AT,
          direction: SortDirection.ASC,
          daoAddressOrEns: address,
        };
        await expect(() => client.methods.getProposals(params)).rejects.toThrow(
          new InvalidAddressOrEnsError(),
        );
      });
      it("Should get the settings of a plugin given a plugin instance address", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const pluginAddress: string = TEST_TOKEN_VOTING_PLUGIN_ADDRESS;
        const settings = await client.methods.getVotingSettings(pluginAddress);
        expect(settings === null).toBe(false);
        if (settings) {
          expect(typeof settings.minDuration).toBe("number");
          expect(typeof settings.minParticipation).toBe("number");
          expect(typeof settings.supportThreshold).toBe("number");
          expect(typeof settings.minProposerVotingPower).toBe("bigint");
          expect(settings.supportThreshold).toBeLessThanOrEqual(1);
          expect(settings.minParticipation).toBeLessThanOrEqual(1);
        }
      });
      it("Should get the token details of a plugin given a plugin instance address", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const pluginAddress: string = TEST_TOKEN_VOTING_PLUGIN_ADDRESS;
        const token = await client.methods.getToken(pluginAddress);
        expect(typeof token?.address).toBe("string");
        expect(typeof token?.symbol).toBe("string");
        expect(typeof token?.name).toBe("string");
      });
      it("Should return null token details for nonexistent plugin addresses", async () => {
        const ctx = new Context(contextParams);
        const ctxPlugin = ContextPlugin.fromContext(ctx);
        const client = new TokenVotingClient(ctxPlugin);

        const pluginAddress: string = TEST_NON_EXISTING_ADDRESS;
        const token = await client.methods.getToken(pluginAddress);
        expect(token).toBe(null);
      });
    });
  });
});

async function advanceBlocks(
  provider: EthereumProvider,
  amountOfBlocks: number,
) {
  for (let i = 0; i < amountOfBlocks; i++) {
    await provider.send("evm_mine", []);
  }
}
