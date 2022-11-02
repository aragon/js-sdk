import { encodeRatio, hexToBytes, strip0x } from "@aragon/sdk-common";
import {
  computeProposalStatus,
  DaoAction,
  ProposalMetadata,
  SubgraphAction,
  SubgraphVoteValuesMap,
  VoteValues,
} from "../../client-common";
import {
  ContractErc20InitParams,
  ContractMintTokenParams,
  Erc20Proposal,
  Erc20ProposalListItem,
  IErc20PluginInstall,
  IMintTokenParams,
  SubgraphErc20Proposal,
  SubgraphErc20ProposalListItem,
  SubgraphErc20VoterListItem,
} from "../interfaces";
import { formatEther } from "@ethersproject/units";
import { BigNumber } from "@ethersproject/bignumber";
import { Result } from "@ethersproject/abi";
import { AddressZero } from "@ethersproject/constants";

export function toErc20Proposal(
  proposal: SubgraphErc20Proposal,
  metadata: ProposalMetadata,
): Erc20Proposal {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const creationDate = new Date(
    parseInt(proposal.createdAt) * 1000,
  );
  let usedVotingWeight: bigint = BigInt(0);
  for (const voter of proposal.voters) {
    usedVotingWeight += BigInt(voter.weight);
  }
  return {
    id: proposal.id,
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.name,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
      description: metadata.description,
      resources: metadata.resources,
      media: metadata.media,
    },
    startDate,
    endDate,
    creationDate,
    actions: proposal.actions.map(
      (action: SubgraphAction): DaoAction => {
        return {
          data: hexToBytes(strip0x(action.data)),
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
      // TODO
      // this should be decoded using the number of decimals that we want
      // right now the encoders/recoders use 2 digit precission but the actual
      // subgraph values are 18 digits precision. Uncomment below for 2 digits
      // precision

      // minSupport: decodeRatio(
      //   BigInt(proposal.supportRequiredPct),
      //   2,
      // ),
      // minTurnout: decodeRatio(
      //   BigInt(proposal.participationRequiredPct),
      //   2,
      // ),
      // TODO DELETE ME
      minSupport: parseFloat(
        formatEther(proposal.supportRequiredPct),
      ),
      minTurnout: parseFloat(
        formatEther(proposal.participationRequiredPct),
      ),
      duration: parseInt(proposal.endDate) -
        parseInt(proposal.startDate),
    },
    token: {
      address: proposal.pkg.token.id,
      symbol: proposal.pkg.token.symbol,
      name: proposal.pkg.token.name,
      decimals: parseInt(proposal.pkg.token.decimals),
    },
    usedVotingWeight,
    totalVotingWeight: BigInt(proposal.votingPower),
    votes: proposal.voters.map(
      (voter: SubgraphErc20VoterListItem) => {
        return {
          address: voter.voter.id,
          vote: SubgraphVoteValuesMap.get(voter.vote) as VoteValues,
          weight: BigInt(voter.weight),
        };
      },
    ),
  };
}

export function toErc20ProposalListItem(
  proposal: SubgraphErc20ProposalListItem,
  metadata: ProposalMetadata,
): Erc20ProposalListItem {
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  return {
    id: proposal.id,
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.name,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
    },
    startDate,
    endDate,
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? BigInt(proposal.yes) : BigInt(0),
      no: proposal.no ? BigInt(proposal.no) : BigInt(0),
      abstain: proposal.abstain ? BigInt(proposal.abstain) : BigInt(0),
    },
    token: {
      address: proposal.pkg.token.id,
      symbol: proposal.pkg.token.symbol,
      name: proposal.pkg.token.name,
      decimals: parseInt(proposal.pkg.token.decimals),
    },
  };
}


export function mintTokenParamsToContract(
  params: IMintTokenParams,
): ContractMintTokenParams {
  return [params.address, BigNumber.from(params.amount)];
}

export function mintTokenParamsFromContract(result: Result): IMintTokenParams {
  return {
    address: result[0],
    amount: BigInt(result[1]),
  };
}


export function erc20InitParamsToContract(
  params: IErc20PluginInstall,
): ContractErc20InitParams {
  // TODO
  // the SC specifies a token field but there is not format on thhis field
  // or how data should be passed to this in case it is using an existing
  // token or miniting a new one

  let token = "";
  if (params.newToken) {
    token = params.newToken.name;
  } else if (params.useToken) {
    token = params.useToken.address;
  }
  return [
    AddressZero,
    AddressZero,
    BigNumber.from(encodeRatio(params.settings.minTurnout, 2)),
    BigNumber.from(encodeRatio(params.settings.minSupport, 2)),
    BigNumber.from(params.settings.minDuration),
    token,
  ];
}
