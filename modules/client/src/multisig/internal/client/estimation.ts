import { Multisig__factory } from "@aragon/osx-ethers";
import { IMultisigClientEstimation } from "../interfaces";
import { toUtf8Bytes } from "@ethersproject/strings";
import {
  ApproveMultisigProposalParams,
  CreateMultisigProposalParams,
  MultisigPluginPrepareUpdateParams,
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
 * Estimation module the SDK Address List Client
 */
export class MultisigClientEstimation extends ClientCore
  implements IMultisigClientEstimation {
  /**
   * Estimates the gas fee of creating a proposal on the plugin
   *
   * @param {CreateMultisigProposalParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof MultisigClientEstimation
   */
  public async createProposal(
    params: CreateMultisigProposalParams,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();

    const multisigContract = Multisig__factory.connect(
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

    const estimation = await multisigContract.estimateGas.createProposal(
      toUtf8Bytes(params.metadataUri),
      params.actions || [],
      allowFailureMap,
      params.approve || false,
      params.tryExecution || true,
      Math.round(startTimestamp / 1000),
      Math.round(endTimestamp / 1000),
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of approving a proposal
   *
   * @param {ApproveMultisigProposalParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof MultisigClientEstimation
   */
  public async approveProposal(
    params: ApproveMultisigProposalParams,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();
    const { pluginAddress, id } = decodeProposalId(
      params.proposalId,
    );

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      provider,
    );

    const estimation = await multisigContract.estimateGas.approve(
      id,
      params.tryExecution,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }
  /**
   * Estimates the gas fee of executing a proposal
   *
   * @param {string} proposalId
   * @return {Promise<GasFeeEstimation>}
   * @memberof MultisigClientEstimation
   */
  public async executeProposal(
    proposalId: string,
  ): Promise<GasFeeEstimation> {
    const provider = this.web3.getConnectedSigner();

    const { pluginAddress, id } = decodeProposalId(
      proposalId,
    );

    const multisigContract = Multisig__factory.connect(
      pluginAddress,
      provider,
    );

    const estimation = await multisigContract.estimateGas.execute(
      id,
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }
  /**
   * Estimates the gas fee of preparing an update
   *
   * @param {MultisigPluginPrepareUpdateParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof MultisigClientEstimation
   */
  public async prepareUpdate(
    params: MultisigPluginPrepareUpdateParams,
  ): Promise<GasFeeEstimation> {
    return await prepareGenericUpdateEstimation(this.web3, this.graphql, {
      ...params,
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
      pluginRepo: this.web3.getAddress(
        NonFrameworkContractsNames.MULTISIG_REPO_PROXY,
      ),
    });
  }
}
