import * as aragonContracts from "@aragon/core-contracts-ethers";
import {ethers, Signer, BigNumberish, Contract} from "ethers";

import ENSRegistry from "@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json";
import PublicResolver from "@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json";

const WALLET_ADDRESS = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

export interface Deployment {
  daoFactory: aragonContracts.DAOFactory;
  erc20Repo: aragonContracts.PluginRepo;
  erc20PluginSetup: aragonContracts.ERC20VotingSetup;
  allowListRepo: aragonContracts.PluginRepo;
  allowListPluginSetup: aragonContracts.AllowlistVotingSetup;
}

export async function deploy(): Promise<Deployment> {
  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:8545"
  );
  const deployOwnerWallet = provider.getSigner();
  const {ensRegistry, ensResolver} = await deployEnsContracts(deployOwnerWallet);

  try {
    const managingDaoFactory = new aragonContracts.DAO__factory();
    const managingDao = await managingDaoFactory.connect(deployOwnerWallet).deploy();
    await managingDao.initialize(
      "0x",
      await deployOwnerWallet.getAddress(),
      ethers.constants.AddressZero
    );

    const ensSubdomainRegistrarFactory = new aragonContracts.ENSSubdomainRegistrar__factory();
    const daoRegistrar = await ensSubdomainRegistrarFactory
      .connect(deployOwnerWallet)
      .deploy();
    const pluginRegistrar = await ensSubdomainRegistrarFactory
      .connect(deployOwnerWallet)
      .deploy();

    await registerEnsName(
      "eth",
      "dao",
      ensRegistry,
      daoRegistrar.address,
      ensResolver.address
    );
    await registerEnsName(
      "eth",
      "plugin",
      ensRegistry,
      pluginRegistrar.address,
      ensResolver.address
    );

    await daoRegistrar.initialize(
      managingDao.address,
      ensRegistry.address,
      ethers.utils.namehash("dao.eth")
    );
    await pluginRegistrar.initialize(
      managingDao.address,
      ensRegistry.address,
      ethers.utils.namehash("plugin.eth")
    );

    const pluginRepoRegistryFactory = new aragonContracts.PluginRepoRegistry__factory();
    const pluginRepoRegistry = await pluginRepoRegistryFactory
      .connect(deployOwnerWallet)
      .deploy();

    await pluginRepoRegistry.initialize(
      managingDao.address,
      pluginRegistrar.address
    );
    await managingDao.grant(
      pluginRegistrar.address,
      pluginRepoRegistry.address,
      await pluginRegistrar.REGISTER_ENS_SUBDOMAIN_PERMISSION_ID()
    );

    const pluginRepoFactoryFactory = new aragonContracts.PluginRepoFactory__factory();
    const pluginRepoFactory = await pluginRepoFactoryFactory
      .connect(deployOwnerWallet)
      .deploy(pluginRepoRegistry.address);

    await managingDao.grant(
      pluginRepoRegistry.address,
      pluginRepoFactory.address,
      await pluginRepoRegistry.REGISTER_PLUGIN_REPO_PERMISSION_ID()
    );

    const pluginSetupProcessorFacotry = new aragonContracts.PluginSetupProcessor__factory();
    const pluginSetupProcessor = await pluginSetupProcessorFacotry
      .connect(deployOwnerWallet)
      .deploy(managingDao.address, pluginRepoRegistry.address);

    // dao registry
    const daoRegistryFactory = new aragonContracts.DAORegistry__factory();
    const daoRegistry = await daoRegistryFactory.connect(deployOwnerWallet).deploy();
    await daoRegistry.initialize(managingDao.address, daoRegistrar.address);
    await managingDao.grant(
      daoRegistrar.address,
      daoRegistry.address,
      await daoRegistrar.REGISTER_ENS_SUBDOMAIN_PERMISSION_ID()
    );

    // dao
    const daoFactoryFactory = new aragonContracts.DAOFactory__factory();
    const daoFactory = await daoFactoryFactory
      .connect(deployOwnerWallet)
      .deploy(daoRegistry.address, pluginSetupProcessor.address);
    await managingDao.grant(
      daoRegistry.address,
      daoFactory.address,
      await daoRegistry.REGISTER_DAO_PERMISSION_ID()
    );

    const pluginRepo_Factory = new aragonContracts.PluginRepo__factory();

    const erc20SetupFactory = new aragonContracts.ERC20VotingSetup__factory();
    const erc20PluginSetup = await erc20SetupFactory.connect(deployOwnerWallet).deploy();
    const erc20RepoAddr = await deployPlugin(
      pluginRepoFactory,
      erc20PluginSetup.address,
      "ERC20Voting",
      [1, 0, 0],
      deployOwnerWallet
    );
    const erc20Repo = pluginRepo_Factory.connect(deployOwnerWallet).attach(erc20RepoAddr);

    const allowListFactory = new aragonContracts.AllowlistVotingSetup__factory();
    const allowListPluginSetup = await allowListFactory.connect(deployOwnerWallet).deploy();
    const allowListRepoAddr = await deployPlugin(
      pluginRepoFactory,
      allowListPluginSetup.address,
      "AllowlistVoting",
      [1, 0, 0],
      deployOwnerWallet
    );
    const allowListRepo = pluginRepo_Factory
      .connect(deployOwnerWallet)
      .attach(allowListRepoAddr);

    // send ETH to hardcoded wallet in tests
    await deployOwnerWallet.sendTransaction({
      to: WALLET_ADDRESS,
      value: ethers.utils.parseEther("50.0"),
    });

    return {
      daoFactory,
      erc20Repo,
      erc20PluginSetup,
      allowListRepo,
      allowListPluginSetup,
    };
  } catch (e) {
    throw e;
  }
}

async function deployPlugin(
  pluginRepoFactory: aragonContracts.PluginRepoFactory,
  setupAddr: string,
  name: string,
  version: [BigNumberish, BigNumberish, BigNumberish],
  deployOwnerWallet: Signer
) {
  const repoaddr = await pluginRepoFactory.callStatic.createPluginRepoWithVersion(
    name,
    version,
    setupAddr,
    "0x",
    await deployOwnerWallet.getAddress()
  );
  const tx = await pluginRepoFactory.createPluginRepoWithVersion(
    name,
    version,
    setupAddr,
    "0x",
    await deployOwnerWallet.getAddress()
  );
  await tx.wait();
  return repoaddr;
}

async function deployEnsContracts(deployOwnerWallet: Signer) {
  try {
    const registryFactory = new ethers.ContractFactory(
      ENSRegistry.abi,
      ENSRegistry.bytecode
    );
    const publicResolverFactory = new ethers.ContractFactory(
      PublicResolver.abi,
      PublicResolver.bytecode
    );

    const registry = await registryFactory.connect(deployOwnerWallet).deploy();
    await registry.deployed();

    const publicResolver = await publicResolverFactory
      .connect(deployOwnerWallet)
      .deploy(
        registry.address,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero
      );
    await publicResolver.deployed();

    await registerEnsName(
      "",
      "eth",
      registry,
      await deployOwnerWallet.getAddress(),
      publicResolver.address
    );
    return {ensRegistry: registry, ensResolver: publicResolver};
  } catch (e) {
    throw e;
  }
}

export async function registerEnsName(
  tld: string,
  name: string,
  registry: Contract,
  owner: string,
  resolver: string
) {
  try {
    await registry.setSubnodeRecord(
      tld !== "" ? ethers.utils.namehash(tld) : ethers.constants.HashZero,
      ethers.utils.id(name),
      owner,
      resolver,
      0
    );
  } catch (e) {
    throw e;
  }
}

export async function createDAO(
  daoFactory: aragonContracts.DAOFactory,
  daoSettings: aragonContracts.DAOFactory.DAOSettingsStruct,
  pluginSettings: aragonContracts.DAOFactory.PluginSettingsStruct[]
) {
  let daoAddress = await daoFactory.callStatic.createDao(
    daoSettings,
    pluginSettings
  );
  await daoFactory.createDao(daoSettings, pluginSettings);
  return daoAddress;
}

export async function createAllowlistDAO(deployment: Deployment, name: string) {
  return createDAO(
    deployment.daoFactory,
    {
      metadata: "0x0000",
      name: name,
      trustedForwarder: ethers.constants.AddressZero,
    },
    [
      {
        pluginSetup: deployment.allowListPluginSetup.address,
        pluginSetupRepo: deployment.allowListRepo.address,
        data: ethers.utils.defaultAbiCoder.encode(
          ["uint64", "uint64", "uint64", "address[]"],
          [1, 1, 1, []]
        ),
      },
    ]
  );
}
