import {
  GovernanceERC20__factory,
  TokenVoting__factory,
} from "@aragon/osx-ethers";
import {
  CreateMajorityVotingProposalParams,
  VoteProposalParams,
} from "../../../client-common";
import { ITokenVotingClientEstimation } from "../interfaces";
import { toUtf8Bytes } from "@ethersproject/strings";
import {
  DelegateTokensParams,
  TokenVotingPluginPrepareUpdateParams,
} from "../../types";
import {
  boolArrayToBitmap,
  ClientCore,
  decodeProposalId,
  GasFeeEstimation,
  prepareGenericUpdateEstimation,
  SizeMismatchError,
} from "@aragon/sdk-client-common";
import {
  FrameworkContractsNames,
  NonFrameworkContractsNames,
} from "@aragon/osx-commons-configs";
/**
 * Estimation module the SDK TokenVoting Client
 */
export class TokenVotingClientEstimation extends ClientCore
  implements ITokenVotingClientEstimation {
  /**
   * Estimates the gas fee of creating a proposal on the plugin
   *
   * @param {CreateMajorityVotingProposalParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async createProposal(
    params: CreateMajorityVotingProposalParams,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();

    const tokenVotingContract = TokenVoting__factory.connect(
      params.pluginAddress,
      provider,
    );

    if (
      params.failSafeActions?.length &&
      params.failSafeActions.length !== params.actions?.length
    ) {
      throw new SizeMismatchError("failSafeActions", "actions");
    }
    const allowFailureMap = boolArrayToBitmap(params.failSafeActions);

    const startTimestamp = params.startDate?.getTime() || 0;
    const endTimestamp = params.endDate?.getTime() || 0;

    const estimatedGasFee = await tokenVotingContract.estimateGas
      .createProposal(
        toUtf8Bytes(params.metadataUri),
        params.actions || [],
        allowFailureMap,
        Math.round(startTimestamp / 1000),
        Math.round(endTimestamp / 1000),
        params.creatorVote || 0,
        params.executeOnPass || false,
      );
    return this.web3.getApproximateGasFee(estimatedGasFee.toBigInt());
  }
  /**
   * Estimates the gas fee of casting a vote on a proposal
   *
   * @param {VoteProposalParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async voteProposal(
    params: VoteProposalParams,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(
      params.proposalId,
    );

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      provider,
    );

    const estimation = await tokenVotingContract.estimateGas.vote(
      id,
      params.vote,
      false,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of executing a TokenVoting proposal
   *
   * @param {string} proposalId
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async executeProposal(
    proposalId: string,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(
      proposalId,
    );

    const tokenVotingContract = TokenVoting__factory.connect(
      pluginAddress,
      provider,
    );
    const estimation = await tokenVotingContract.estimateGas.execute(
      id,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of delegating voting power to a delegatee
   *
   * @param {DelegateTokensParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async delegateTokens(
    params: DelegateTokensParams,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();
    const governanceErc20Contract = GovernanceERC20__factory.connect(
      params.tokenAddress,
      provider,
    );
    const estimation = await governanceErc20Contract.estimateGas.delegate(
      params.delegatee,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of undelegating voting power
   *
   * @param {string} tokenAddress
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async undelegateTokens(
    tokenAddress: string,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    return this.delegateTokens({
      tokenAddress,
      delegatee: await signer.getAddress(),
    });
  }
  /**
   * Estimates the gas fee of preparing an update
   *
   * @param {TokenVotingPluginPrepareUpdateParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof TokenVotingClientEstimation
   */
  public async prepareUpdate(
    params: TokenVotingPluginPrepareUpdateParams,
  ): Promise<GasFeeEstimation> {
    return await prepareGenericUpdateEstimation(this.web3, this.graphql, {
      ...params,
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.TOKEN_VOTING_REPO_PROXY,
      ),
    });
  }
}
