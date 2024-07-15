// This file contains the definitions of the AddressList DAO client

import {
  DaoAction,
  GasFeeEstimation,
  InterfaceParams,
  IsMemberParams,
  PrepareInstallationStepValue,
  PrepareUpdateStepValue,
  ProposalMetadata,
} from "@aragon/sdk-client-common";
import {
  ExecuteProposalStepValue,
  MembersQueryParams,
  ProposalCreationStepValue,
  ProposalQueryParams,
} from "../../client-common";
import {
  AddAddressesParams,
  ApproveMultisigProposalParams,
  ApproveProposalStepValue,
  CanApproveParams,
  CreateMultisigProposalParams,
  MultisigPluginPrepareInstallationParams,
  MultisigPluginPrepareUpdateParams,
  MultisigProposal,
  MultisigProposalListItem,
  MultisigVotingSettings,
  RemoveAddressesParams,
  UpdateMultisigVotingSettingsParams,
} from "../types";
import { Approver } from "./types";

// Multisig
export interface IMultisigClientMethods {
  createProposal: (
    params: CreateMultisigProposalParams,
  ) => AsyncGenerator<ProposalCreationStepValue>;
  pinMetadata: (params: ProposalMetadata) => Promise<string>;
  approveProposal: (
    params: ApproveMultisigProposalParams,
  ) => AsyncGenerator<ApproveProposalStepValue>;
  executeProposal: (
    proposalId: string,
  ) => AsyncGenerator<ExecuteProposalStepValue>;
  prepareInstallation: (
    params: MultisigPluginPrepareInstallationParams,
  ) => AsyncGenerator<PrepareInstallationStepValue>;
  prepareUpdate: (
    params: MultisigPluginPrepareUpdateParams,
  ) => AsyncGenerator<PrepareUpdateStepValue>;
  canApprove: (params: CanApproveParams) => Promise<boolean>;
  canExecute: (proposalId: string) => Promise<boolean>;
  getVotingSettings: (
    addressOrEns: string,
    blockNumber?: number,
  ) => Promise<MultisigVotingSettings>;
  getMembers: (params: MembersQueryParams) => Promise<Approver[]>;
  getProposal: (proposalId: string) => Promise<MultisigProposal | null>;
  getProposals: (
    params: ProposalQueryParams,
  ) => Promise<MultisigProposalListItem[]>;
  isMember: (params: IsMemberParams) => Promise<boolean>;
}

export interface IMultisigClientEncoding {
  addAddressesAction: (params: AddAddressesParams) => DaoAction;
  removeAddressesAction: (params: RemoveAddressesParams) => DaoAction;
  updateMultisigVotingSettings: (
    params: UpdateMultisigVotingSettingsParams,
  ) => DaoAction;
}
export interface IMultisigClientDecoding {
  addAddressesAction: (data: Uint8Array) => string[];
  removeAddressesAction: (data: Uint8Array) => string[];
  updateMultisigVotingSettings: (data: Uint8Array) => MultisigVotingSettings;
  findInterface: (data: Uint8Array) => InterfaceParams | null;
}
export interface IMultisigClientEstimation {
  createProposal: (
    params: CreateMultisigProposalParams,
  ) => Promise<GasFeeEstimation>;
  approveProposal: (
    params: ApproveMultisigProposalParams,
  ) => Promise<GasFeeEstimation>;
  executeProposal: (
    proposalId: string,
  ) => Promise<GasFeeEstimation>;
  prepareUpdate: (
    params: MultisigPluginPrepareUpdateParams,
  ) => Promise<GasFeeEstimation>;
}

/** Defines the shape of the AddressList client class */
export interface IMultisigClient {
  methods: IMultisigClientMethods;
  encoding: IMultisigClientEncoding;
  decoding: IMultisigClientDecoding;
  estimation: IMultisigClientEstimation;
}
