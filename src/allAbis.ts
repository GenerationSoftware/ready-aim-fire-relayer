import { type Abi } from 'viem';
import BasicDeckABIJson from './contracts/abis/BasicDeck.json' assert { type: 'json' };
import BasicDeckLogicABIJson from './contracts/abis/BasicDeckLogic.json' assert { type: 'json' };
import BattleABIJson from './contracts/abis/Battle.json' assert { type: 'json' };
import BattleFactoryABIJson from './contracts/abis/BattleFactory.json' assert { type: 'json' };
import CharacterABIJson from './contracts/abis/Character.json' assert { type: 'json' };
import CharacterFactoryABIJson from './contracts/abis/CharacterFactory.json' assert { type: 'json' };
import DeckConfigurationABIJson from './contracts/abis/DeckConfiguration.json' assert { type: 'json' };
import ERC2771ForwarderABIJson from './contracts/abis/ERC2771Forwarder.json' assert { type: 'json' };
import MinterABIJson from './contracts/abis/Minter.json' assert { type: 'json' };
import MonsterRegistryABIJson from './contracts/abis/MonsterRegistry.json' assert { type: 'json' };
import PlayerStatsStorageABIJson from './contracts/abis/PlayerStatsStorage.json' assert { type: 'json' };
import ZigguratABIJson from './contracts/abis/Ziggurat.json' assert { type: 'json' };
import ZigguratSingletonABIJson from './contracts/abis/ZigguratSingleton.json' assert { type: 'json' };

// Type cast all ABIs
export const BasicDeckABI = BasicDeckABIJson as Abi;
export const BasicDeckLogicABI = BasicDeckLogicABIJson as Abi;
export const BattleABI = BattleABIJson as Abi;
export const BattleFactoryABI = BattleFactoryABIJson as Abi;
export const CharacterABI = CharacterABIJson as Abi;
export const CharacterFactoryABI = CharacterFactoryABIJson as Abi;
export const DeckConfigurationABI = DeckConfigurationABIJson as Abi;
export const ERC2771ForwarderABI = ERC2771ForwarderABIJson as Abi;
export const MinterABI = MinterABIJson as Abi;
export const MonsterRegistryABI = MonsterRegistryABIJson as Abi;
export const PlayerStatsStorageABI = PlayerStatsStorageABIJson as Abi;
export const ZigguratABI = ZigguratABIJson as Abi;
export const ZigguratSingletonABI = ZigguratSingletonABIJson as Abi;

// Combined array of all ABIs
export const allABIs = [
	...BasicDeckABI,
	...BasicDeckLogicABI,
	...BattleABI,
	...BattleFactoryABI,
	...CharacterABI,
	...CharacterFactoryABI,
	...DeckConfigurationABI,
	...ERC2771ForwarderABI,
	...MinterABI,
	...MonsterRegistryABI,
	...PlayerStatsStorageABI,
	...ZigguratABI,
	...ZigguratSingletonABI
];