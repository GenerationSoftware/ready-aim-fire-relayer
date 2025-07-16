/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { http, encodeFunctionData, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC2771ForwarderABI, allABIs } from './allAbis';
import { decodeCallData } from './utils/decode';
import { ErrorHandler } from './utils/errorHandler';
import deployments from './contracts/deployments.json';

interface RequestBody {
	from: `0x${string}`;
	to: `0x${string}`;
	data: `0x${string}`;
	value: bigint;
	gas: bigint;
	deadline: bigint;
	signature: `0x${string}`;
}

interface Env {
	ETH_RPC_URL: string;
	PRIVATE_KEY: string;
	ERC2771_FORWARDER_ADDRESS: string;
	RPC_BASIC_AUTH_USER?: string;
	RPC_BASIC_AUTH_PASSWORD?: string;
}

const corsHeaders = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handles incoming requests to forward ERC-2771 transactions.
 * 
 * @param request - The incoming request object containing the transaction details.
 * @param env - The environment object containing configuration like ETH_RPC_URL and PRIVATE_KEY.
 * @param ctx - The execution context for the request.
 * @returns A Response object containing the transaction hash or an error message.
 * 
 * @example
 * // Example request body
 * {
 *   from: '0x...', // The address of the sender.
 *   to: '0x...', // The address of the recipient or contract.
 *   data: '0x...', // The encoded function call data.
 *   value: 1000000000000000000n, // The amount of ETH to send with the transaction.
 *   gas: 21000n, // The gas limit for the transaction.
 *   deadline: 1234567890n, // The deadline for the transaction to be executed.
 *   signature: '0x...' // The signature of the transaction.
 * }
 * 
 * @example
 * // Example response body
 * {
 *   transactionHash: '0x...' // The hash of the sent transaction.
 * }
 * 
 * @example
 * // Example error response body
 * {
 *   error: 'Transaction reverted: ...' // The error message if the transaction fails.
 * }
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const json = await request.json() as RequestBody;

		console.log('Request body:', json);

		console.log('Calldata ', decodeCallData(json.data));

		if (!env.PRIVATE_KEY) {
			return new Response(JSON.stringify({ error: 'Private key is not defined' }), {
				status: 500,
				headers: corsHeaders,
			});
		}

		const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);

		// Extract origin from the incoming request URL
		const origin = new URL(request.url).origin;

		// Build headers with optional basic auth
		const headers: Record<string, string> = {
			'Origin': origin
		};

		// Add basic auth header if credentials are provided
		if (env.RPC_BASIC_AUTH_USER && env.RPC_BASIC_AUTH_PASSWORD) {
			const authString = `${env.RPC_BASIC_AUTH_USER}:${env.RPC_BASIC_AUTH_PASSWORD}`;
			const encodedAuth = Buffer.from(authString).toString('base64');
			headers['Authorization'] = `Basic ${encodedAuth}`;
		}

		const walletClient = createWalletClient({
			account,
			transport: http(env.ETH_RPC_URL, {
				fetchOptions: {
					headers
				}
			}),
		});

		const { from, to, data, value, gas, deadline, signature } = json;

		if (!to || !data) {
			return new Response(JSON.stringify({ error: 'Missing required fields: to and data' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		// Get BattleFactory address from deployments.json
		const battleFactoryDeployment = deployments.find(d => d.contractName === 'BattleFactory');
		if (!battleFactoryDeployment) {
			return new Response(JSON.stringify({ error: 'BattleFactory deployment not found' }), {
				status: 500,
				headers: corsHeaders,
			});
		}
		const battleFactoryAddress = battleFactoryDeployment.contractAddress;

		try {
			let recipient;
			let calldata;
			if (to.toLowerCase() === battleFactoryAddress.toLowerCase()) {
				recipient = to
				calldata = data
			} else {
				recipient = env.ERC2771_FORWARDER_ADDRESS as `0x${string}`
				calldata = encodeFunctionData({
					abi: ERC2771ForwarderABI,
					functionName: 'execute',
					args: [{
						from,
						to,
						value: 0n,
						gas,
						deadline: Number(deadline),
						data,
						signature
					}],
				});
			}

			// @ts-ignore
			const transactionHash = await walletClient.sendTransaction({
				to: recipient,
				data: calldata
			});
			console.log('Transaction sent:', transactionHash);
			return new Response(JSON.stringify({ transactionHash }), { headers: corsHeaders });
		} catch (error) {
			// Initialize error handler with all ABIs
			const errorHandler = new ErrorHandler(allABIs);
			const unifiedError = errorHandler.handleError(error);
			
			console.log('Unified error:', JSON.stringify(unifiedError, null, 2));
			
			// Determine appropriate HTTP status code
			let status = 500;
			if (unifiedError.type === 'validation') {
				status = 400;
			} else if (unifiedError.type === 'network') {
				status = 503;
			} else if (unifiedError.type === 'rpc' && unifiedError.code) {
				// Map common RPC error codes to HTTP status codes
				if (unifiedError.code === -32602 || unifiedError.code === -32600) {
					status = 400; // Invalid params or request
				}
			}
			
			return new Response(JSON.stringify({ 
				error: unifiedError.message,
				errorType: unifiedError.type,
				errorDetails: unifiedError.details
			}), {
				status,
				headers: corsHeaders,
			});
		}
	},
} satisfies ExportedHandler<Env>;
