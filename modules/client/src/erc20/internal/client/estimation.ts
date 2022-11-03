import { Random } from "@aragon/sdk-common";
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
  public createProposal(
    _params: ICreateProposalParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new Error("A signer is needed");
    } else if (!signer.provider) {
      throw new Error("A web3 provider is needed");
    }

    // TODO: Remove below as the new contracts are ready

    return Promise.resolve(
      this.web3.getApproximateGasFee(Random.getBigInt(BigInt(1500))),
    );

    // TODO: Uncomment below as the new contracts are ready
    /*
    const erc20VotingInstance = ERC20Voting__factory.connect(
      this._pluginAddress,
      signer
    );

    return erc20VotingInstance.estimateGas.newVote(
      ...unwrapProposalParams(params),
    ).then((gasLimit) => {
      return this.web3.getApproximateGasFee(gasLimit.toBigInt());
    });
    */
  }
  /**
   * Estimates the gas fee of casting a vote on a proposal
   *
   * @param {IVoteProposalParams} _params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof ClientErc20Estimation
   */
  public voteProposal(_params: IVoteProposalParams): Promise<GasFeeEstimation> {
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
