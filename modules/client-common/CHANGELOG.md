# Aragon JS SDK (client-common) changelog

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this
project adheres to [Semantic Versioning](http://semver.org/).

<!--
TEMPLATE:
(Leave "## [UPCOMING]" first and describe the changes below it)

### Added
- Feature 1, 2, 3

### Changed
- Change 1, 2, 3

### Fixed
- Fix 1, 2, 3
-->

## [UPCOMING]

- Add support for zkSync sepolia network

## [1.15.2]

- Make `metadataHash` optional in proposal and dao objects.

## [1.15.2]

- Added `metadataHash` field to proposal and dao objects.

## [1.15.0]
- Added `metadataHash` field to proposal and dao objects.

### Added

- `getDefaultIpfsNodes` function to get the default IPFS nodes for a network
- `getDefaultGraphNodes` function to get the default Graph nodes for a network

### Changed

- Removed `LIVE_CONTRACTS` and used `contracts` from `@aragon/osx-commons-configs` instead
- Removed address getters and changed them for a generic `getAddress` function
- `ContextParams` keys for contract addresses now are the contract names:
  - `daoFactoryAddress` -> `DaoFactory`
  - `multisigRepoAddress` -> `MultisigRepoProxy`
  - `tokenVotingRepoAddress` -> `TokenVotingRepoProxy`
  - etc...
- Removed `IPFS_NODES` and `GRAPH_NODES` and used `getDefaultIpfsNodes` and `getDefaultGraphNodes` instead
- Removed `ADDITIONAL_NETWORKS`
- `SupportedNetworks` and `SupportedVersions` now are exported from `@aragon/osx-commons-configs`
- 

## [1.14.1]

### Fixed
- Typo in `LIVE_CONTRACTS` for mainnet

## [1.14.0]

### Added

- Support for arbitrum sepolia network.
- Support for base sepolia network.

## [1.13.0]

### Changed

-Update `osx-ethers` to v1.3.0

## [1.12.0]

### Changed

- Updated subgraph version to 1.4.0

## [1.11.0]

### Added

- Added `UPGRADE_PLUGIN_PERMISSION` to `PermissionType` enum
- Fix chain id for sepolia network

## [1.11.0]

### Added

- Added `actions` to `SubgraphListItem` type

### Changed

- Replaces tsdx with dts-cli
- Upgrades typescript to v5

## [1.10.0]

### Added

- Add support for arbitrum network

## [1.9.0]

### Changed

- Subgraph version from 1.3.0 to 1.3.1

## [1.8.0]

### Added

- Add new class error `InvalidPermissionOperationType`

## [1.7.1]

### Fixed

- ENS name Regex

## [1.7.0]

### Added

- Add common schemas for validations
- Support for sepolia network
- Move functionality from `sdk-common` to `sdk-client-common`
- New error classes `InvalidVersionError`, `PluginUpdatePreparationError` and
  `ProposalNotFoundError`
- Add `isSubdomain`, `isIpfsUri` and `isEnsName` functions
- Update SizeMismatchError error class

## 1.6.0

### Added

- Add generic prepare update function
- Add generic prepare update estimation function
- Support for multiple versions on `LIVE_CONTRACTS`

## 1.5.0-rc0

### Changed

- Renamed `LIVE_CONTRACTS` properties

### Added

- Support for local chains

## 1.4.0-rc0

### Added

- Support for baseMainnet network

## 1.3.0-rc0

### Added

- Support for baseGoerli network

## 1.2.1-rc0

### Fixed

- Default ipfs endpoints

## 1.2.0-rc0

### Added

- Tests for `getNamedTypesFromMetadata`

### Changed

- Updates `@aragon/osx-ethers` to v1.3.0-rc0.

## 1.1.0

- Added `MULTI_FETCH_TIMEOUT` for operations involving many remote data fetches

## 1.0.2

### Changed

- Fixed the ESM import path

## 1.0.1

### Added

- Add usage of common errors in all the code
- Export of OverridenState
