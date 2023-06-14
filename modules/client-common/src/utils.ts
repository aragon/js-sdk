import { FunctionFragment, Interface } from "@ethersproject/abi";
import { id } from "@ethersproject/hash";
import { Log } from "@ethersproject/providers";
import { ContractReceipt } from "@ethersproject/contracts";
import {
  bytesToHex,
  InvalidAddressError,
  PluginInstallationPreparationError,
} from "@aragon/sdk-common";
import {
  MetadataAbiInput,
  PrepareInstallationParams,
  PrepareInstallationStep,
  PrepareInstallationStepValue,
  SupportedNetwork,
} from "./types";
import { IClientWeb3Core } from "./internal";
import {
  PluginRepo__factory,
  PluginSetupProcessor__factory,
} from "@aragon/osx-ethers";
import { LIVE_CONTRACTS } from "./constants";
import { defaultAbiCoder } from "@ethersproject/abi";
import { isAddress } from "@ethersproject/address";

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

export function getFunctionFragment(
  data: Uint8Array,
  availableFunctions: string[],
): FunctionFragment {
  const hexBytes = bytesToHex(data);
  const iface = new Interface(availableFunctions);
  return iface.getFunction(hexBytes.substring(0, 10));
}

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

export async function prepareGenericInstallationEstimation(
  web3: IClientWeb3Core,
  params: PrepareInstallationParams,
) {
  const signer = web3.getConnectedSigner();
  const provider = web3.getProvider();
  if (!isAddress(params.pluginRepo)) {
    throw new InvalidAddressError();
  }
  const networkName = (await provider.getNetwork()).name as SupportedNetwork;
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
    LIVE_CONTRACTS[networkName].pluginSetupProcessor,
    signer,
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

export async function* prepareGenericInstallation(
  web3: IClientWeb3Core,
  params: PrepareInstallationParams,
): AsyncGenerator<PrepareInstallationStepValue> {
  const signer = web3.getConnectedSigner();
  const provider = web3.getProvider();
  if (!isAddress(params.pluginRepo)) {
    throw new InvalidAddressError();
  }
  const networkName = (await provider.getNetwork()).name as SupportedNetwork;
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
    LIVE_CONTRACTS[networkName].pluginSetupProcessor,
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
