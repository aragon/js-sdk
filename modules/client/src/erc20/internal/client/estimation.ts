import { ERC20Voting__factory } from "@aragon/core-contracts-ethers";
import { Random } from "@aragon/sdk-common";
import { toUtf8Bytes } from "@ethersproject/strings";
import {
  ClientCore,
  ContextPlugin,
  GasFeeEstimation,
  ICreateProposalParams,
  IExecuteProposalParams,
  IVoteProposalParams,
} from "../../../client-common";
import { IClientErc20Estimation } from "../../interfaces";
/**
 * Estimation module the SDK ERC20 Client
 */
export class ClientErc20Estimation extends ClientCore
  implements IClientErc20Estimation {
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(ClientErc20Estimation.prototype);
    Object.freeze(this);
  }
  /**
   * Estimates the gas fee of creating a proposal on the plugin
   *
   * @param {ICreateProposalParams} _params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientErc20Estimation
   */
  public async createProposal(
    _params: ICreateProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    const addresslistContract = ERC20Voting__factory.connect(
      _params.pluginAddress,
      signer,
    );

    let cid = "";
    try {
      cid = await this.ipfs.add(JSON.stringify(_params.metadata));
    } catch {
      throw new Error("Could not pin the metadata on IPFS");
    }

    const estimatedGasFee = await addresslistContract.estimateGas.createVote(
      toUtf8Bytes(cid),
      _params.actions || [],
      _params.startDate?.getDate() || 0,
      _params.endDate?.getDate() || 0,
      _params.executeOnPass || false,
      _params.creatorVote || 0,
    );
    return this.web3.getApproximateGasFee(estimatedGasFee.toBigInt());
  }
  /**
   * Estimates the gas fee of casting a vote on a proposal
   *
   * @param {IVoteProposalParams} _params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientErc20Estimation
   */
  public async voteProposal(
    _params: IVoteProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }
    const erc20VotingContract = ERC20Voting__factory.connect(
      _params.pluginAddress,
      signer,
    );

    const estimation = await erc20VotingContract.estimateGas.vote(
      _params.proposalId,
      _params.vote,
      false,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of executing an ERC20 proposal
   *
   * @param {IExecuteProposalParams} _params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientErc20Estimation
   */
  public executeProposal(
    _params: IExecuteProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }
    // TODO: remove this
    return Promise.resolve(
      this.web3.getApproximateGasFee(Random.getBigInt(BigInt(1500))),
    );
  }
}
