// @ts-ignore Needed to get the global typing for hardhat
import * as jestenv from "jest-environment-hardhat";
import { Wallet } from "@ethersproject/wallet";
import {
  PluginRepoBuildMetadata,
  SubgraphAction,
  SubgraphProposalBase,
  SubgraphVoterListItemBase,
  SubgraphVoteValues,
} from "../../src";
import { ContextParams } from "@aragon/sdk-client-common";

const IPFS_API_KEY = process?.env?.IPFS_API_KEY || "";
const SATSUMA_ENDPOINT =
  "https://subgraph.satsuma-prod.com/qHR2wGfc5RLi6/aragon/osx-goerli/version/v1.4.1/api";

export const web3endpoints = {
  working: [
    "https://cloudflare-eth.com/",
  ],
  failing: ["https://bad-url-gateway.io/"],
};

const ipfsEndpoints = {
  working: [
    {
      url: process?.env?.IPFS_ENDPOINT || "https://ipfs.example.com/",
      headers: {
        "X-API-KEY": IPFS_API_KEY,
      },
    },
    {
      url: "http://localhost:5001",
    },
    {
      url: "http://localhost:5002",
    },
    {
      url: "http://localhost:5003",
    },
  ],
  failing: [
    {
      url: "https://bad-url-gateway.io/",
    },
  ],
};

const grapqhlEndpoints = {
  working: [
    {
      url: SATSUMA_ENDPOINT,
    },
  ],
  timeout: [
    {
      url: "https://httpstat.us/504?sleep=100",
    },
    {
      url: "https://httpstat.us/504?sleep=200",
    },
    {
      url: "https://httpstat.us/504?sleep=300",
    },
  ],
  failing: [{ url: "https://bad-url-gateway.io/" }],
};

export const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";
export const ADDRESS_TWO = "0x0000000000000000000000000000000000000002";
export const ADDRESS_THREE = "0x0000000000000000000000000000000000000003";
export const ADDRESS_FOUR = "0x0000000000000000000000000000000000000004";

export const TEST_WALLET_ADDRESS = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
export const TEST_WALLET =
  "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e";

// Token
export const TEST_TOKEN_VOTING_PROPOSAL_ID = ADDRESS_ONE +
  "_0x0";

// Address List
export const TEST_ADDRESSLIST_PROPOSAL_ID = ADDRESS_ONE +
  "_0x0";

// Multisig
export const TEST_MULTISIG_PROPOSAL_ID = ADDRESS_ONE +
  "_0x0";

export const TEST_DAO_ADDRESS = ADDRESS_ONE;
// TODO FIX
export const TEST_NO_BALANCES_DAO_ADDRESS = ADDRESS_ONE;
export const TEST_INVALID_ADDRESS = "0x1nv4l1d_4ddr355";
export const TEST_NON_EXISTING_ADDRESS =
  "0x1234567890123456789012345678901234567890";

export const contextParamsMainnet: ContextParams = {
  network: "mainnet",
  signer: new Wallet(TEST_WALLET),
  DAOFactory: "0x0123456789012345678901234567890123456789",
  web3Providers: web3endpoints.working,
  ipfsNodes: ipfsEndpoints.working,
  graphqlNodes: grapqhlEndpoints.working,
};

export const contextParamsLocalChain: ContextParams = {
  network: hardhat.hre.config.networks.hardhat.chainId,
  signer: new Wallet(TEST_WALLET),
  DAOFactory: "0xf8065dD2dAE72D4A8e74D8BB0c8252F3A9acE7f9",
  web3Providers: [hardhat.url],
  ipfsNodes: ipfsEndpoints.working,
  graphqlNodes: grapqhlEndpoints.working,
};

export const contextParamsFailing: ContextParams = {
  network: "mainnet",
  signer: new Wallet(TEST_WALLET),
  DAOFactory: "0x0123456789012345678901234567890123456789",
  web3Providers: web3endpoints.failing,
  ipfsNodes: ipfsEndpoints.failing,
  graphqlNodes: grapqhlEndpoints.failing,
};

export const TEST_TX_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000007E47";
export const IPFS_CID = "QmQPeNsJPyVWPFDVHb77w8G42Fvo15z4bG2X8D2GhfbSXc";

export const SUBGRAPH_ACTIONS: SubgraphAction[] = [{
  to: ADDRESS_ONE,
  value: "0",
  data: "0x",
}, {
  to: ADDRESS_TWO,
  value: "10",
  data: "0x7E47",
}];

export const SUBGRAPH_VOTERS: SubgraphVoterListItemBase[] = [
  {
    voteOption: SubgraphVoteValues.YES,
    voter: {
      address: ADDRESS_ONE,
    },
    voteReplaced: false,
  },
  {
    voteOption: SubgraphVoteValues.NO,
    voter: {
      address: ADDRESS_TWO,
    },
    voteReplaced: true,
  },
];

export const SUBGRAPH_PROPOSAL_BASE: SubgraphProposalBase = {
  id: TEST_ADDRESSLIST_PROPOSAL_ID,
  actions: SUBGRAPH_ACTIONS,
  dao: {
    id: ADDRESS_ONE,
    subdomain: "test",
  },
  creator: TEST_WALLET_ADDRESS,
  abstain: "0",
  no: "1",
  yes: "1",
  executed: false,
  startDate: Math.round(Date.now() / 1000).toString(),
  endDate: Math.round(Date.now() / 1000).toString(),
  approvalReached: false,
  isSignaling: false,
  metadata: `ipfs://${IPFS_CID}`,
};

export const contextParamsOkWithGraphqlTimeouts: ContextParams = {
  network: "mainnet",
  signer: new Wallet(TEST_WALLET),
  DAOFactory: "0x0123456789012345678901234567890123456789",
  web3Providers: web3endpoints.working,
  ipfsNodes: ipfsEndpoints.working,
  graphqlNodes: grapqhlEndpoints.timeout.concat(grapqhlEndpoints.working),
};

export const SUBGRAPH_PLUGIN_INSTALLATION = {
  appliedPreparation: {
    helpers: ["0x1234567890123456789012345678901234567890"],
    pluginRepo: {
      id: "0x1234567890123456789012345678901234567890",
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

export const TOKEN_VOTING_BUILD_METADATA: PluginRepoBuildMetadata = {
  ui: "",
  change:
    "- The `ProposalCreated` event is now emitted with the correct start and end date if 0 is used as an input parameter.\n- The ability to create a proposal now depends on the membership status of the current instead of the snapshot block.",
  pluginSetup: {
    prepareInstallation: [],

    prepareUpdate: {
      1: {
        description: "No input is required for the update.",
        inputs: [],
      },
      2: {
        description: "No input is required for the update.",
        inputs: [],
      },
    },
    prepareUninstallation: [],
  },
};
