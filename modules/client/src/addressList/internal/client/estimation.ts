import { AllowlistVoting__factory } from "@aragon/core-contracts-ethers";
import {
  ClientCore,
  ContextPlugin,
  GasFeeEstimation,
  ICreateProposalParams,
  IExecuteProposalParams,
  IVoteProposalParams,
} from "../../../client-common";
import { IClientAddressListEstimation } from "../../interfaces";
import { toUtf8Bytes } from "@ethersproject/strings";

/**
 * Estimation module the SDK Address List Client
 */
export class ClientAddressListEstimation extends ClientCore
  implements IClientAddressListEstimation {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(ClientAddressListEstimation.prototype);
    Object.freeze(this);
  }

  /**
   * Estimates the gas fee of creating a proposal on the plugin
   *
   * @param {ICreateProposalParams} params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientAddressListEstimation
   */
  public async createProposal(
    params: ICreateProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    const addresslistContract = AllowlistVoting__factory.connect(
      params.pluginAddress,
      signer,
    );

    const startTimestamp = params.startDate?.getTime() || 0;
    const endTimestamp = params.endDate?.getTime() || 0;

    const estimatedGasFee = await addresslistContract.estimateGas.createVote(
      toUtf8Bytes(params.metadataUri),
      params.actions || [],
      Math.round(startTimestamp / 1000),
      Math.round(endTimestamp / 1000),
      params.executeOnPass || false,
      params.creatorVote || 0,
    );
    return this.web3.getApproximateGasFee(estimatedGasFee.toBigInt());
  }

  /**
   * Estimates the gas fee of casting a vote on a proposal
   *
   * @param {IVoteProposalParams} params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientAddressListEstimation
   */
  public async voteProposal(
    params: IVoteProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    const addresslistContract = AllowlistVoting__factory.connect(
      params.pluginAddress,
      signer,
    );

    const estimation = await addresslistContract.estimateGas.vote(
      params.proposalId,
      params.vote,
      false,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of executing an AddressList proposal
   *
   * @param {IExecuteProposalParams} params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientAddressListEstimation
   */
  public async executeProposal(
    params: IExecuteProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }
    const addresslistContract = AllowlistVoting__factory.connect(
      params.pluginAddress,
      signer,
    );
    const estimation = await addresslistContract.estimateGas.execute(
      params.proposalId,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }
}
