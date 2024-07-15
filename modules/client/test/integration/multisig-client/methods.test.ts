// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";
import * as mockedGraphqlRequest from "../../mocks/graphql-request";

import * as deployContracts from "../../helpers/deployContracts";

import {
  ApproveMultisigProposalParams,
  ApproveProposalStep,
  CanApproveParams,
  CreateMultisigProposalParams,
  ExecuteProposalStep,
  MultisigClient,
  MultisigPluginPrepareInstallationParams,
  MultisigProposal,
  ProposalCreationSteps,
  ProposalQueryParams,
  ProposalSortBy,
} from "../../../src";
import {
  ADDRESS_ONE,
  ADDRESS_TWO,
  contextParamsLocalChain,
  SUBGRAPH_PLUGIN_INSTALLATION,
  SUBGRAPH_PROPOSAL_BASE,
  TEST_INVALID_ADDRESS,
  TEST_MULTISIG_PROPOSAL_ID,
  TEST_NON_EXISTING_ADDRESS,
  TEST_TX_HASH,
  TEST_WALLET_ADDRESS,
} from "../constants";
import { buildMultisigDAO } from "../../helpers/build-daos";
import { mineBlock } from "../../helpers/block-times";
import { JsonRpcProvider } from "@ethersproject/providers";
import {
  QueryMultisigProposal,
  QueryMultisigProposals,
  QueryMultisigVotingSettings,
} from "../../../src/multisig/internal/graphql-queries";
import {
  QueryMultisigIsMember,
  QueryMultisigMembers,
} from "../../../src/multisig/internal/graphql-queries/members";
import { SubgraphMultisigProposal } from "../../../src/multisig/internal/types";
import {
  bytesToHex,
  Context,
  getExtendedProposalId,
  InvalidAddressOrEnsError,
  PrepareInstallationStep,
  PrepareUpdateStep,
  ProposalMetadata,
  ProposalStatus,
  SortDirection,
} from "@aragon/sdk-client-common";
import { PluginRepo__factory } from "@aragon/osx-ethers";
import { createMultisigPluginBuild } from "../../helpers/create-plugin-build";
import {
  contracts,
  NetworkDeployment,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

describe("Client Multisig", () => {
  let deployment: deployContracts.Deployment;
  let repoAddr: string;
  let provider: JsonRpcProvider;

  beforeAll(async () => {
    deployment = await deployContracts.deploy();
    contextParamsLocalChain.DAOFactory = deployment.daoFactory.address;
    contextParamsLocalChain.PluginSetupProcessor =
      deployment.pluginSetupProcessor.address;
    contextParamsLocalChain.MultisigRepoProxy = deployment.multisigRepo.address;
    contextParamsLocalChain.AdminRepoProxy = "";
    contextParamsLocalChain.AddresslistVotingRepoProxy =
      deployment.addresslistVotingRepo.address;
    contextParamsLocalChain.TokenVotingRepoProxy =
      deployment.tokenVotingRepo.address;
    contextParamsLocalChain.MultisigSetup =
      deployment.multisigPluginSetup.address;
    contextParamsLocalChain.AdminSetup = "";
    contextParamsLocalChain.AddresslistVotingSetup =
      deployment.addresslistVotingPluginSetup.address;
    contextParamsLocalChain.TokenVotingSetup =
      deployment.tokenVotingPluginSetup.address;
    contextParamsLocalChain.ENSRegistry = deployment.ensRegistry.address;
    repoAddr = deployment.multisigRepo.address;
    contracts.local = {
      [SupportedVersions.V1_3_0]: {
        MultisigRepoProxy: { address: deployment.multisigRepo.address },
      } as NetworkDeployment,
    };

    if (Array.isArray(contextParamsLocalChain.web3Providers)) {
      provider = new JsonRpcProvider(
        contextParamsLocalChain.web3Providers[0] as string,
      );
    } else {
      provider = new JsonRpcProvider(
        contextParamsLocalChain.web3Providers as any,
      );
    }
  });

  async function buildDao() {
    const result = await buildMultisigDAO(repoAddr);
    await mineBlock(provider);
    return result;
  }

  async function buildProposal(
    pluginAddress: string,
    multisigClient: MultisigClient,
  ): Promise<string> {
    // generate actions
    const action = multisigClient.encoding.updateMultisigVotingSettings(
      {
        pluginAddress,
        votingSettings: {
          minApprovals: 1,
          onlyListed: true,
        },
      },
    );

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
    const ipfsUri = await multisigClient.methods.pinMetadata(metadata);
    const endDate = new Date(Date.now() + 1000 * 60 * 60);
    const proposalParams: CreateMultisigProposalParams = {
      pluginAddress,
      metadataUri: ipfsUri,
      actions: [action],
      failSafeActions: [false],
      endDate,
    };

    for await (
      const step of multisigClient.methods.createProposal(
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
          expect(step.proposalId).toMatch(
            /^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/,
          );
          return step.proposalId;
        default:
          throw new Error(
            "Unexpected proposal creation step: " +
              Object.keys(step).join(", "),
          );
      }
    }
    throw new Error();
  }
  async function approveProposal(
    proposalId: string,
    client: MultisigClient,
  ) {
    const approveParams: ApproveMultisigProposalParams = {
      proposalId,
      tryExecution: false,
    };
    for await (const step of client.methods.approveProposal(approveParams)) {
      switch (step.key) {
        case ApproveProposalStep.APPROVING:
          expect(typeof step.txHash).toBe("string");
          expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
          break;
        case ApproveProposalStep.DONE:
          break;
        default:
          throw new Error(
            "Unexpected approve proposal step: " +
              Object.keys(step).join(", "),
          );
      }
    }
  }

  describe("Proposal Creation", () => {
    it("Should create a new proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const multisigClient = new MultisigClient(ctx);

      const { plugin: pluginAddress } = await buildDao();

      await buildProposal(pluginAddress, multisigClient);
    });
  });

  describe("Plugin installation", () => {
    it("Should prepare the installation of a token voting plugin", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const { dao } = await buildMultisigDAO(
        repoAddr,
      );
      const installationParams: MultisigPluginPrepareInstallationParams = {
        settings: {
          members: [TEST_WALLET_ADDRESS],
          votingSettings: {
            minApprovals: 1,
            onlyListed: true,
          },
        },
        daoAddressOrEns: dao,
      };
      const steps = client.methods.prepareInstallation(installationParams);
      for await (const step of steps) {
        switch (step.key) {
          case PrepareInstallationStep.PREPARING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case PrepareInstallationStep.DONE:
            expect(typeof step.pluginAddress).toBe("string");
            expect(step.pluginAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(typeof step.pluginRepo).toBe("string");
            expect(step.pluginRepo).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(Array.isArray(step.helpers)).toBe(true);
            for (const helper of step.helpers) {
              expect(typeof helper).toBe("string");
            }
            expect(Array.isArray(step.permissions)).toBe(true);
            for (const permission of step.permissions) {
              expect(typeof permission.condition).toBe("string");
              if (permission.condition) {
                expect(permission.condition).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              }
              expect(typeof permission.operation).toBe("number");
              expect(typeof permission.where).toBe("string");
              expect(permission.where).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof permission.who).toBe("string");
              expect(permission.who).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            }
            expect(typeof step.versionTag.build).toBe("number");
            expect(typeof step.versionTag.release).toBe("number");
            break;
        }
      }
    });
  });

  describe("Plugin update", () => {
    it("Should prepare a plugin update for a multisigPlugin", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const { dao, plugin } = await buildMultisigDAO(
        repoAddr,
      );
      const release = 1;
      await createMultisigPluginBuild(release, deployment.multisigRepo.address);

      const pluginSetupInstance = PluginRepo__factory.connect(
        deployment.multisigRepo.address,
        client.web3.getConnectedSigner(),
      );
      const version = await pluginSetupInstance["getLatestVersion(uint8)"](
        release,
      );

      expect(version.tag.release).toBe(release);
      expect(version.tag.build).toBe(2);

      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      const installation = SUBGRAPH_PLUGIN_INSTALLATION;
      installation.appliedPreparation.pluginRepo.id =
        deployment.multisigRepo.address;
      installation.appliedPreparation.helpers = [];
      mockedClient.request.mockResolvedValueOnce({
        iplugin: { installations: [installation] },
      });
      const steps = client.methods.prepareUpdate(
        {
          daoAddressOrEns: dao,
          pluginAddress: plugin,
          newVersion: {
            release: 1,
            build: 2,
          },
        },
      );
      for await (const step of steps) {
        switch (step.key) {
          case PrepareUpdateStep.PREPARING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case PrepareUpdateStep.DONE:
            expect(typeof step.pluginAddress).toBe("string");
            expect(step.pluginAddress).toBe(plugin);
            expect(step.initData instanceof Uint8Array).toBe(true);
            expect(step.pluginAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(typeof step.pluginRepo).toBe("string");
            expect(step.pluginRepo).toBe(deployment.multisigRepo.address);
            expect(step.pluginRepo).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(typeof step.versionTag.build).toBe("number");
            expect(step.versionTag.build).toBe(2);
            expect(typeof step.versionTag.release).toBe("number");
            expect(step.versionTag.release).toBe(1);
            for (const permission of step.permissions) {
              if (permission.condition) {
                expect(typeof permission.condition).toBe("string");
                expect(permission.condition).toMatch(
                  /^0x[A-Fa-f0-9]{40}$/i,
                );
              }
              expect(typeof permission.operation).toBe("number");
              expect(typeof permission.where).toBe("string");
              expect(permission.where).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof permission.who).toBe("string");
              expect(permission.who).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            }
            break;
          default:
            throw new Error(
              "Unexpected DAO prepare update step: " +
                JSON.stringify(step, null, 2),
            );
        }
      }
    });
  });

  describe("Can approve", () => {
    it("Should check if an user can approve in a multisig instance", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      // const address = await client.web3.getSigner()?.getAddress();

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      const canApproveParams: CanApproveParams = {
        proposalId,
        approverAddressOrEns: TEST_WALLET_ADDRESS,
      };
      // positive
      let canApprove = await client.methods.canApprove(canApproveParams);
      expect(typeof canApprove).toBe("boolean");
      expect(canApprove).toBe(true);

      // negative
      canApproveParams.approverAddressOrEns =
        "0x0000000000000000000000000000000000000000";
      canApprove = await client.methods.canApprove(canApproveParams);
      expect(typeof canApprove).toBe("boolean");
      expect(canApprove).toBe(false);
    });
  });

  describe("Approve proposal", () => {
    it("Should approve a local proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      await approveProposal(proposalId, client);
    });
  });

  describe("Can execute", () => {
    it("Should check if an user can execute in a multisig instance", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      let canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // now approve
      await approveProposal(proposalId, client);

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(true);
    });
  });

  describe("Execute proposal", () => {
    it("Should execute a local proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      await approveProposal(proposalId, client);

      for await (
        const step of client.methods.executeProposal(
          proposalId,
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
  describe("isMember", () => {
    it("Should check if an address is a member of a DAO and return true", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      mockedClient.request.mockResolvedValueOnce({
        multisigApprover: {
          id: `${ADDRESS_ONE}_${ADDRESS_TWO}`,
        },
      });
      const isMember = await client.methods.isMember({
        pluginAddress: ADDRESS_ONE,
        address: ADDRESS_TWO,
      });
      expect(isMember).toBe(true);
      expect(mockedClient.request).toHaveBeenLastCalledWith(
        QueryMultisigIsMember,
        {
          id: `${ADDRESS_ONE}_${ADDRESS_TWO}`,
          blockHeight: null,
        },
      );
    });
    it("Should check if an address is a member in a specified block number of a DAO and return true", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      mockedClient.request.mockResolvedValueOnce({
        multisigApprover: {
          id: `${ADDRESS_ONE}_${ADDRESS_TWO}`,
        },
      });
      const blockNumber = 123456;
      const isMember = await client.methods.isMember({
        pluginAddress: ADDRESS_ONE,
        address: ADDRESS_TWO,
        blockNumber,
      });
      expect(isMember).toBe(true);
      expect(mockedClient.request).toHaveBeenLastCalledWith(
        QueryMultisigIsMember,
        {
          id: `${ADDRESS_ONE}_${ADDRESS_TWO}`,
          blockHeight: {
            number: blockNumber,
          },
        },
      );
    });
    it("Should check if an address is a member of a DAO and return false", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      mockedClient.request.mockResolvedValueOnce({
        multisigApprover: null,
      });
      const isMember = await client.methods.isMember({
        pluginAddress: ADDRESS_ONE,
        address: ADDRESS_TWO,
      });
      expect(isMember).toBe(false);
      expect(mockedClient.request).toHaveBeenLastCalledWith(
        QueryMultisigIsMember,
        {
          id: `${ADDRESS_ONE}_${ADDRESS_TWO}`,
          blockHeight: null,
        },
      );
    });
  });

  describe("Data retrieval", () => {
    it("Should get the voting settings of the plugin", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      const subgraphSettings = {
        minApprovals: 5,
        onlyListed: false,
      };
      mockedClient.request.mockResolvedValueOnce({
        multisigPlugin: subgraphSettings,
      });
      const settings = await client.methods.getVotingSettings(
        ADDRESS_ONE,
      );
      expect(settings.minApprovals).toBe(
        subgraphSettings.minApprovals,
      );
      expect(settings.onlyListed).toBe(subgraphSettings.onlyListed);
      expect(mockedClient.request).toHaveBeenCalledWith(
        QueryMultisigVotingSettings,
        {
          address: ADDRESS_ONE,
          block: null,
        },
      );
    });

    it.only("Should get members of the multisig", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      const members = [ADDRESS_ONE, ADDRESS_TWO];

      mockedClient.request.mockResolvedValueOnce({
        multisigApprovers: members.map((member) => {
          return { address: member };
        }),
      });

      const wallets = await client.methods.getMembers(
        {
          pluginAddress: ADDRESS_ONE,
          blockNumber: 123456,
        },
      );

      console.log("members",members,"wallets", wallets);

      expect(wallets.length).toBe(2);
      expect(wallets).toMatchObject(members);
      expect(mockedClient.request).toHaveBeenCalledWith(QueryMultisigMembers, {
        where: { plugin: ADDRESS_ONE },
        block: {
          number: 123456,
        },
        direction: "asc",
        limit: 10,
        skip: 0,
        sortBy: "address",
      });
    });

    it("Should fetch the given proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);

      const proposalId = TEST_MULTISIG_PROPOSAL_ID;

      const ipfsMetadata = {
        title: "Title",
        summary: "Summary",
        description: "Description",
        resources: [{
          name: "Name",
          url: "URL",
        }],
        media: [{ header: "Header", logo: "Logo" }],
      };
      mockedIPFSClient.cat.mockResolvedValue(
        Buffer.from(
          JSON.stringify(ipfsMetadata),
        ),
      );
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );

      const subgraphProposal: SubgraphMultisigProposal = {
        createdAt: Math.round(Date.now() / 1000).toString(),
        creationBlockNumber: "40",
        executionDate: Math.round(Date.now() / 1000).toString(),
        executionBlockNumber: "50",
        executionTxHash: TEST_TX_HASH,
        approvals: [{ approver: {address: ADDRESS_ONE} }, { approver: {address: ADDRESS_TWO}}],
        minApprovals: 5,
        plugin: {
          onlyListed: true,
          minApprovals: 5,
        },
        ...SUBGRAPH_PROPOSAL_BASE,
      };

      mockedClient.request.mockResolvedValueOnce({
        multisigProposal: subgraphProposal,
      });
      const proposal = await client.methods.getProposal(
        proposalId,
      ) as MultisigProposal;
      expect(proposal).not.toBe(null);

      expect(proposal.id).toBe(subgraphProposal.id);
      expect(proposal.dao.address).toBe(subgraphProposal.dao.id);
      expect(proposal.dao.name).toBe(subgraphProposal.dao.subdomain);
      expect(proposal.creatorAddress).toBe(subgraphProposal.creator);
      // check metadata
      expect(proposal.metadata.title).toBe(ipfsMetadata.title);
      expect(proposal.metadata.summary).toBe(ipfsMetadata.summary);
      expect(proposal.metadata.description).toBe(ipfsMetadata.description);
      expect(proposal.metadata.resources).toMatchObject(ipfsMetadata.resources);
      expect(proposal.metadata.media).toMatchObject(ipfsMetadata.media);

      expect(proposal.status).toBe("Defeated");
      expect(proposal.startDate instanceof Date).toBe(true);
      expect(proposal.startDate.getTime()).toBe(
        parseInt(subgraphProposal.startDate) * 1000,
      );
      expect(proposal.endDate instanceof Date).toBe(true);
      expect(proposal.endDate.getTime()).toBe(
        parseInt(subgraphProposal.endDate) * 1000,
      );
      expect(proposal.creationDate instanceof Date).toBe(true);
      expect(proposal.creationDate.getTime()).toBe(
        parseInt(subgraphProposal.createdAt) * 1000,
      );
      for (const [index, action] of proposal.actions.entries()) {
        expect(action.value).toBe(
          BigInt(subgraphProposal.actions[index].value),
        );
        expect(action.to).toBe(subgraphProposal.actions[index].to);
        expect(bytesToHex(action.data)).toBe(
          subgraphProposal.actions[index].data.toLowerCase(),
        );
      }
      expect(proposal.actions).toMatchObject(proposal.actions);

      expect(proposal.executionTxHash).toMatch(
        subgraphProposal.executionTxHash,
      );
      expect(proposal.executionDate?.getTime()).toBe(
        parseInt(subgraphProposal.executionDate) * 1000,
      );
      expect(proposal.executionBlockNumber).toBe(
        parseInt(subgraphProposal.executionBlockNumber),
      );
      expect(proposal.approvals).toMatchObject(
        subgraphProposal.approvals.map((approver) => approver.approver.address),
      );
      expect(proposal.settings.minApprovals).toBe(
        subgraphProposal.plugin.minApprovals,
      );
      expect(proposal.settings.onlyListed).toBe(
        subgraphProposal.plugin.onlyListed,
      );

      // check function call
      expect(mockedClient.request).lastCalledWith(
        QueryMultisigProposal,
        {
          proposalId: getExtendedProposalId(proposalId),
        },
      );
    });
    it("Should fetch the given proposal and fail because the proposal does not exist", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      mockedClient.request.mockResolvedValueOnce({ multisigProposal: null });
      const proposalId = TEST_NON_EXISTING_ADDRESS + "_0x1";
      const proposal = await client.methods.getProposal(proposalId);

      expect(proposal === null).toBe(true);
    });
    it("Should get a list of proposals filtered by the given criteria", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const limit = 5;
      const params: ProposalQueryParams = {
        limit,
        status: ProposalStatus.DEFEATED,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
      };
      const ipfsMetadata = {
        title: "Title",
        summary: "Summary",
        description: "Description",
        resources: [{
          name: "Name",
          url: "URL",
        }],
        media: [{ header: "Header", logo: "Logo" }],
      };
      mockedIPFSClient.cat.mockResolvedValue(
        Buffer.from(
          JSON.stringify(ipfsMetadata),
        ),
      );

      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );

      mockedClient.request.mockResolvedValueOnce({
        multisigProposals: [{
          ...SUBGRAPH_PROPOSAL_BASE,
          approvals: [{ approver: { address: ADDRESS_ONE } }, { approver: { address: ADDRESS_TWO } }],
          plugin: {
            onlyListed: true,
          },
          minApprovals: 5,
        }],
      });
      const dateGetTimeSpy = jest.spyOn(Date.prototype, "getTime");
      const now = Date.now();
      const nowFilter = Math.round(now / 1000).toString();
      dateGetTimeSpy.mockReturnValueOnce(now);

      const proposals = await client.methods.getProposals(params);
      dateGetTimeSpy.mockRestore();

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length).toBe(1);
      expect(proposals[0].id).toBe(SUBGRAPH_PROPOSAL_BASE.id);
      expect(proposals[0].dao.address).toBe(SUBGRAPH_PROPOSAL_BASE.dao.id);
      expect(proposals[0].dao.name).toBe(SUBGRAPH_PROPOSAL_BASE.dao.subdomain);
      expect(proposals[0].creatorAddress).toBe(SUBGRAPH_PROPOSAL_BASE.creator);
      expect(proposals[0].metadata.title).toBe(ipfsMetadata.title);
      expect(proposals[0].metadata.summary).toBe(ipfsMetadata.summary);
      expect(proposals[0].startDate.getTime()).toBe(
        parseInt(SUBGRAPH_PROPOSAL_BASE.startDate) * 1000,
      );
      expect(proposals[0].endDate.getTime()).toBe(
        parseInt(SUBGRAPH_PROPOSAL_BASE.endDate) * 1000,
      );
      expect(proposals[0].status).toBe("Defeated");
      expect(proposals[0].approvals).toMatchObject([ADDRESS_ONE, ADDRESS_TWO]);
      expect(proposals[0].settings.minApprovals).toBe(5);
      expect(proposals[0].settings.onlyListed).toBe(true);
      for (const [index, action] of proposals[0].actions.entries()) {
        expect(action.value).toBe(
          BigInt(SUBGRAPH_PROPOSAL_BASE.actions[index].value),
        );
        expect(action.to).toBe(SUBGRAPH_PROPOSAL_BASE.actions[index].to);
        expect(bytesToHex(action.data)).toBe(
          SUBGRAPH_PROPOSAL_BASE.actions[index].data.toLowerCase(),
        );
      }

      expect(mockedClient.request).toHaveBeenCalledWith(
        QueryMultisigProposals,
        {
          where: {
            endDate_lt: nowFilter,
            executed: false,
          },
          skip: 0,
          limit: params.limit,
          direction: params.direction,
          sortBy: params.sortBy,
        },
      );
    });
    it("Should get a list of proposals from a specific dao", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const limit = 5;
      const address = ADDRESS_ONE;
      const params: ProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      mockedClient.request.mockResolvedValueOnce({
        multisigProposals: [],
      });
      await client.methods.getProposals(params);
      expect(mockedClient.request).toHaveBeenCalledWith(
        QueryMultisigProposals,
        {
          where: {
            dao: address,
          },
          skip: 0,
          limit: params.limit,
          direction: params.direction,
          sortBy: params.sortBy,
        },
      );
    });
    it("Should get a list of proposals from an invalid address", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const client = new MultisigClient(ctx);
      const limit = 5;
      const address = TEST_INVALID_ADDRESS;
      const params: ProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      await expect(() => client.methods.getProposals(params)).rejects.toThrow(
        new InvalidAddressOrEnsError(),
      );
    });
  });
});
