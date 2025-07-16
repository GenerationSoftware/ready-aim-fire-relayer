import { decodeErrorResult, decodeFunctionData } from 'viem';
import { allABIs } from '../allAbis.js';
import { loggers } from './logger.js';

export function decodeCallData(data: `0x${string}`) {
	const logger = loggers.decode;
	
	try {
		const decoded = decodeFunctionData({
			abi: allABIs,
			data,
		});
		logger.debug('Successfully decoded call data', {
			functionName: decoded.functionName,
			argsCount: decoded.args?.length || 0
		});
		return decoded;
	} catch (error: any) {
		// Log the error but include the function selector for debugging
		const selector = data.slice(0, 10);
		logger.warn(`Error decoding call data for selector ${selector}`, {
			selector,
			error: error.message
		});
		
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
	const logger = loggers.decode;
	
	try {
		const decoded = decodeErrorResult({
			abi: allABIs,
			data,
		});
		logger.debug('Successfully decoded error', {
			errorName: decoded.errorName,
			args: decoded.args
		});
		return decoded;
	} catch (error) {
		logger.debug('Error decoding error data', { error, data });
		return null;
	}
}
