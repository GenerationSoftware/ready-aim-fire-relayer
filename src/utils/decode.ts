import { decodeErrorResult, decodeFunctionData } from 'viem';
import { BasicDeckABI } from '../abi/BasicDeckABI';
import { BasicDeckLogicABI } from '../abi/BasicDeckLogicABI';
import { ERC2771ForwarderABI } from '../abi/ERC2771ForwarderABI';
import { MinterABI } from '../abi/MinterABI';
import { ReadyAimFireABI } from '../abi/ReadyAimFireABI';
import { ReadyAimFireFactoryABI } from '../abi/ReadyAimFireFactoryABI';

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
