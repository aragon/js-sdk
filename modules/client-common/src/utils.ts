import {
  defaultAbiCoder,
  FunctionFragment,
  Interface,
} from "@ethersproject/abi";
import { id } from "@ethersproject/hash";
import {
  getNetwork as ethersGetNetwork,
  Log,
  Networkish,
} from "@ethersproject/providers";
import { ContractReceipt } from "@ethersproject/contracts";
import {
  GasFeeEstimation,
  MetadataAbiInput,
  PrepareInstallationParams,
  PrepareInstallationStep,
  PrepareInstallationStepValue,
  PrepareUpdateParams,
  PrepareUpdateStep,
  PrepareUpdateStepValue,
} from "./types";
import {
  IClientGraphQLCore,
  IClientWeb3Core,
  SubgraphPluginInstallation,
} from "./internal";
import {
  PluginRepo__factory,
  PluginSetupProcessor,
  PluginSetupProcessor__factory,
} from "@aragon/osx-ethers";
import { IPFS_ENDPOINTS } from "./constants";
import { isAddress } from "@ethersproject/address";
import { Network } from "@ethersproject/networks";
import { QueryIPlugin } from "./internal/graphql-queries";
import { bytesToHex, hexToBytes } from "./encoding";
import {
  InstallationNotFoundError,
  InvalidAddressError,
  InvalidVersionError,
  PluginInstallationPreparationError,
  PluginUpdatePreparationError,
  UnsupportedNetworkError,
} from "./errors";
import { Zero } from "@ethersproject/constants";
import {
  FrameworkContractsNames,
  getNetworkAlias,
  getNetworkByChainId,
  getNetworkByNameOrAlias,
  getNetworkDeploymentForVersion,
  NetworkConfig,
  networks,
  SupportedAliases,
  SupportedNetworks,
  SupportedVersions,
} from "@aragon/osx-commons-configs";

/**
 * Finds a log in a receipt given the event name
 *
 * @export
 * @param {ContractReceipt} receipt
 * @param {Interface} iface
 * @param {string} eventName
 * @return {(Log | undefined)}
 */
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

/**
 * Gets a function fragment from encoded data
 *
 * @export
 * @param {Uint8Array} data
 * @param {string[]} availableFunctions
 * @return {FunctionFragment}
 */
export function getFunctionFragment(
  data: Uint8Array,
  availableFunctions: string[],
): FunctionFragment {
  const hexBytes = bytesToHex(data);
  const iface = new Interface(availableFunctions);
  return iface.getFunction(hexBytes.substring(0, 10));
}

/**
 * Gets the named types from a metadata abi input
 *
 * @export
 * @param {MetadataAbiInput[]} [inputs=[]]
 * @return {string[]}
 */
export function getNamedTypesFromMetadata(
  inputs: MetadataAbiInput[] = [],
): string[] {
  return inputs.map((input) => {
    if (input.type.startsWith("tuple")) {
      const tupleResult = getNamedTypesFromMetadata(input.components).join(
        ", ",
      );

      let tupleString = `tuple(${tupleResult})`;

      if (input.type.endsWith("[]")) {
        tupleString = tupleString.concat("[]");
      }

      return tupleString;
    } else if (input.type.endsWith("[]")) {
      const baseType = input.type.slice(0, -2);
      return `${baseType}[] ${input.name}`;
    } else {
      return `${input.type} ${input.name}`;
    }
  });
}

/**
 * Gets the named types from a metadata abi input
 *
 * @export
 * @param {IClientWeb3Core} web3
 * @param {PrepareInstallationParams} params
 * @return {Promise<GasFeeEstimation>}
 */
export async function prepareGenericInstallationEstimation(
  web3: IClientWeb3Core,
  params: PrepareInstallationParams,
) {
  const provider = web3.getProvider();
  if (!isAddress(params.pluginRepo)) {
    throw new InvalidAddressError();
  }
  const ethers5NetworkName = (await provider.getNetwork()).name;
  const networkName = getNetworkByNameOrAlias(ethers5NetworkName)?.name;
  if (!networkName) {
    throw new UnsupportedNetworkError(ethers5NetworkName);
  }
  let version = params.version;
  // if version is not specified install latest version
  if (!version) {
    const pluginRepo = PluginRepo__factory.connect(
      params.pluginRepo,
      provider,
    );
    const currentRelease = await pluginRepo.latestRelease();
    const latestVersion = await pluginRepo["getLatestVersion(uint8)"](
      currentRelease,
    );
    version = latestVersion.tag;
  }
  // encode installation params
  const { installationParams = [], installationAbi = [] } = params;
  const data = defaultAbiCoder.encode(
    getNamedTypesFromMetadata(installationAbi),
    installationParams,
  );
  // connect to psp contract
  const deployment = getNetworkDeploymentForVersion(
    networkName,
    SupportedVersions.V1_3_0,
  );
  if (!deployment) {
    throw new UnsupportedNetworkError(networkName);
  }
  const pspContract = PluginSetupProcessor__factory.connect(
    deployment[FrameworkContractsNames.PLUGIN_SETUP_PROCESSOR].address,
    provider,
  );

  const gasEstimation = await pspContract.estimateGas.prepareInstallation(
    params.daoAddressOrEns,
    {
      pluginSetupRef: {
        pluginSetupRepo: params.pluginRepo,
        versionTag: version,
      },
      data,
    },
  );
  return web3.getApproximateGasFee(gasEstimation.toBigInt());
}

/**
 * Prepares an installation of a plugin
 *
 * @export
 * @param {IClientWeb3Core} web3
 * @param {(PrepareInstallationParams & { pluginSetupProcessorAddress: string })} params
 * @return {AsyncGenerator<PrepareInstallationStepValue>}
 */
export async function* prepareGenericInstallation(
  web3: IClientWeb3Core,
  params: PrepareInstallationParams & { pluginSetupProcessorAddress: string },
): AsyncGenerator<PrepareInstallationStepValue> {
  const signer = web3.getConnectedSigner();
  if (!isAddress(params.pluginRepo)) {
    throw new InvalidAddressError();
  }
  let version = params.version;
  // if version is not specified install latest version
  if (!version) {
    const pluginRepo = PluginRepo__factory.connect(
      params.pluginRepo,
      signer,
    );
    const currentRelease = await pluginRepo.latestRelease();
    const latestVersion = await pluginRepo["getLatestVersion(uint8)"](
      currentRelease,
    );
    version = latestVersion.tag;
  }
  // encode installation params
  const { installationParams = [], installationAbi = [] } = params;
  const data = defaultAbiCoder.encode(
    getNamedTypesFromMetadata(installationAbi),
    installationParams,
  );
  // connect to psp contract
  const pspContract = PluginSetupProcessor__factory.connect(
    params.pluginSetupProcessorAddress,
    signer,
  );
  const tx = await pspContract.prepareInstallation(params.daoAddressOrEns, {
    pluginSetupRef: {
      pluginSetupRepo: params.pluginRepo,
      versionTag: version,
    },
    data,
  });

  yield {
    key: PrepareInstallationStep.PREPARING,
    txHash: tx.hash,
  };

  const receipt = await tx.wait();
  const pspContractInterface = PluginSetupProcessor__factory
    .createInterface();
  const log = findLog(
    receipt,
    pspContractInterface,
    "InstallationPrepared",
  );
  if (!log) {
    throw new PluginInstallationPreparationError();
  }
  const parsedLog = pspContractInterface.parseLog(log);
  const pluginAddress = parsedLog.args["plugin"];
  const preparedSetupData = parsedLog.args["preparedSetupData"];
  if (!(pluginAddress || preparedSetupData)) {
    throw new PluginInstallationPreparationError();
  }
  yield {
    key: PrepareInstallationStep.DONE,
    pluginAddress,
    pluginRepo: params.pluginRepo,
    versionTag: version,
    permissions: preparedSetupData.permissions,
    helpers: preparedSetupData.helpers,
  };
}

/**
 * Gets the parameters to be given when preparing an update
 *
 * @param {IClientGraphQLCore} graphql
 * @param {PrepareUpdateParams} params
 * @return {Promise<PluginSetupProcessor.PrepareUpdateParamsStruct>}
 */
async function getPrepareUpdateParams(
  graphql: IClientGraphQLCore,
  params: PrepareUpdateParams,
): Promise<PluginSetupProcessor.PrepareUpdateParamsStruct> {
  type T = {
    iplugin: { installations: SubgraphPluginInstallation[] };
  };
  const { iplugin } = await graphql.request<T>({
    query: QueryIPlugin,
    params: {
      address: params.pluginAddress.toLowerCase(),
      where: { dao: params.daoAddressOrEns.toLowerCase() },
    },
    name: "plugin",
  });

  // filter specified installation
  const { pluginInstallationIndex = 0 } = params;
  const selectedInstallation = iplugin.installations[pluginInstallationIndex];
  if (!selectedInstallation) {
    throw new InstallationNotFoundError();
  }
  // check if version is valid
  if (
    params.newVersion.release !==
      selectedInstallation.appliedVersion.release.release ||
    params.newVersion.build <= selectedInstallation.appliedVersion.build
  ) {
    throw new InvalidVersionError();
  }
  // encode update params
  const { updateParams = [], updateAbi = [] } = params;
  const data = defaultAbiCoder.encode(
    getNamedTypesFromMetadata(updateAbi),
    updateParams,
  );
  return {
    currentVersionTag: {
      build: selectedInstallation.appliedVersion.build,
      release: selectedInstallation.appliedVersion.release.release,
    },
    newVersionTag: params.newVersion,
    pluginSetupRepo: params.pluginRepo,
    setupPayload: {
      plugin: params.pluginAddress,
      currentHelpers: selectedInstallation.appliedPreparation.helpers,
      data,
    },
  };
}

/**
 * Gets an estimation of the gas fee of preparing an update
 *
 * @export
 * @param {IClientWeb3Core} web3
 * @param {IClientGraphQLCore} graphql
 * @param {(PrepareUpdateParams & { pluginSetupProcessorAddress: string })} params
 * @return {Promise<GasFeeEstimation>}
 */
export async function prepareGenericUpdateEstimation(
  web3: IClientWeb3Core,
  graphql: IClientGraphQLCore,
  params: PrepareUpdateParams & { pluginSetupProcessorAddress: string },
): Promise<GasFeeEstimation> {
  const signer = web3.getConnectedSigner();
  const prepareUpdateParams = await getPrepareUpdateParams(graphql, params);
  // connect to psp contract
  const pspContract = PluginSetupProcessor__factory.connect(
    params.pluginSetupProcessorAddress,
    signer,
  );
  const gasEstimation = await pspContract.estimateGas.prepareUpdate(
    params.daoAddressOrEns,
    prepareUpdateParams,
  );
  return web3.getApproximateGasFee(gasEstimation.toBigInt());
}

export async function* prepareGenericUpdate(
  web3: IClientWeb3Core,
  graphql: IClientGraphQLCore,
  params: PrepareUpdateParams & {
    pluginSetupProcessorAddress: string;
  },
): AsyncGenerator<PrepareUpdateStepValue> {
  const signer = web3.getConnectedSigner();
  const prepareUpdateParams = await getPrepareUpdateParams(graphql, params);
  // connect to psp contract
  const pspContract = PluginSetupProcessor__factory.connect(
    params.pluginSetupProcessorAddress,
    signer,
  );

  const tx = await pspContract.prepareUpdate(
    params.daoAddressOrEns,
    prepareUpdateParams,
  );
  yield {
    key: PrepareUpdateStep.PREPARING,
    txHash: tx.hash,
  };
  const receipt = await tx.wait();
  const pspContractInterface = PluginSetupProcessor__factory
    .createInterface();
  const log = findLog(
    receipt,
    pspContractInterface,
    "UpdatePrepared",
  );
  if (!log) {
    throw new PluginUpdatePreparationError();
  }
  const parsedLog = pspContractInterface.parseLog(log);
  const versionTag = parsedLog.args["versionTag"];
  const preparedSetupData = parsedLog.args["preparedSetupData"];
  const initData = parsedLog.args["initData"];
  if (
    !versionTag || versionTag.build !== params.newVersion.build ||
    versionTag.release !== params.newVersion.release || !preparedSetupData ||
    !initData
  ) {
    throw new PluginUpdatePreparationError();
  }
  yield {
    key: PrepareUpdateStep.DONE,
    versionTag,
    pluginRepo: params.pluginRepo,
    pluginAddress: params.pluginAddress,
    initData: hexToBytes(initData),
    permissions: preparedSetupData.permissions,
    helpers: preparedSetupData.helpers,
  };
}

/**
 * Replacing function for ethers getNetwork that includes additional networks
 *
 * @export
 * @param {Networkish} networkish
 * @return {Network}
 */
export function getNetwork(networkish: Networkish): Network {
  let network: Network | null = null;
  try {
    network = ethersGetNetwork(networkish);
  } catch {}
  try {
    network = aragonGetNetwork(networkish);
  } catch {}
  if (!network) {
    throw new UnsupportedNetworkError(networkish.toString());
  }
  return network;
}

/**
 * When ethers 5 does not support the network return a Network object
 * using our osx-commons-configs as a source of truth
 *
 * @private
 * @param {Networkish} networkish
 * @return {*}  {Network}
 */
function aragonGetNetwork(networkish: Networkish): Network | null {
  let aragonNetwork: NetworkConfig | null = null;
  let network: Network | null = null;
  switch (typeof networkish) {
    case "string":
    case "number": {
      if (typeof networkish === "number") {
        aragonNetwork = getNetworkByChainId(networkish);
      } else {
        aragonNetwork = getNetworkByNameOrAlias(networkish);
      }
      if (!aragonNetwork) {
        throw new UnsupportedNetworkError(networkish.toString());
      }
      const ethers5Alias = getNetworkAlias(
        SupportedAliases.ETHERS_5,
        aragonNetwork.name,
      );
      const networkDeployment = getNetworkDeploymentForVersion(
        aragonNetwork.name,
        SupportedVersions.V1_3_0,
      );
      if (!networkDeployment) {
        throw new UnsupportedNetworkError(aragonNetwork.name);
      }
      const ensRegistryAddress = networkDeployment.ENSRegistry?.address;
      network = {
        name: ethers5Alias || aragonNetwork.name,
        chainId: aragonNetwork.chainId,
        ensAddress: ensRegistryAddress,
      };
      break;
    }
    case "object":
      if (networkish.name && networkish.chainId) {
        network = networkish;
      }
      break;
    default:
      throw new UnsupportedNetworkError(networkish);
  }
  return network;
}

/**
 * Gets the interfaceId of a given interface
 *
 * @export
 * @param {Interface} iface
 * @return {string}
 */
export function getInterfaceId(iface: Interface): string {
  let interfaceId = Zero;
  const functions: string[] = Object.keys(iface.functions);
  for (const func of functions) {
    interfaceId = interfaceId.xor(iface.getSighash(func));
  }
  return interfaceId.toHexString();
}

export function getDefaultIpfsNodes(network: SupportedNetworks) {
  return networks[network].isTestnet
    ? IPFS_ENDPOINTS.test
    : IPFS_ENDPOINTS.prod;
}

export function getDefaultGraphqlNodes(network: SupportedNetworks) {
  return [{
    url:
      `https://subgraph.satsuma-prod.com/qHR2wGfc5RLi6/aragon/osx-${network}/version/v1.4.0/api`,
  }];
}
