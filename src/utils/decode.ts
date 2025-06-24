import { decodeErrorResult, decodeFunctionData } from 'viem';
import { allABIs } from '../allAbis';

export function decodeCallData(data: `0x${string}`) {
	try {
		const decoded = decodeFunctionData({
			abi: allABIs,
			data,
		});
		return decoded;
	} catch (error: any) {
		// Log the error but include the function selector for debugging
		const selector = data.slice(0, 10);
		console.error(`Error decoding call data for selector ${selector}:`, error.message);
		
		// Return partial information even if we can't decode
		return {
			functionName: 'unknown',
			args: [],
			selector,
			rawData: data,
			error: error.message
		};
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
