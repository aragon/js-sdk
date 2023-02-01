import { IDAO } from "@aragon/core-contracts-ethers";
import { ContractReceipt } from "@ethersproject/contracts";
import { VoteValues, VotingMode } from "../client-common/interfaces/plugin";
import {
  IComputeStatusProposal,
  ICreateProposalParams,
  ProposalStatus,
} from "./interfaces/plugin";

import { Interface } from "@ethersproject/abi";
import { id } from "@ethersproject/hash";
import { Log } from "@ethersproject/providers";
import { InvalidVotingModeError } from "@aragon/sdk-common";
import { formatEther } from "@ethersproject/units";
import { InvalidPrecisionError } from "@aragon/sdk-common";

const BIGINT_ZERO = BigInt(0);

export function unwrapProposalParams(
  params: ICreateProposalParams,
): [string, IDAO.ActionStruct[], number, number, boolean, number] {
  return [
    params.metadataUri,
    params.actions ?? [],
    // TODO: Verify => seconds?
    params.startDate ? Math.floor(params.startDate.getTime() / 1000) : 0,
    // TODO: Verify => seconds?
    params.endDate ? Math.floor(params.endDate.getTime() / 1000) : 0,
    params.executeOnPass ?? false,
    params.creatorVote ?? VoteValues.ABSTAIN,
  ];
}

export function computeProposalStatus(
  proposal: IComputeStatusProposal,
): ProposalStatus {
  const now = new Date();
  const startDate = new Date(
    parseInt(proposal.startDate) * 1000,
  );
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  if (startDate >= now) {
    return ProposalStatus.PENDING;
  } else if (endDate >= now) {
    return ProposalStatus.ACTIVE;
  } else if (proposal.executed) {
    return ProposalStatus.EXECUTED;
  } else if (
    proposal.executable
  ) {
    return ProposalStatus.SUCCEEDED;
  } else {
    return ProposalStatus.DEFEATED;
  }
}

export function computeProposalStatusFilter(
  status: ProposalStatus,
): Object {
  let where = {};
  const now = Math.round(new Date().getTime() / 1000).toString();
  switch (status) {
    case ProposalStatus.PENDING:
      where = { startDate_gte: now };
      break;
    case ProposalStatus.ACTIVE:
      where = { startDate_lt: now, endDate_gte: now };
      break;
    case ProposalStatus.EXECUTED:
      where = { executed: true };
      break;
    case ProposalStatus.SUCCEEDED:
      where = { executable: true, endDate_lt: now };
      break;
    case ProposalStatus.DEFEATED:
      where = { executable: false, endDate_lt: now };
      break;
    default:
      throw new Error("invalid proposal status");
  }
  return where;
}

/** Transforms an array of booleans into a bitmap big integer */
export function boolArrayToBitmap(bools?: Array<boolean>) {
  if (!bools || !bools.length) return BigInt(0);
  else if (bools.length > 256) throw new Error("The array is too big");

  let result = BigInt(0);
  for (let i = 0; i < 256; i++) {
    if (!bools[i]) continue;
    result |= BigInt(1) << BigInt(i);
  }

  return result;
}

/** Transforms an array of booleans into a bitmap big integer */
export function bitmapToBoolArray(bitmap: bigint): Array<boolean> {
  if (bitmap >= (BigInt(1) << BigInt(256))) {
    throw new Error("The bitmap value is too big");
  }

  const result: Array<boolean> = [];
  for (let i = 0; i < 256; i++) {
    const mask = BigInt(1) << BigInt(i);
    result.push((bitmap & mask) != BIGINT_ZERO);
  }

  return result;
}

export function isProposalId(propoosalId: string): boolean {
  const regex = new RegExp(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,}$/i);
  return regex.test(propoosalId);
}

export function findLog(
  receipt: ContractReceipt,
  iface: Interface,
  eventName: string,
): Log | undefined {
  return receipt.logs.find(
    (log) =>
      log.topics[0] ===
        id(
          iface.getEvent(eventName).format(
            "sighash",
          ),
        ),
  );
}

export function votingModeToContracts(votingMode: VotingMode): number {
  switch (votingMode) {
    case VotingMode.STANDARD:
      return 0;
    case VotingMode.EARLY_EXECUTION:
      return 1;
    case VotingMode.VOTE_REPLACEMENT:
      return 2;
    default:
      throw new InvalidVotingModeError();
  }
}
export function votingModeFromContracts(votingMode: number): VotingMode {
  switch (votingMode) {
    case 0:
      return VotingMode.STANDARD;
    case 1:
      return VotingMode.EARLY_EXECUTION;
    case 2:
      return VotingMode.VOTE_REPLACEMENT;
    default:
      throw new InvalidVotingModeError();
  }
}

export function parseEtherRatio(ether: string, precision: number = 2): number {
  if (precision <= 0 || !Number.isInteger(precision)) {
    throw new InvalidPrecisionError();
  }
  return parseFloat(
    parseFloat(
      formatEther(ether),
    ).toFixed(precision),
  );
}
