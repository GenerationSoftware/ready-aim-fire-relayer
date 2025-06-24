import { decodeErrorResult, decodeFunctionData, type Abi } from 'viem';
import BasicDeckABIJson from '../contracts/abis/BasicDeck.json';
import BasicDeckLogicABIJson from '../contracts/abis/BasicDeckLogic.json';
import ERC2771ForwarderABIJson from '../contracts/abis/ERC2771Forwarder.json';
import MinterABIJson from '../contracts/abis/Minter.json';
import BattleABIJson from '../contracts/abis/Battle.json';
import BattleFactoryABIJson from '../contracts/abis/BattleFactory.json';

const BasicDeckABI = BasicDeckABIJson as Abi;
const BasicDeckLogicABI = BasicDeckLogicABIJson as Abi;
const ERC2771ForwarderABI = ERC2771ForwarderABIJson as Abi;
const MinterABI = MinterABIJson as Abi;
const BattleABI = BattleABIJson as Abi;
const BattleFactoryABI = BattleFactoryABIJson as Abi;

const allABIs = [
	...BasicDeckABI,
	...BasicDeckLogicABI,
	...ERC2771ForwarderABI,
	...MinterABI,
	...BattleABI,
	...BattleFactoryABI
]

export function decodeCallData(data: `0x${string}`) {
	try {
		const decoded = decodeFunctionData({
			abi: allABIs,
			data,
		});
		return decoded;
	} catch (error) {
		console.error('Error decoding call data:', error);
		return null;
	}
}

export function decodeError(data: `0x${string}`) {
	try {
		const decoded = decodeErrorResult({
			abi: allABIs,
			data,
		});
		return decoded;
	} catch (error) {
		console.error('Error decoding call data:', error);
		return null;
	}
}
