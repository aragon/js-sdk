import {
  DAOFactory,
  DAOFactory__factory,
  PluginRepo__factory,
} from "@aragon/osx-ethers";
import { AddressZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import {
  CreateDaoParams,
  DepositParams,
  SetAllowanceParams,
} from "../../types";
import {
  estimateErc1155Deposit,
  estimateErc20Deposit,
  estimateErc721Deposit,
  estimateNativeDeposit,
} from "../utils";
import { isAddress } from "@ethersproject/address";
import { toUtf8Bytes } from "@ethersproject/strings";
import { IClientEstimation } from "../interfaces";
import {
  ClientCore,
  GasFeeEstimation,
  InvalidAddressOrEnsError,
  NoProviderError,
  NotImplementedError,
  prepareGenericInstallationEstimation,
  prepareGenericUpdateEstimation,
  PrepareInstallationParams,
  PrepareInstallationSchema,
  PrepareUpdateParams,
  TokenType,
} from "@aragon/sdk-client-common";
import { BigNumber } from "@ethersproject/bignumber";
import {
  CreateDaoSchema,
  DepositErc1155Schema,
  DepositErc20Schema,
  DepositErc721Schema,
  DepositEthSchema,
  SetAllowanceSchema,
} from "../schemas";
import { FrameworkContractsNames } from "@aragon/osx-commons-configs";

/**
 * Estimation module the SDK Generic Client
 */
export class ClientEstimation extends ClientCore implements IClientEstimation {
  public async prepareInstallation(
    params: PrepareInstallationParams,
  ): Promise<GasFeeEstimation> {
    await PrepareInstallationSchema.strict().validate(params);
    return prepareGenericInstallationEstimation(this.web3, params);
  }
  /**
   * Estimates the gas fee of creating a DAO
   *
   * @param {CreateDaoParams} _params
   * @return {Promise<GasFeeEstimation>}
   * @memberof ClientEstimation
   */
  public async createDao(params: CreateDaoParams): Promise<GasFeeEstimation> {
    await CreateDaoSchema.strict().validate(params);
    const provider = this.web3.getProvider();

    const daoInstance = DAOFactory__factory.connect(
      this.web3.getAddress(FrameworkContractsNames.DAO_FACTORY),
      provider,
    );
    const pluginInstallationData: DAOFactory.PluginSettingsStruct[] = [];
    for (const plugin of params.plugins) {
      const repo = PluginRepo__factory.connect(plugin.id, provider);

      const currentRelease = await repo.latestRelease();
      const latestVersion = await repo["getLatestVersion(uint8)"](
        currentRelease,
      );
      pluginInstallationData.push({
        pluginSetupRef: {
          pluginSetupRepo: repo.address,
          versionTag: latestVersion.tag,
        },
        data: plugin.data,
      });
    }

    const gasEstimation = await daoInstance.estimateGas.createDao(
      {
        subdomain: params.ensSubdomain ?? "",
        metadata: toUtf8Bytes(params.metadataUri),
        daoURI: params.daoUri ?? "",
        trustedForwarder: params.trustedForwarder ?? AddressZero,
      },
      pluginInstallationData,
    );

    return this.web3.getApproximateGasFee(gasEstimation.toBigInt());
  }
  /**
   * Estimates the gas fee of depositing ether or an ERC20 token into the DAO
   * This does not estimate the gas cost of updating the allowance of an ERC20 token
   *
   * @param {DepositParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof ClientEstimation
   */
  public async deposit(
    params: DepositParams,
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    let estimation: BigNumber;
    switch (params.type) {
      case TokenType.NATIVE:
        await DepositEthSchema.strict().validate(params);
        estimation = await estimateNativeDeposit(signer, params);
        break;
      case TokenType.ERC20:
        await DepositErc20Schema.strict().validate(params);
        estimation = await estimateErc20Deposit(signer, params);
        break;
      case TokenType.ERC721:
        await DepositErc721Schema.strict().validate(params);
        estimation = await estimateErc721Deposit(signer, params);
        break;
      case TokenType.ERC1155:
        await DepositErc1155Schema.strict().validate(params);
        estimation = await estimateErc1155Deposit(signer, params);
        break;
      default:
        throw new NotImplementedError(
          "Token type not valid",
        );
    }
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of updating the allowance of an ERC20 token
   *
   * @param {SetAllowanceParams} _params
   * @return {Promise<GasFeeEstimation>}
   * @memberof ClientEstimation
   */
  public async setAllowance(
    params: SetAllowanceParams,
  ): Promise<GasFeeEstimation> {
    await SetAllowanceSchema.strict().validate(params);
    const signer = this.web3.getConnectedSigner();
    // resolve ens
    let daoAddress = params.spender;
    if (!isAddress(daoAddress)) {
      await this.web3.ensureOnline();
      const provider = this.web3.getProvider();
      if (!provider) {
        throw new NoProviderError();
      }
      const resolvedAddress = await provider.resolveName(daoAddress);
      if (!resolvedAddress) {
        throw new InvalidAddressOrEnsError();
      }
      daoAddress = resolvedAddress;
    }

    const contract = new Contract(
      params.tokenAddress,
      ERC20_ABI,
      signer,
    );
    return contract.estimateGas.approve(
      daoAddress,
      params.amount,
    ).then((gasLimit) => {
      return this.web3.getApproximateGasFee(gasLimit.toBigInt());
    });
  }
  /**
   * Estimates the gas fee of preparing an update
   *
   * @param {PrepareUpdateParams} params
   * @return {Promise<GasFeeEstimation>}
   * @memberof ClientEstimation
   */
  public async prepareUpdate(
    params: PrepareUpdateParams,
  ): Promise<GasFeeEstimation> {
    return await prepareGenericUpdateEstimation(this.web3, this.graphql, {
      ...params,
      pluginSetupProcessorAddress: this.web3.getAddress(
        FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR,
      ),
    });
  }
}
