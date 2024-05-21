// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";
import * as mockedGraphqlRequest from "../../mocks/graphql-request";
import * as deployContracts from "../../helpers/deployContracts";
import * as deployV1Contracts from "../../helpers/deploy-v1-contracts";
import {
  ADDRESS_ONE,
  ADDRESS_THREE,
  ADDRESS_TWO,
  contextParamsLocalChain,
  IPFS_CID,
  SUBGRAPH_PLUGIN_INSTALLATION,
  TEST_DAO_ADDRESS,
  TEST_INVALID_ADDRESS,
  TEST_MULTISIG_PROPOSAL_ID,
  TEST_NO_BALANCES_DAO_ADDRESS,
  TEST_NON_EXISTING_ADDRESS,
  TEST_TX_HASH,
  TOKEN_VOTING_BUILD_METADATA,
  // TEST_WALLET,
} from "../constants";
import {
  AddresslistVotingClient,
  AddresslistVotingPluginInstall,
  AssetBalanceSortBy,
  Client,
  CreateDaoParams,
  DaoCreationSteps,
  DaoDepositSteps,
  DaoQueryParams,
  DaoSortBy,
  DepositParams,
  HasPermissionParams,
  PluginPreparationQueryParams,
  PluginPreparationSortBy,
  PluginPreparationType,
  PluginQueryParams,
  PluginRepoBuildMetadata,
  PluginRepoReleaseMetadata,
  PluginSortBy,
  ProposalSettingsErrorCause,
  SetAllowanceParams,
  SetAllowanceSteps,
  TransferQueryParams,
  TransferSortBy,
  TransferType,
  VotingMode,
} from "../../../src";
import {
  SubgraphBalance,
  SubgraphDao,
  SubgraphIProposal,
  SubgraphPluginInstallation,
  SubgraphPluginPermissionOperation,
  SubgraphPluginPreparationListItem,
  SubgraphPluginRepo,
  SubgraphPluginRepoListItem,
  SubgraphPluginUpdatePreparation,
  SubgraphTransferListItem,
  SubgraphTransferType,
} from "../../../src/internal/types";
import { QueryDao, QueryDaos } from "../../../src/internal/graphql-queries/dao";
import {
  QueryPluginPreparationsExtended,
  QueryTokenBalances,
  QueryTokenTransfers,
} from "../../../src/internal/graphql-queries";
import { GraphQLClient } from "graphql-request";
import { AddressZero } from "@ethersproject/constants";
import { deployErc20 } from "../../helpers/deploy-erc20";
import { deployErc721 } from "../../helpers/deploy-erc721";
import { buildMultisigDAO } from "../../helpers/build-daos";
import {
  ApplyUpdateParams,
  bytesToHex,
  Context,
  DaoAction,
  Permissions,
  PrepareInstallationStep,
  PrepareUninstallationSteps,
  PrepareUpdateStep,
  SortDirection,
  TokenType,
} from "@aragon/sdk-client-common";
import { INSTALLATION_ABI } from "../../../src/multisig/internal/constants";
import { deployErc1155 } from "../../helpers/deploy-erc1155";
import { createPluginBuild } from "../../helpers/create-plugin-build";
import {
  MultisigSetup__factory,
  PluginRepo__factory,
} from "@aragon/osx-ethers";
import { SupportedPluginRepo } from "../../../src/internal/constants";
import { ValidationError } from "yup";
import {
  toPluginPermissionOperationType,
  toSubgraphActions,
} from "../../../src/internal/utils";
import {
  contracts,
  FrameworkContractsNames,
  NetworkDeployment,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

describe("Client", () => {
  let daoAddress: string;
  let pluginAddress: string;
  let daoAddressV1: string;
  let deployment: deployContracts.Deployment;
  let deploymentV1: deployV1Contracts.Deployment;

  describe("Methods Module tests", () => {
    beforeAll(async () => {
      deployment = await deployContracts.deploy();
      deploymentV1 = await deployV1Contracts.deploy();
      contextParamsLocalChain.DAOFactory = deployment.daoFactory.address;
      contextParamsLocalChain.PluginSetupProcessor =
        deployment.pluginSetupProcessor.address;
      contextParamsLocalChain.MultisigRepoProxy =
        deployment.multisigRepo.address;
      contextParamsLocalChain.AddresslistVotingRepoProxy =
        deployment.addresslistVotingRepo.address;
      contextParamsLocalChain.TokenVotingRepoProxy =
        deployment.tokenVotingRepo.address;
      contextParamsLocalChain.MultisigSetup =
        deployment.multisigPluginSetup.address;
      contextParamsLocalChain.AddresslistVotingSetup =
        deployment.addresslistVotingPluginSetup.address;
      contextParamsLocalChain.TokenVotingSetup =
        deployment.tokenVotingPluginSetup.address;
      contextParamsLocalChain.ENSRegistry = deployment.ensRegistry.address;
      contracts.local = {
        [SupportedVersions.V1_0_0]: {
          DAOFactory: { address: deploymentV1.daoFactory.address },
          MultisigRepoProxy: { address: deploymentV1.multisigRepo.address },
          AddresslistVotingRepoProxy: {
            address: deploymentV1.addresslistVotingRepo.address,
          },
        } as NetworkDeployment,
        [SupportedVersions.V1_3_0]: {
          DAOFactory: { address: deployment.daoFactory.address },
          MultisigRepoProxy: { address: deployment.multisigRepo.address },
          AddresslistVotingRepoProxy: {
            address: deployment.addresslistVotingRepo.address,
          },
        } as NetworkDeployment,
      };

      const daoCreation = await deployContracts.createTokenVotingDAO(
        deployment,
        "test-tokenvoting-dao",
        VotingMode.STANDARD,
      );
      const daoCreationV1 = await deployV1Contracts.createTokenVotingDAO(
        deploymentV1,
        "test-tokenvoting-dao",
        VotingMode.STANDARD,
      );
      daoAddress = daoCreation.daoAddr;
      pluginAddress = daoCreation.pluginAddrs[0];
      daoAddressV1 = daoCreationV1.daoAddr;
    });

    describe("DAO Creation", () => {
      it("Should create a DAO locally", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const daoName = "AddresslistVoting DAO-" +
          Math.floor(Math.random() * 9999) + 1;
        // pin metadata
        const ipfsUri = await client.methods.pinMetadata({
          name: daoName,
          description: "this is a dao",
          links: [],
        });
        const pluginParams: AddresslistVotingPluginInstall = {
          votingSettings: {
            minDuration: 3600,
            minParticipation: 0.5,
            supportThreshold: 0.5,
          },
          addresses: [
            "0x1234567890123456789012345678901234567890",
            "0x0987654321098765432109876543210987654321",
          ],
        };

        const addresslistVotingPlugin = AddresslistVotingClient.encoding
          .getPluginInstallItem(pluginParams, "local");
        addresslistVotingPlugin.id = deployment.addresslistVotingRepo.address;

        const daoCreationParams: CreateDaoParams = {
          metadataUri: ipfsUri,
          ensSubdomain: daoName.toLowerCase().replace(" ", "-"),
          plugins: [
            addresslistVotingPlugin,
          ],
        };

        for await (const step of client.methods.createDao(daoCreationParams)) {
          switch (step.key) {
            case DaoCreationSteps.CREATING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoCreationSteps.DONE:
              expect(typeof step.address).toBe("string");
              expect(step.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              break;
            default:
              throw new Error(
                "Unexpected DAO creation step: " +
                  JSON.stringify(step, null, 2),
              );
          }
        }
      });

      it("should fail if no plugins are specified", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const daoName = "AddresslistVoting DAO-" +
          Math.floor(Math.random() * 9999) + 1;

        const daoCreationParams: CreateDaoParams = {
          metadataUri: "ipfs://QmeJ4kRW21RRgjywi9ydvY44kfx71x2WbRq7ik5xh5zBZK",
          ensSubdomain: daoName.toLowerCase().replace(" ", "-"),
          plugins: [],
        };

        await expect(client.methods.createDao(daoCreationParams).next()).rejects
          .toEqual(
            new ValidationError("plugins field must have at least 1 items"),
          );
      });
    });

    describe("DAO deposit", () => {
      it("Should allow to deposit an ERC1155", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const erc1155Contract = await deployErc1155();
        const tokenId = BigInt(0);
        const deployer = await client.web3.getConnectedSigner().getAddress();
        const deployerBalance = await erc1155Contract.balanceOf(
          deployer,
          tokenId,
        );
        expect(deployerBalance.toString()).toBe("10");
        const steps = client.methods.deposit({
          type: TokenType.ERC1155,
          daoAddressOrEns: daoAddress,
          tokenIds: [tokenId],
          amounts: [BigInt(7)],
          tokenAddress: erc1155Contract.address,
        });
        for await (const step of steps) {
          switch (step.key) {
            case DaoDepositSteps.DEPOSITING:
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(step.tokenIds?.length).toBe(1);
              expect(step.tokenIds?.[0].toString()).toBe(tokenId.toString());
              expect(step.amounts?.length).toBe(1);
              expect(step.amounts?.[0].toString()).toBe(BigInt(7).toString());
              break;
          }
        }
        const daoBalance = await erc1155Contract.balanceOf(daoAddress, tokenId);
        expect(daoBalance.toString()).toBe("7");
      });
      it("Should allow to batch deposit an ERC1155", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const erc1155Contract = await deployErc1155();
        const deployer = await client.web3.getConnectedSigner().getAddress();
        const tokenIds = [BigInt(0), BigInt(1), BigInt(2)];
        const amounts = [BigInt(7), BigInt(8), BigInt(9)];
        const deployerBalanceId0 = await erc1155Contract.balanceOf(
          deployer,
          tokenIds[0],
        );
        const deployerBalanceId1 = await erc1155Contract.balanceOf(
          deployer,
          tokenIds[1],
        );
        const deployerBalanceId2 = await erc1155Contract.balanceOf(
          deployer,
          tokenIds[2],
        );
        expect(deployerBalanceId0.toString()).toBe("10");
        expect(deployerBalanceId1.toString()).toBe("10");
        expect(deployerBalanceId2.toString()).toBe("10");
        const steps = client.methods.deposit({
          type: TokenType.ERC1155,
          daoAddressOrEns: daoAddress,
          tokenIds,
          amounts,
          tokenAddress: erc1155Contract.address,
        });
        for await (const step of steps) {
          switch (step.key) {
            case DaoDepositSteps.DEPOSITING:
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(step.tokenIds?.length).toBe(3);
              expect(step.tokenIds?.toString()).toBe(tokenIds.toString());
              expect(step.amounts?.length).toBe(3);
              expect(step.amounts?.toString()).toBe(amounts.toString());
              break;
          }
        }
        const daoBalanceId0 = await erc1155Contract.balanceOf(
          daoAddress,
          tokenIds[0],
        );
        const daoBalanceId1 = await erc1155Contract.balanceOf(
          daoAddress,
          tokenIds[1],
        );
        const daoBalanceId2 = await erc1155Contract.balanceOf(
          daoAddress,
          tokenIds[2],
        );

        expect(daoBalanceId0.toString()).toBe(amounts[0].toString());
        expect(daoBalanceId1.toString()).toBe(amounts[1].toString());
        expect(daoBalanceId2.toString()).toBe(amounts[2].toString());
      });
      it("Should allow to deposit an ERC721", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const erc721Contract = await deployErc721();
        const tokenId = BigInt(0);
        expect(await erc721Contract.ownerOf(tokenId)).toBe(
          await client.web3.getConnectedSigner().getAddress(),
        );

        const steps = client.methods.deposit({
          type: TokenType.ERC721,
          daoAddressOrEns: daoAddress,
          tokenId,
          tokenAddress: erc721Contract.address,
        });
        for await (const step of steps) {
          switch (step.key) {
            case DaoDepositSteps.DEPOSITING:
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(step.tokenId?.toString()).toBe(tokenId.toString());
              break;
          }
        }
        expect(
          await erc721Contract.ownerOf(tokenId),
        ).toBe(daoAddress);
      });
      it("Should allow to deposit ERC20 (no prior allowance)", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const tokenContract = await deployErc20();
        const amount = BigInt("1000000000000000000");
        const depositParams: DepositParams = {
          type: TokenType.ERC20,
          daoAddressOrEns: daoAddress,
          amount,
          tokenAddress: tokenContract.address,
        };

        expect(
          (
            await tokenContract.functions.balanceOf(
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe("0");

        for await (const step of client.methods.deposit(depositParams)) {
          switch (step.key) {
            case DaoDepositSteps.CHECKED_ALLOWANCE:
              expect(typeof step.allowance).toBe("bigint");
              expect(step.allowance).toBe(BigInt(0));
              break;
            case SetAllowanceSteps.SETTING_ALLOWANCE:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case SetAllowanceSteps.ALLOWANCE_SET:
              expect(typeof step.allowance).toBe("bigint");
              expect(step.allowance).toBe(amount);
              break;
            case DaoDepositSteps.DEPOSITING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(typeof step.amount).toBe("bigint");
              expect(step.amount).toBe(amount);
              break;
            default:
              throw new Error(
                "Unexpected DAO deposit step: " + JSON.stringify(step, null, 2),
              );
          }
        }

        expect(
          (
            await tokenContract.functions.balanceOf(
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe(amount.toString());
      });
      it("Should ensure allowance for an ERC20 token", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const tokenContract = await deployErc20();
        const amount = BigInt("1000000000000000000");
        const SetAllowanceParams: SetAllowanceParams = {
          spender: daoAddress,
          amount,
          tokenAddress: tokenContract.address,
        };

        for await (
          const step of client.methods.setAllowance(SetAllowanceParams)
        ) {
          switch (step.key) {
            case SetAllowanceSteps.SETTING_ALLOWANCE:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case SetAllowanceSteps.ALLOWANCE_SET:
              expect(typeof step.allowance).toBe("bigint");
              expect(step.allowance).toBe(amount);
              break;
            default:
              throw new Error(
                "Unexpected DAO ensure allowance step: " +
                  JSON.stringify(step, null, 2),
              );
          }
        }

        expect(
          (
            await tokenContract.functions.allowance(
              client.web3.getSigner()?.getAddress(),
              daoAddress,
            )
          ).toString(),
        ).toBe(amount.toString());
      });

      it("Should allow to deposit ERC20 (with existing allowance)", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const tokenContract = await deployErc20();

        const depositParams: DepositParams = {
          type: TokenType.ERC20,
          daoAddressOrEns: daoAddress,
          amount: BigInt(7),
          tokenAddress: tokenContract.address,
        };

        expect(
          (
            await tokenContract.functions.balanceOf(
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe("0");

        // Prior allowance
        expect(
          (
            await tokenContract.functions.allowance(
              await client.web3.getSigner()?.getAddress(),
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe("0");

        await tokenContract.functions
          .approve(depositParams.daoAddressOrEns, 10)
          .then((tx) => tx.wait());

        expect(
          (
            await tokenContract.functions.allowance(
              await client.web3.getSigner()?.getAddress(),
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe("10");

        // Deposit
        for await (const step of client.methods.deposit(depositParams)) {
          switch (step.key) {
            case DaoDepositSteps.CHECKED_ALLOWANCE:
              expect(typeof step.allowance).toBe("bigint");
              expect(step.allowance).toBe(BigInt(10));
              break;
            case DaoDepositSteps.DEPOSITING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(typeof step.amount).toBe("bigint");
              expect(step.amount).toBe(BigInt(7));
              break;
            default:
              throw new Error(
                "Unexpected DAO deposit step: " + JSON.stringify(step, null, 2),
              );
          }
        }

        expect(
          (
            await tokenContract.functions.balanceOf(
              depositParams.daoAddressOrEns,
            )
          ).toString(),
        ).toBe("7");
      });

      it("Should allow to deposit native toekn", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);

        const provider = client.web3.getProvider();

        const amount = BigInt(7);

        const depositParams: DepositParams = {
          type: TokenType.NATIVE,
          daoAddressOrEns: daoAddress,
          amount,
        };

        // Deposit
        for await (const step of client.methods.deposit(depositParams)) {
          switch (step.key) {
            case DaoDepositSteps.DEPOSITING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case DaoDepositSteps.DONE:
              expect(typeof step.amount).toBe("bigint");
              expect(step.amount).toBe(BigInt(7));
              break;
            default:
              throw new Error(
                "Unexpected DAO deposit step: " + JSON.stringify(step, null, 2),
              );
          }
        }

        const daoBalance = await provider.getBalance(daoAddress);
        expect(
          daoBalance.toString(),
        ).toBe(amount.toString());
      });

      it("Check if dao factory has register dao permission in the dao registry", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const params: HasPermissionParams = {
          daoAddressOrEns: deployment.managingDaoAddress,
          who: deployment.daoFactory.address,
          where: deployment.daoRegistry.address,
          permission: Permissions.REGISTER_DAO_PERMISSION,
        };
        // this permission was granted on deployment
        // so it must be true
        const hasPermission = await client.methods.hasPermission(params);
        expect(hasPermission).toBe(true);
      });

      it("Check if an user has root permission in a dao", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const who = await contextParamsLocalChain.signer?.getAddress();
        const params: HasPermissionParams = {
          daoAddressOrEns: daoAddress,
          who: who!,
          where: daoAddress,
          permission: Permissions.ROOT_PERMISSION,
        };

        const hasPermission = await client.methods.hasPermission(params);
        expect(hasPermission).toBe(false);
      });

      it("Should prepare the installation of a plugin", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const { dao } = await buildMultisigDAO(
          deployment.multisigRepo.address,
        );
        const steps = client.methods.prepareInstallation(
          {
            daoAddressOrEns: dao,
            pluginRepo: deployment.multisigRepo.address,
            installationAbi: INSTALLATION_ABI,
            installationParams: [
              ["0x1234567890123456789012345678901234567890"],
              [true, 1],
            ],
          },
        );

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
              expect(step.pluginRepo).toBe(deployment.multisigRepo.address);
              expect(step.pluginRepo).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof step.versionTag.build).toBe("number");
              expect(step.versionTag.build).toBe(1);
              expect(typeof step.versionTag.release).toBe("number");
              expect(step.versionTag.release).toBe(1);
              for (const permission of step.permissions) {
                if (permission.condition) {
                  expect(typeof permission.condition).toBe("string");
                  expect(permission.condition).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
                }
                expect(typeof permission.operation).toBe("number");
                expect(typeof permission.where).toBe("string");
                expect(permission.where).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
                expect(typeof permission.who).toBe("string");
                expect(permission.who).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              }
              break;
          }
        }
      });

      it("Should prepare the uninstallation of a plugin", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const { dao, plugin } = await buildMultisigDAO(
          deployment.multisigRepo.address,
        );
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        const installation: SubgraphPluginInstallation = {
          appliedPreparation: {
            helpers: [],
            pluginRepo: {
              id: deployment.multisigRepo.address,
            },
          },
          appliedVersion: {
            metadata: `ipfs://${IPFS_CID}`,
            release: {
              release: 1,
            },
            build: 1,
          },
        };
        mockedClient.request.mockResolvedValueOnce({
          iplugin: { installations: [installation] },
        });
        const steps = client.methods.prepareUninstallation(
          {
            daoAddressOrEns: dao,
            pluginAddress: plugin,
          },
        );

        for await (const step of steps) {
          switch (step.key) {
            case PrepareUninstallationSteps.PREPARING:
              expect(typeof step.txHash).toBe("string");
              expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
              break;
            case PrepareUninstallationSteps.DONE:
              expect(typeof step.pluginAddress).toBe("string");
              expect(step.pluginAddress).toBe(plugin);
              expect(step.pluginAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof step.pluginRepo).toBe("string");
              expect(step.pluginRepo).toBe(deployment.multisigRepo.address);
              expect(step.pluginRepo).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof step.versionTag.build).toBe("number");
              expect(step.versionTag.build).toBe(1);
              expect(typeof step.versionTag.release).toBe("number");
              expect(step.versionTag.release).toBe(1);
              for (const permission of step.permissions) {
                if (permission.condition) {
                  expect(typeof permission.condition).toBe("string");
                  expect(permission.condition).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
                }
                expect(typeof permission.operation).toBe("number");
                expect(typeof permission.where).toBe("string");
                expect(permission.where).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
                expect(typeof permission.who).toBe("string");
                expect(permission.who).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              }
              break;
          }
        }
      });
      it("Should prepare the update of a plugin", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const { dao, plugin } = await buildMultisigDAO(
          deployment.multisigRepo.address,
        );
        // deploy a new build to be able to update
        // this has to be done after creating the DAO beacause
        // the default behaivour is using the latest version
        const deployer = hardhat.provider.getSigner();
        const multisigFactory = new MultisigSetup__factory();
        const newSetup = await multisigFactory
          .connect(deployer)
          .deploy();
        const release = 1;
        await createPluginBuild(
          release,
          deployment.multisigRepo.address,
          deployer,
          newSetup.address,
        );
        const pluginSetupInstance = PluginRepo__factory.connect(
          deployment.multisigRepo.address,
          deployer,
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
            pluginRepo: deployment.multisigRepo.address,
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

    describe("Data retrieval", () => {
      it("Should get a DAO's metadata with a specific address", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_DAO_ADDRESS;

        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify({
              name: "Name",
              description: "Description",
              links: [],
            }),
          ),
        );

        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        const subgraphDao: SubgraphDao = {
          createdAt: Math.round(Date.now() / 1000).toString(),
          id: TEST_DAO_ADDRESS,
          subdomain: "test",
          metadata: `ipfs://${IPFS_CID}`,
          plugins: [
            {
              appliedVersion: {
                build: 1,
                release: {
                  release: 1,
                },
              },
              appliedPreparation: {
                pluginAddress: ADDRESS_ONE,
              },
              appliedPluginRepo: {
                subdomain: "multisig",
              },
            },
            {
              appliedVersion: null,
              appliedPreparation: null,
              appliedPluginRepo: null,
            },
          ],
        };
        mockedClient.request.mockResolvedValueOnce({
          dao: subgraphDao,
        });

        const dao = await client.methods.getDao(daoAddress);
        expect(dao!.address).toBe(subgraphDao.id);
        expect(dao!.ensDomain).toBe(`${subgraphDao.subdomain}.dao.eth`);
        expect(dao!.creationDate).toMatchObject(
          new Date(parseInt(subgraphDao.createdAt) * 1000),
        );

        expect(dao!.plugins.length).toBe(1);
        expect(dao!.plugins[0].instanceAddress).toBe(
          ADDRESS_ONE,
        );
        expect(dao!.plugins.length).toBe(1);
        expect(dao!.plugins[0].id).toBe("multisig.plugin.dao.eth");
        expect(dao!.plugins[0].build).toBe(1);
        expect(dao!.plugins[0].release).toBe(1);

        expect(dao!.metadata.name).toBe("Name");
        expect(dao!.metadata.description).toBe("Description");
        expect(dao!.metadata.links.length).toBe(0);
        expect(dao!.metadata.avatar).toBe(undefined);

        expect(mockedClient.request).toHaveBeenCalledWith(QueryDao, {
          address: daoAddress,
        });
      });
      it("Should get a DAO's metadata of an non existent dao and receive null", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_NON_EXISTING_ADDRESS;
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({ dao: null });

        const dao = await client.methods.getDao(daoAddress);
        expect(dao === null).toBe(true);
      });

      it("Should get a DAO's metadata of an invalid dao address and throw an error", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_INVALID_ADDRESS;
        await expect(() => client.methods.getDao(daoAddress)).rejects.toThrow();
      });

      it("Should retrieve a list of Metadata details of DAO's, based on the given search params", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const limit = 3;
        const params: DaoQueryParams = {
          limit,
          skip: 0,
          direction: SortDirection.ASC,
          sortBy: DaoSortBy.SUBDOMAIN,
        };

        const defaultImplementation = mockedIPFSClient.cat
          .getMockImplementation();
        mockedIPFSClient.cat.mockResolvedValue(
          Buffer.from(
            JSON.stringify({
              name: "Name",
              description: "Description",
              links: [],
            }),
          ),
        );
        const subgraphDao: SubgraphDao = {
          createdAt: Math.round(Date.now() / 1000).toString(),
          id: TEST_DAO_ADDRESS,
          subdomain: "test",
          metadata: `ipfs://${IPFS_CID}`,
          plugins: [
            {
              appliedVersion: {
                build: 1,
                release: {
                  release: 1,
                },
              },
              appliedPreparation: {
                pluginAddress: ADDRESS_ONE,
              },
              appliedPluginRepo: {
                subdomain: "multisig",
              },
            },
          ],
        };
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({
          daos: [subgraphDao],
        });

        const daos = await client.methods.getDaos(params);
        expect(daos.length).toBe(1);
        expect(daos[0].address).toBe(subgraphDao.id);
        expect(daos[0].ensDomain).toBe(`${subgraphDao.subdomain}.dao.eth`);

        expect(daos[0].plugins.length).toBe(1);
        expect(daos[0].plugins[0].instanceAddress).toBe(
          ADDRESS_ONE,
        );
        expect(daos[0].plugins[0].id).toBe("multisig.plugin.dao.eth");
        expect(daos[0].plugins[0].build).toBe(1);
        expect(daos[0].plugins[0].release).toBe(1);

        expect(daos[0].metadata.name).toBe("Name");
        expect(daos[0].metadata.description).toBe("Description");
        expect(daos[0].metadata.avatar).toBe(undefined);

        expect(mockedClient.request).toHaveBeenCalledWith(QueryDaos, {
          ...params,
        });

        mockedIPFSClient.cat.mockImplementation(defaultImplementation);
      });

      it("Should get DAOs balances", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_DAO_ADDRESS;

        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        const lastUpdated = Math.round(Date.now() / 1000).toString();
        const subgraphBalanceNative: SubgraphBalance = {
          id: ADDRESS_ONE,
          __typename: "NativeBalance",
          balance: "50",
          lastUpdated,
        };
        const subgraphBalanceERC20: SubgraphBalance = {
          id: ADDRESS_ONE,
          __typename: "ERC20Balance",
          token: {
            id: ADDRESS_TWO,
            name: "TestToken",
            symbol: "TST",
            decimals: 18,
          },
          balance: "50",
          lastUpdated: Math.round(Date.now() / 1000).toString(),
        };
        const subgraphBalanceERC721: SubgraphBalance = {
          id: ADDRESS_ONE,
          __typename: "ERC721Balance",
          token: {
            id: ADDRESS_TWO,
            name: "TestToken",
            symbol: "TST",
          },
          tokenIds: ["20", "30"],
          lastUpdated,
        };
        const subgraphBalanceERC1155: SubgraphBalance = {
          id: ADDRESS_ONE,
          __typename: "ERC1155Balance",
          metadataUri: "https://example.org/{id}.json",
          lastUpdated,
          token: {
            id: ADDRESS_TWO,
          },
          balances: [
            {
              id: ADDRESS_THREE,
              amount: "10",
              tokenId: "20",
            },
            {
              id: ADDRESS_THREE,
              amount: "10",
              tokenId: "30",
            },
          ],
        };
        mockedClient.request.mockResolvedValueOnce({
          tokenBalances: [
            subgraphBalanceNative,
            subgraphBalanceERC721,
            subgraphBalanceERC20,
            subgraphBalanceERC1155,
          ],
        });

        const balances = await client.methods.getDaoBalances({
          daoAddressOrEns: daoAddress,
        });
        expect(balances!.length).toBe(4);
        if (balances && balances.length > 0) {
          expect(balances[0].type).toBe(TokenType.NATIVE);
          if (balances[0].type === TokenType.NATIVE) {
            expect(balances[0].balance).toBe(
              BigInt(subgraphBalanceNative.balance),
            );
            expect(balances[0].updateDate).toMatchObject(
              new Date(parseInt(subgraphBalanceNative.lastUpdated) * 1000),
            );
          }

          expect(balances[1].type).toBe(TokenType.ERC721);
          if (balances[1].type === TokenType.ERC721) {
            expect(balances[1].name).toBe(
              subgraphBalanceERC721.token.name,
            );
            expect(balances[1].symbol).toBe(
              subgraphBalanceERC721.token.symbol,
            );
            expect(balances[1].address).toBe(
              subgraphBalanceERC721.token.id,
            );
            expect(balances[1].updateDate).toMatchObject(
              new Date(parseInt(subgraphBalanceERC721.lastUpdated) * 1000),
            );
          }

          expect(balances[2].type).toBe(TokenType.ERC20);
          if (balances[2].type === TokenType.ERC20) {
            expect(balances[2].name).toBe(
              subgraphBalanceERC20.token.name,
            );
            expect(balances[2].symbol).toBe(
              subgraphBalanceERC20.token.symbol,
            );
            expect(balances[2].address).toBe(
              subgraphBalanceERC20.token.id,
            );
            expect(balances[2].decimals).toBe(
              subgraphBalanceERC20.token.decimals,
            );
            expect(balances[2].balance).toBe(
              BigInt(subgraphBalanceERC20.balance),
            );
            expect(balances[2].updateDate).toMatchObject(
              new Date(parseInt(subgraphBalanceERC20.lastUpdated) * 1000),
            );
          }

          expect(balances[3].type).toBe(TokenType.ERC1155);
          if (balances[3].type === TokenType.ERC1155) {
            expect(balances[3].address).toBe(
              subgraphBalanceERC1155.token.id,
            );
            expect(balances[3].balances.length).toBe(2);
            for (const index in balances[3].balances) {
              const balance = balances[3].balances[index];
              const subgraphBalance = subgraphBalanceERC1155.balances[index];
              expect(balance.id).toBe(subgraphBalance.id);
              expect(balance.tokenId).toBe(BigInt(subgraphBalance.tokenId));
              expect(balance.amount).toBe(BigInt(subgraphBalance.amount));
            }
            expect(balances[3].updateDate).toMatchObject(
              new Date(parseInt(subgraphBalanceERC1155.lastUpdated) * 1000),
            );
          }
        }

        expect(mockedClient.request).toHaveBeenCalledWith(QueryTokenBalances, {
          limit: 10,
          skip: 0,
          direction: SortDirection.ASC,
          sortBy: AssetBalanceSortBy.LAST_UPDATED,
          where: {
            dao: daoAddress,
          },
        });
      });
      it("Should get DAOs balances from a dao with no balances", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_NO_BALANCES_DAO_ADDRESS;
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({ tokenBalances: [] });
        const balances = await client.methods.getDaoBalances({
          daoAddressOrEns: daoAddress,
        });
        expect(Array.isArray(balances)).toBe(true);
        expect(balances?.length).toBe(0);
      });

      describe("Should get the transfers of a dao", () => {
        let client: Client,
          mockedClient: jest.Mocked<GraphQLClient>,
          params: TransferQueryParams,
          ctx: Context;
        beforeAll(() => {
          contextParamsLocalChain.ENSRegistry = deployment.ensRegistry.address;
          ctx = new Context(contextParamsLocalChain);
          params = {
            daoAddressOrEns: TEST_DAO_ADDRESS,
            sortBy: TransferSortBy.CREATED_AT,
            limit: 10,
            skip: 0,
            direction: SortDirection.ASC,
          };
        });

        beforeEach(() => {
          client = new Client(ctx);
          mockedClient = mockedGraphqlRequest.getMockedInstance(
            client.graphql.getClient(),
          );
        });

        it("should call request correctly", async () => {
          mockedClient.request.mockResolvedValueOnce({ tokenTransfers: [] });
          await client.methods.getDaoTransfers(params);
          expect(mockedClient.request).toHaveBeenCalledWith(
            QueryTokenTransfers,
            {
              sortBy: params.sortBy,
              limit: params.limit,
              skip: params.skip,
              direction: params.direction,
              where: {
                dao: params.daoAddressOrEns,
              },
            },
          );
        });

        it("deposit native transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "NativeTransfer",
            type: SubgraphTransferType.DEPOSIT,
            amount: "50",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.DEPOSIT);
            expect(transfer.tokenType).toBe(TokenType.NATIVE);
            if (
              transfer.type === TransferType.DEPOSIT &&
              transfer.tokenType === TokenType.NATIVE
            ) {
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
            }
          }
        });

        it("deposit erc721 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC721Transfer",
            type: SubgraphTransferType.DEPOSIT,
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
              name: "TestToken",
              symbol: "TST",
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.DEPOSIT);
            expect(transfer.tokenType).toBe(TokenType.ERC721);
            if (
              transfer.type === TransferType.DEPOSIT &&
              transfer.tokenType === TokenType.ERC721
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.token.name).toBe(subgraphTransfer.token.name);
              expect(transfer.token.symbol).toBe(subgraphTransfer.token.symbol);
            }
          }
        });

        it("deposit erc20 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC20Transfer",
            type: SubgraphTransferType.DEPOSIT,
            amount: "50",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
              name: "TestToken",
              symbol: "TST",
              decimals: 18,
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.DEPOSIT);
            expect(transfer.tokenType).toBe(TokenType.ERC20);
            if (
              transfer.type === TransferType.DEPOSIT &&
              transfer.tokenType === TokenType.ERC20
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.token.name).toBe(subgraphTransfer.token.name);
              expect(transfer.token.symbol).toBe(subgraphTransfer.token.symbol);
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
            }
          }
        });
        it("deposit erc1155 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC1155Transfer",
            type: SubgraphTransferType.DEPOSIT,
            amount: "50",
            tokenId: "20",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.DEPOSIT);
            expect(transfer.tokenType).toBe(TokenType.ERC1155);
            if (
              transfer.type === TransferType.DEPOSIT &&
              transfer.tokenType === TokenType.ERC1155
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.tokenId).toBe(BigInt(subgraphTransfer.tokenId));
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
            }
          }
        });
        it("withdraw native transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "NativeTransfer",
            type: SubgraphTransferType.WITHDRAW,
            amount: "50",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.WITHDRAW);
            expect(transfer.tokenType).toBe(TokenType.NATIVE);
            if (
              transfer.type === TransferType.WITHDRAW &&
              transfer.tokenType === TokenType.NATIVE
            ) {
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.proposalId).toBe(subgraphTransfer.proposal.id);
            }
          }
        });

        it("withdraw erc721 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC721Transfer",
            type: SubgraphTransferType.WITHDRAW,
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
              name: "TestToken",
              symbol: "TST",
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.WITHDRAW);
            expect(transfer.tokenType).toBe(TokenType.ERC721);
            if (
              transfer.type === TransferType.WITHDRAW &&
              transfer.tokenType === TokenType.ERC721
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.proposalId).toBe(subgraphTransfer.proposal.id);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.token.name).toBe(subgraphTransfer.token.name);
              expect(transfer.token.symbol).toBe(subgraphTransfer.token.symbol);
            }
          }
        });

        it("withdraw erc20 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC20Transfer",
            type: SubgraphTransferType.WITHDRAW,
            amount: "50",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
              name: "TestToken",
              symbol: "TST",
              decimals: 18,
            },
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.WITHDRAW);
            expect(transfer.tokenType).toBe(TokenType.ERC20);
            if (
              transfer.type === TransferType.WITHDRAW &&
              transfer.tokenType === TokenType.ERC20
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.proposalId).toBe(subgraphTransfer.proposal.id);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.token.name).toBe(subgraphTransfer.token.name);
              expect(transfer.token.symbol).toBe(subgraphTransfer.token.symbol);
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
            }
          }
        });
        it("withdraw erc1155 transfer", async () => {
          const subgraphTransfer: SubgraphTransferListItem = {
            __typename: "ERC1155Transfer",
            type: SubgraphTransferType.WITHDRAW,
            amount: "50",
            createdAt: Math.round(Date.now() / 1000).toString(),
            txHash: TEST_TX_HASH,
            from: ADDRESS_ONE,
            to: ADDRESS_TWO,
            proposal: {
              id: TEST_MULTISIG_PROPOSAL_ID,
            },
            token: {
              id: AddressZero,
            },
            tokenId: "20",
          };
          mockedClient.request.mockResolvedValueOnce({
            tokenTransfers: [subgraphTransfer],
          });

          const transfers = await client.methods.getDaoTransfers(params);
          expect(transfers?.length).toBe(1);
          if (transfers && transfers.length > 0) {
            const transfer = transfers[0];
            expect(transfer.type).toBe(TransferType.WITHDRAW);
            expect(transfer.tokenType).toBe(TokenType.ERC1155);
            if (
              transfer.type === TransferType.WITHDRAW &&
              transfer.tokenType === TokenType.ERC1155
            ) {
              expect(transfer.creationDate).toMatchObject(
                new Date(parseInt(subgraphTransfer.createdAt) * 1000),
              );
              expect(transfer.transactionId).toBe(subgraphTransfer.txHash);
              expect(transfer.from).toBe(subgraphTransfer.from);
              expect(transfer.to).toBe(subgraphTransfer.to);
              expect(transfer.proposalId).toBe(subgraphTransfer.proposal.id);
              expect(transfer.token.address).toBe(subgraphTransfer.token.id);
              expect(transfer.tokenId).toBe(BigInt(subgraphTransfer.tokenId));
              expect(transfer.amount).toBe(BigInt(subgraphTransfer.amount));
            }
          }
        });
      });

      it("Should get a list plugin details", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const defaultCatImplementation = mockedIPFSClient.cat
          .getMockImplementation();

        const releaseMetadata: PluginRepoReleaseMetadata = {
          name: "Name",
          description: "Description",
          images: {},
        };

        const buildMetadata: PluginRepoBuildMetadata = {
          ui: `ipfs://${IPFS_CID}`,
          change: "This is the description of the change",
          pluginSetup: {
            prepareInstallation: [],
            prepareUpdate: {
              1: {
                description: "description of build 1",
                inputs: [],
              },
            },
            prepareUninstallation: [],
          },
        };

        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify(releaseMetadata),
          ),
        );
        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify(buildMetadata),
          ),
        );

        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        const address = "0x1234567890123456789012345678901234567890";
        const pluginRepo: SubgraphPluginRepoListItem = {
          id: address,
          subdomain: "test",
          releases: [
            {
              release: 2,
              metadata: `ipfs://${IPFS_CID}`,
              builds: [
                {
                  build: 1,
                  metadata: `ipfs://${IPFS_CID}`,
                },
              ],
            },
            {
              release: 1,
              metadata: `ipfs://${IPFS_CID}`,
              builds: [
                {
                  build: 1,
                  metadata: `ipfs://${IPFS_CID}`,
                },
                {
                  build: 2,
                  metadata: `ipfs://${IPFS_CID}`,
                },
              ],
            },
          ],
        };
        mockedClient.request.mockResolvedValueOnce({
          pluginRepos: [pluginRepo],
        });

        const params: PluginQueryParams = {
          limit: 10,
          skip: 0,
          direction: SortDirection.ASC,
          sortBy: PluginSortBy.SUBDOMAIN,
        };

        const plugins = await client.methods.getPlugins(params);
        expect(plugins.length).toBe(1);
        expect(plugins[0].current.build.number).toBe(1);
        expect(plugins[0].current.release.number).toBe(2);
        expect(plugins[0].current.build.metadata).toMatchObject(
          buildMetadata,
        );
        expect(plugins[0].current.release.metadata).toMatchObject(
          releaseMetadata,
        );
        expect(plugins[0].releases.length).toBe(2);
        mockedIPFSClient.cat.mockImplementation(defaultCatImplementation);
      });

      it("Should get a plugin details given the address", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);

        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify({
              name: "Name",
              description: "Description",
              images: {},
            }),
          ),
        );
        mockedIPFSClient.cat.mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify({
              ui: "test",
              change: "test",
              pluginSetup: {},
            }),
          ),
        );

        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        const address = "0x1234567890123456789012345678901234567890";
        const pluginRepo: SubgraphPluginRepo = {
          id: address,
          subdomain: "test",
          releases: [
            {
              metadata: `ipfs://${IPFS_CID}`,
              release: 1,
              builds: [
                {
                  metadata: `ipfs://${IPFS_CID}`,
                  build: 1,
                },
              ],
            },
          ],
        };
        mockedClient.request.mockResolvedValueOnce({
          pluginRepo,
        });
        const plugin = await client.methods.getPlugin(address);
        expect(plugin.address).toBe(address);
        expect(plugin.subdomain).toBe("test");
        expect(plugin.current.build.number).toBe(1);
        expect(plugin.current.build.metadata.ui).toBe("test");
        expect(typeof plugin.current.build.metadata.ui).toBe("string");
        expect(plugin.current.build.metadata.change).toBe("test");
        expect(typeof plugin.current.build.metadata.change).toBe("string");
        expect(typeof plugin.current.build.metadata.pluginSetup).toBe(
          "object",
        );
        expect(plugin.current.release.number).toBe(1);
        expect(plugin.current.release.metadata.name).toBe("Name");
        expect(typeof plugin.current.release.metadata.name).toBe("string");
        expect(plugin.current.release.metadata.description).toBe("Description");
        expect(typeof plugin.current.release.metadata.description).toBe(
          "string",
        );
        expect(typeof plugin.current.release.metadata.images).toBe("object");
      });

      it("Should get the protocol version of an invalid dao address and throw an error", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const daoAddress = TEST_INVALID_ADDRESS;
        await expect(() => client.methods.getProtocolVersion(daoAddress))
          .rejects.toThrow(ValidationError);
      });

      it("Should get the protocol version of a dao", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const protocolVersion = await client.methods.getProtocolVersion(
          daoAddress,
        );

        expect(protocolVersion).toMatchObject([1, 3, 0]);
      });
      it("Should get the protocol version of a dao in version 1", async () => {
        const ctx = new Context(contextParamsLocalChain);
        const client = new Client(ctx);
        const protocolVersion = await client.methods.getProtocolVersion(
          daoAddressV1,
        );

        expect(protocolVersion).toMatchObject([1, 0, 0]);
      });

      it("Should retrieve a list of plugin parameters based on the given search params", async () => {
        const context = new Context(contextParamsLocalChain);
        const client = new Client(context);
        const limit = 3;
        const params: PluginPreparationQueryParams = {
          limit,
          skip: 0,
          direction: SortDirection.ASC,
          sortBy: PluginPreparationSortBy.ID,
          pluginAddress: ADDRESS_ONE,
          daoAddressOrEns: TEST_DAO_ADDRESS,
          pluginRepoAddress: ADDRESS_TWO,
        };

        const subgraphPluginPreparation: SubgraphPluginPreparationListItem = {
          id: ADDRESS_ONE,
          type: PluginPreparationType.INSTALLATION,
          creator: ADDRESS_TWO,
          dao: {
            id: ADDRESS_ONE,
          },
          pluginRepo: {
            id: ADDRESS_ONE,
            subdomain: SupportedPluginRepo.TOKEN_VOTING,
          },
          pluginVersion: {
            build: 1,
            release: {
              release: 1,
            },
          },
          pluginAddress: ADDRESS_ONE,
          permissions: [
            {
              who: ADDRESS_ONE,
              where: ADDRESS_TWO,
              condition: ADDRESS_THREE,
              operation: SubgraphPluginPermissionOperation.GRANT,
              permissionId: "0x00000000",
              id: ADDRESS_ONE,
            },
          ],
          helpers: [ADDRESS_ONE, ADDRESS_TWO],
          data: "0x",
        };
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({
          pluginPreparations: [subgraphPluginPreparation],
        });

        const pluginPreparations = await client.methods.getPluginPreparations(
          params,
        );
        expect(pluginPreparations.length).toBe(1);
        const pluginPreparation = pluginPreparations[0];

        expect(pluginPreparation.id).toBe(subgraphPluginPreparation.id);
        expect(pluginPreparation.type).toBe(subgraphPluginPreparation.type);
        expect(pluginPreparation.creator).toBe(
          subgraphPluginPreparation.creator,
        );
        expect(pluginPreparation.dao).toBe(subgraphPluginPreparation.dao.id);
        expect(pluginPreparation.pluginRepo.id).toBe(
          subgraphPluginPreparation.pluginRepo.id,
        );
        expect(pluginPreparation.pluginRepo.subdomain).toBe(
          subgraphPluginPreparation.pluginRepo.subdomain,
        );
        expect(pluginPreparation.versionTag.build).toBe(
          subgraphPluginPreparation.pluginVersion.build,
        );
        expect(pluginPreparation.versionTag.release).toBe(
          subgraphPluginPreparation.pluginVersion.release.release,
        );
        expect(pluginPreparation.pluginAddress).toBe(
          subgraphPluginPreparation.pluginAddress,
        );
        expect(pluginPreparation.permissions.length).toBe(
          subgraphPluginPreparation.permissions.length,
        );
        for (let i = 0; i < pluginPreparation.permissions.length; i++) {
          const permission = pluginPreparation.permissions[i];
          const subgraphPermission = subgraphPluginPreparation.permissions[i];
          expect(permission.who).toBe(subgraphPermission.who);
          expect(permission.where).toBe(subgraphPermission.where);
          expect(permission.condition).toBe(subgraphPermission.condition);
          expect(permission.operation).toBe(
            toPluginPermissionOperationType(subgraphPermission.operation),
          );
          expect(permission.permissionId).toBe(subgraphPermission.permissionId);
        }
        expect(pluginPreparation.helpers.length).toBe(
          subgraphPluginPreparation.helpers.length,
        );
        for (let i = 0; i < pluginPreparation.helpers.length; i++) {
          const helper = pluginPreparation.helpers[i];
          const subgraphHelper = subgraphPluginPreparation.helpers[i];
          expect(helper).toBe(subgraphHelper);
        }
        expect(bytesToHex(pluginPreparation.data)).toBe(
          subgraphPluginPreparation.data,
        );

        expect(mockedClient.request).toHaveBeenCalledWith(
          QueryPluginPreparationsExtended,
          {
            where: {
              dao: params.daoAddressOrEns,
              pluginAddress: params.pluginAddress,
              pluginRepo: params.pluginRepoAddress,
            },
            limit: params.limit,
            skip: params.skip,
            direction: params.direction,
            sortBy: params.sortBy,
          },
        );
      });

      test.todo(
        "Should return an empty array when getting the transfers of a DAO that does not exist",
      ); //, async () => {
      //   const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      //   const client = new Client(ctx)
      //   const res = await client.methods.getTransfers(contextParamsOkWithGraphqlTimeouts.dao)
      //   expect(res.length).toBe(0)
      // })
      test.todo("Should fail if the given ENS is invalid"); // async () => {
      // const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      // const client = new Client(ctx)
      // // will fail when tested on local chain
      // await expect(client.methods.getTransfers("the.dao")).rejects.toThrow(
      //   "Invalid ENS name"
      // );
    });
    describe("isPluginUpdateProposalValid", () => {
      const context = new Context();
      const client = new Client(context);
      let updateActions: DaoAction[];
      let applyUpdateParams: ApplyUpdateParams;
      let subgraphDao: SubgraphDao;
      let subgraphPluginRepo: SubgraphPluginRepo;
      const mockedClient = mockedGraphqlRequest.getMockedInstance(
        client.graphql.getClient(),
      );
      let subgraphPluginPreparation: SubgraphPluginUpdatePreparation;
      let subgraphIProposal: SubgraphIProposal;
      beforeEach(() => {
        mockedClient.request.mockReset();
      });
      beforeAll(() => {
        subgraphPluginPreparation = {
          data: "0x",
        };

        applyUpdateParams = {
          versionTag: {
            build: 2,
            release: 1,
          },
          initData: new Uint8Array(),
          pluginRepo: ADDRESS_ONE,
          pluginAddress,
          permissions: [],
          helpers: [],
        };

        updateActions = client.encoding.applyUpdateAndPermissionsActionBlock(
          daoAddress,
          applyUpdateParams,
        );
        subgraphIProposal = {
          dao: {
            id: daoAddress,
          },
          allowFailureMap: "0",
          actions: toSubgraphActions(updateActions),
        };

        subgraphDao = {
          id: daoAddress,
          subdomain: "test-tokenvoting-dao",
          metadata: `ipfs://${IPFS_CID}`,
          createdAt: "1234567890",
          plugins: [{
            appliedPreparation: {
              pluginAddress: pluginAddress.toLowerCase(),
            },
            appliedPluginRepo: {
              subdomain: SupportedPluginRepo.TOKEN_VOTING,
            },
            appliedVersion: {
              build: 1,
              release: {
                release: 1,
              },
            },
          }],
        };

        subgraphPluginRepo = {
          id: ADDRESS_ONE,
          subdomain: SupportedPluginRepo.TOKEN_VOTING,
          releases: [
            {
              release: 1,
              metadata: `ipfs://${IPFS_CID}`,
              builds: [
                {
                  build: 1,
                  metadata: `ipfs://${IPFS_CID}`,
                },
                {
                  build: 2,
                  metadata: `ipfs://${IPFS_CID}`,
                },
              ],
            },
          ],
        };
      });
      it("Should return true if the update is valid", async () => {
        mockedClient.request.mockResolvedValue({
          iproposal: subgraphIProposal,
          pluginInstallations: [{
            id: ADDRESS_ONE,
          }],
          dao: subgraphDao,
          pluginPreparations: [subgraphPluginPreparation],
          pluginRepo: subgraphPluginRepo,
        });
        mockedIPFSClient.cat.mockResolvedValueOnce(Buffer.from(
          JSON.stringify(TOKEN_VOTING_BUILD_METADATA),
        ));
        const res = await client.methods.isPluginUpdateProposalValid(
          TEST_MULTISIG_PROPOSAL_ID,
        );
        expect(res.isValid).toBe(true);
        expect(res.proposalSettingsErrorCauses).toMatchObject([]);
        expect(res.actionErrorCauses).toMatchObject([[]]);
      });
      it("Should throw if the proposal does not exist", async () => {
        mockedClient.request.mockResolvedValue({
          iproposal: null,
          pluginInstallations: [{
            id: ADDRESS_ONE,
          }],
          dao: subgraphDao,
          pluginPreparations: [subgraphPluginPreparation],
          pluginRepo: subgraphPluginRepo,
        });
        const res = await client.methods.isPluginUpdateProposalValid(
          TEST_MULTISIG_PROPOSAL_ID,
        );
        expect(res.isValid).toBe(false);
        expect(res.proposalSettingsErrorCauses).toMatchObject([
          ProposalSettingsErrorCause.PROPOSAL_NOT_FOUND,
        ]);
        expect(res.actionErrorCauses).toMatchObject([]);
      });
      it("Should throw if the failure map is not 0", async () => {
        mockedClient.request.mockResolvedValue({
          iproposal: { ...subgraphIProposal, allowFailureMap: "1" },
          pluginInstallations: [{
            id: ADDRESS_ONE,
          }],
          dao: subgraphDao,
          pluginPreparations: [subgraphPluginPreparation],
          pluginRepo: subgraphPluginRepo,
        });
        const res = await client.methods.isPluginUpdateProposalValid(
          TEST_MULTISIG_PROPOSAL_ID,
        );
        expect(res.isValid).toBe(false);
        expect(res.proposalSettingsErrorCauses).toMatchObject([
          ProposalSettingsErrorCause.NON_ZERO_ALLOW_FAILURE_MAP_VALUE,
        ]);
        expect(res.actionErrorCauses).toMatchObject([]);
      });
    });
    describe("isDaoUpdateProposalValid", () => {
      let client: Client;
      let initializeFromAction: DaoAction;
      let upgradeToAndCallAction: DaoAction;
      beforeAll(() => {
        const context = new Context(contextParamsLocalChain);
        client = new Client(context);
        initializeFromAction = client.encoding.initializeFromAction(
          daoAddressV1,
          {
            initData: new Uint8Array(),
            previousVersion: [1, 0, 0],
          },
        );
      });
      it("Should return true for a valid update", async () => {
        const implementationAddress = await client.methods.getDaoImplementation(
          client.web3.getAddress(FrameworkContractsNames.DAO_FACTORY),
        );
        upgradeToAndCallAction = client.encoding.upgradeToAndCallAction(
          daoAddressV1,
          {
            data: initializeFromAction.data,
            implementationAddress,
          },
        );
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({
          iproposal: {
            dao: {
              id: daoAddressV1,
            },
            allowFailureMap: "0",
            actions: toSubgraphActions([upgradeToAndCallAction]),
          },
        });
        const res = await client.methods.isDaoUpdateProposalValid(
          TEST_MULTISIG_PROPOSAL_ID,
        );
        expect(res.isValid).toBe(true);
        expect(res.actionErrorCauses).toMatchObject([]);
        expect(res.proposalSettingsErrorCauses).toMatchObject([]);
      });
      it("Should PROPOSAL_NOT_FOUND when the proposal is null", async () => {
        const implementationAddress = await client.methods.getDaoImplementation(
          client.web3.getAddress(FrameworkContractsNames.DAO_FACTORY),
        );
        upgradeToAndCallAction = client.encoding.upgradeToAndCallAction(
          daoAddressV1,
          {
            data: initializeFromAction.data,
            implementationAddress,
          },
        );
        const mockedClient = mockedGraphqlRequest.getMockedInstance(
          client.graphql.getClient(),
        );
        mockedClient.request.mockResolvedValueOnce({
          iproposal: null,
        });
        const res = await client.methods.isDaoUpdateProposalValid(
          TEST_MULTISIG_PROPOSAL_ID,
        );
        expect(res.isValid).toBe(false);
        expect(res.proposalSettingsErrorCauses).toMatchObject([
          ProposalSettingsErrorCause.PROPOSAL_NOT_FOUND,
        ]);
        expect(res.actionErrorCauses).toMatchObject([]);
      });
    });
  });
});
