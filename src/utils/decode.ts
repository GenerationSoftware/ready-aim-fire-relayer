import { decodeErrorResult, decodeFunctionData, type Abi } from 'viem';
import BasicDeckABIJson from '../abi/BasicDeck.json';
import BasicDeckLogicABIJson from '../abi/BasicDeckLogic.json';
import ERC2771ForwarderABIJson from '../abi/ERC2771Forwarder.json';
import MinterABIJson from '../abi/Minter.json';
import ReadyAimFireABIJson from '../abi/ReadyAimFire.json';
import ReadyAimFireFactoryABIJson from '../abi/ReadyAimFireFactory.json';

const BasicDeckABI = BasicDeckABIJson as Abi;
const BasicDeckLogicABI = BasicDeckLogicABIJson as Abi;
const ERC2771ForwarderABI = ERC2771ForwarderABIJson as Abi;
const MinterABI = MinterABIJson as Abi;
const ReadyAimFireABI = ReadyAimFireABIJson as Abi;
const ReadyAimFireFactoryABI = ReadyAimFireFactoryABIJson as Abi;

const allABIs = [
	...BasicDeckABI,
	...BasicDeckLogicABI,
	...ERC2771ForwarderABI,
	...MinterABI,
	...ReadyAimFireABI,
	...ReadyAimFireFactoryABI
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
