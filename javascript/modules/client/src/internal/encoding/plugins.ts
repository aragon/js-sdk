import { ERC20Voting__factory, MajorityVoting__factory, WhitelistVoting__factory } from "@aragon/core-contracts-ethers";
import { strip0x, hexToBytes } from "@aragon/sdk-common";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { IErc20PluginInstall, IAddressListPluginInstall, IProposalSettings } from "../interfaces/plugins";

export function encodeAddressListActionInit(params: IAddressListPluginInstall): Uint8Array {
  const addressListVotingInterface = WhitelistVoting__factory.createInterface();
  const args = unwrapAddressListInitParams(params);
  // get hex bytes
  const hexBytes = addressListVotingInterface.encodeFunctionData("initialize", args);
  // Strip 0x => encode in Uint8Array
  return hexToBytes(strip0x(hexBytes));
}

function unwrapAddressListInitParams(params: IAddressListPluginInstall): [string, string, BigNumber, BigNumber, BigNumber, string[]] {
  // TODO
  // not sure if the IDao and gsn params will be needed after
  // this is converted into a plugin
  return [
    AddressZero,
    AddressZero,
    BigNumber.from(Math.round(params.proposals.minTurnout * 100)),
    BigNumber.from(Math.round(params.proposals.minSupport * 100)),
    BigNumber.from(Math.round(params.proposals.minDuration * 100)),
    params.addresses
  ]
}

export function encodeErc20ActionInit(params: IErc20PluginInstall): Uint8Array {
  const erc20votingInterface = ERC20Voting__factory.createInterface();
  const args = unwrapErc20InitParams(params);
  // get hex bytes
  const hexBytes = erc20votingInterface.encodeFunctionData("initialize", args);
  // Strip 0x => encode in Uint8Array
  return hexToBytes(strip0x(hexBytes));
}

function unwrapErc20InitParams(params: IErc20PluginInstall): [string, string, BigNumber, BigNumber, BigNumber, string] {
  // TODO
  // the SC specifies a token field but there is not format on thhis field
  // or how data should be passed to this in case it is using an existing
  // token or miniting a new one

  let token = ""
  if (params.newToken) {
    token = params.newToken.name
  } else if (params.useToken) {
    token = params.useToken.address
  }
  return [
    AddressZero,
    AddressZero,
    BigNumber.from(Math.round(params.proposals.minTurnout * 100)),
    BigNumber.from(Math.round(params.proposals.minSupport * 100)),
    BigNumber.from(Math.round(params.proposals.minDuration * 100)),
    token
  ]
}

export function encodeActionSetPluginConfig(params: IProposalSettings): Uint8Array {
  const votingInterface = MajorityVoting__factory.createInterface();
  const args = unwrapSetPluginConfig(params);
  // get hex bytes
  const hexBytes = votingInterface.encodeFunctionData("changeVoteConfig", args);
  // Strip 0x => encode in Uint8Array
  return hexToBytes(strip0x(hexBytes));
}

function unwrapSetPluginConfig(params: IProposalSettings): [BigNumber, BigNumber, BigNumber] {
  return [
    BigNumber.from(Math.round(params.minTurnout * 100)),
    BigNumber.from(Math.round(params.minSupport * 100)),
    BigNumber.from(Math.round(params.minDuration * 100))
  ]
}