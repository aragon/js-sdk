import {
  SubgraphAction,
  SubgraphVoteValuesMap,
  VoteValues,
  votingSettingsToContract,
} from "../../client-common";
import {
  Erc20TokenDetails,
  Erc20WrapperTokenDetails,
  Erc721TokenDetails,
  MintTokenParams,
  TokenVotingMember,
  TokenVotingPluginInstall,
  TokenVotingProposal,
  TokenVotingProposalListItem,
} from "../types";
import {
  ContractMintTokenParams,
  ContractTokenVotingInitParams,
  SubgraphContractType,
  SubgraphErc20Token,
  SubgraphErc20WrapperToken,
  SubgraphErc721Token,
  SubgraphTokenVotingMember,
  SubgraphTokenVotingProposal,
  SubgraphTokenVotingProposalListItem,
  SubgraphTokenVotingVoterListItem,
} from "./types";
import { BigNumber } from "@ethersproject/bignumber";
import { Result } from "@ethersproject/abi";
import { AddressZero } from "@ethersproject/constants";
import {
  DaoAction,
  decodeRatio,
  getCompactProposalId,
  hexToBytes,
  InvalidProposalStatusError,
  ProposalMetadata,
  ProposalStatus,
  TokenType,
} from "@aragon/sdk-client-common";
import { Contract } from "@ethersproject/contracts";
import { abi as ERC_20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { JsonRpcProvider } from "@ethersproject/providers";

export function toTokenVotingProposal(
  proposal: SubgraphTokenVotingProposal,
  metadata: ProposalMetadata,
): TokenVotingProposal {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const creationDate = new Date(
    parseInt(proposal.createdAt) * 1000,
  );
  const executionDate = proposal.executionDate
    ? new Date(
      parseInt(proposal.executionDate) * 1000,
    )
    : null;
  let usedVotingWeight: bigint = BigInt(0);
  for (const voter of proposal.voters) {
    usedVotingWeight += BigInt(voter.votingPower);
  }
  const token = parseToken(proposal.plugin.token);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
      description: metadata.description,
      resources: metadata.resources,
      media: metadata.media,
    },
    metadataHash: proposal.metadata,
    startDate,
    endDate,
    creationDate,
    creationBlockNumber: parseInt(proposal.creationBlockNumber),
    executionDate,
    executionBlockNumber: parseInt(proposal.executionBlockNumber) || null,
    executionTxHash: proposal.executionTxHash || null,
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(action.data),
          to: action.to,
          value: BigInt(action.value),
        };
      },
    ),
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? BigInt(proposal.yes) : BigInt(0),
      no: proposal.no ? BigInt(proposal.no) : BigInt(0),
      abstain: proposal.abstain ? BigInt(proposal.abstain) : BigInt(0),
    },
    settings: {
      supportThreshold: decodeRatio(BigInt(proposal.supportThreshold), 6),
      duration: parseInt(proposal.endDate) -
        parseInt(proposal.startDate),
      minParticipation: decodeRatio(
        (BigInt(proposal.minVotingPower) * BigInt(1000000)) /
          BigInt(proposal.totalVotingPower),
        6,
      ),
    },
    token,
    usedVotingWeight,
    totalVotingWeight: BigInt(proposal.totalVotingPower),
    votes: proposal.voters.map(
      (voter: SubgraphTokenVotingVoterListItem) => {
        return {
          voteReplaced: voter.voteReplaced,
          address: voter.voter.address,
          vote: SubgraphVoteValuesMap.get(voter.voteOption) as VoteValues,
          weight: BigInt(voter.votingPower),
        };
      },
    ),
  };
}

export function toTokenVotingProposalListItem(
  proposal: SubgraphTokenVotingProposalListItem,
  metadata: ProposalMetadata,
): TokenVotingProposalListItem {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const token = parseToken(proposal.plugin.token);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    settings: {
      supportThreshold: decodeRatio(BigInt(proposal.supportThreshold), 6),
      duration: parseInt(proposal.endDate) -
        parseInt(proposal.startDate),
      minParticipation: decodeRatio(
        (BigInt(proposal.minVotingPower) * BigInt(1000000)) /
          BigInt(proposal.totalVotingPower),
        6,
      ),
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
    },
    metadataHash: proposal.metadata,
    totalVotingWeight: BigInt(proposal.totalVotingPower),
    startDate,
    endDate,
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? BigInt(proposal.yes) : BigInt(0),
      no: proposal.no ? BigInt(proposal.no) : BigInt(0),
      abstain: proposal.abstain ? BigInt(proposal.abstain) : BigInt(0),
    },
    token,
    votes: proposal.voters.map(
      (voter: SubgraphTokenVotingVoterListItem) => {
        return {
          voteReplaced: voter.voteReplaced,
          address: voter.voter.address,
          vote: SubgraphVoteValuesMap.get(voter.voteOption) as VoteValues,
          weight: BigInt(voter.votingPower),
        };
      },
    ),
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(action.data),
          to: action.to,
          value: BigInt(action.value),
        };
      },
    ),
  };
}

export function mintTokenParamsToContract(
  params: MintTokenParams,
): ContractMintTokenParams {
  return [params.address, BigNumber.from(params.amount)];
}

export function mintTokenParamsFromContract(result: Result): MintTokenParams {
  return {
    address: result[0],
    amount: BigInt(result[1]),
  };
}

export function tokenVotingInitParamsToContract(
  params: TokenVotingPluginInstall,
): ContractTokenVotingInitParams {
  let token: [string, string, string] = ["", "", ""];
  let balances: [string[], BigNumber[]] = [[], []];
  if (params.newToken) {
    token = [AddressZero, params.newToken.name, params.newToken.symbol];
    balances = [
      params.newToken.balances.map((balance) => balance.address),
      params.newToken.balances.map(({ balance }) => BigNumber.from(balance)),
    ];
  } else if (params.useToken) {
    token = [
      params.useToken?.tokenAddress,
      params.useToken.wrappedToken.name,
      params.useToken.wrappedToken.symbol,
    ];
  }
  return [
    votingSettingsToContract(params.votingSettings),
    token,
    balances,
  ];
}

export function parseToken(
  subgraphToken:
    | SubgraphErc20Token
    | SubgraphErc721Token
    | SubgraphErc20WrapperToken,
): Erc20TokenDetails | Erc721TokenDetails | null {
  let token:
    | Erc721TokenDetails
    | Erc20TokenDetails
    | Erc20WrapperTokenDetails
    | null = null;
  if (subgraphToken.__typename === SubgraphContractType.ERC20) {
    token = {
      address: subgraphToken.id,
      symbol: subgraphToken.symbol,
      name: subgraphToken.name,
      decimals: subgraphToken.decimals,
      type: TokenType.ERC20,
    };
  } else if (subgraphToken.__typename === SubgraphContractType.ERC721) {
    token = {
      address: subgraphToken.id,
      symbol: subgraphToken.symbol,
      name: subgraphToken.name,
      type: TokenType.ERC721,
    };
  } else if (subgraphToken.__typename === SubgraphContractType.ERC20_WRAPPER) {
    token = {
      address: subgraphToken.id,
      symbol: subgraphToken.symbol,
      name: subgraphToken.name,
      decimals: subgraphToken.decimals,
      type: TokenType.ERC20,
      underlyingToken: {
        address: subgraphToken.underlyingToken.id,
        symbol: subgraphToken.underlyingToken.symbol,
        name: subgraphToken.underlyingToken.name,
        decimals: subgraphToken.underlyingToken.decimals,
        type: TokenType.ERC20,
      },
    };
  }
  return token;
}

export function toTokenVotingMember(
  member: SubgraphTokenVotingMember,
): TokenVotingMember {
  return {
    address: member.address,
    votingPower: BigInt(member.votingPower),
    balance: BigInt(member.balance),
    delegatee: member.delegatee?.address === member.address || !member.delegatee
      ? null
      : member.delegatee.address,
    delegators: member.delegators.filter((delegator) =>
      delegator.address !== member.address
    ).map((delegator) => {
      return {
        address: delegator.address,
        balance: BigInt(delegator.balance),
      };
    }),
  };
}

export function computeProposalStatus(
  proposal: SubgraphTokenVotingProposal | SubgraphTokenVotingProposalListItem,
): ProposalStatus {
  const now = new Date();
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  // The proposal is executed so the status becomes EXECUTED
  // independently of the other conditions
  if (proposal.executed) {
    return ProposalStatus.EXECUTED;
  }
  // The proposal is not executed and the start date is in the future
  // so the status becomes PENDING
  if (startDate >= now) {
    return ProposalStatus.PENDING;
  }
  // The proposal is not executed and the start date is in the past.
  // Accordingly, we check if the proposal reached enough approval
  // (i.e., that the supportThreshold and minParticipation criteria are both met).
  // If approvalReached is true and the vote has ended (end date is in the past), it has succeeded.
  // This applies to normal mode and vote replacement mode.
  if (proposal.approvalReached && endDate <= now) {
    return ProposalStatus.SUCCEEDED;
  }
  // In early exeuction mode, we calculate if subsequent voting can change the result of the vote.
  // If not, the proposal is early executable and is therefore succeeded as well.
  if (proposal.earlyExecutable) {
    return ProposalStatus.SUCCEEDED;
  }
  // The proposal is not executed and the start date is in the past
  // and the approval threshold is not reached
  // If the end date is in the future this means that you can still vote
  // so the status becomes ACTIVE
  if (now < endDate) {
    return ProposalStatus.ACTIVE;
  }
  // If none of the other conditions are met the status becomes DEFEATED
  return ProposalStatus.DEFEATED;
}

export function computeProposalStatusFilter(status: ProposalStatus) {
  let where = {};
  const now = Math.round(new Date().getTime() / 1000).toString();
  switch (status) {
    case ProposalStatus.PENDING:
      where = { startDate_gte: now };
      break;
    case ProposalStatus.ACTIVE:
      where = { startDate_lt: now, endDate_gte: now, executed: false };
      break;
    case ProposalStatus.EXECUTED:
      where = { executed: true };
      break;
    case ProposalStatus.SUCCEEDED:
      where = {
        or: [
          { approvalReached: true, endDate_lt: now },
          { earlyExecutable: true },
        ],
      };
      break;
    case ProposalStatus.DEFEATED:
      where = {
        potentiallyExecutable: false,
        endDate_lt: now,
        executed: false,
      };
      break;
    default:
      throw new InvalidProposalStatusError();
  }
  return where;
}

/**
 * Checks if the given address is an ERC20 token
 * This function is not 100% accurate.
 * It just checks if the token has a balanceOf
 * function and a decimals function
 *
 * @export
 * @param {string} tokenAddress
 * @param {Signer} signer
 * @return {Promise<boolean>}
 */
export async function isERC20Token(
  tokenAddress: string,
  signer: JsonRpcProvider,
): Promise<boolean> {
  const contract = new Contract(
    tokenAddress,
    ERC_20_ABI,
    signer,
  );
  try {
    await Promise.all([
      contract.balanceOf(AddressZero),
      contract.decimals(),
    ]);
    return true;
  } catch {
    return false;
  }
}
