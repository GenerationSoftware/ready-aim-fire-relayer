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

import { http, encodeFunctionData, createWalletClient, decodeFunctionData, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';
import { ReadyAimFireABI } from './abi/ReadyAimFireABI';
import { ReadyAimFireFactoryABI } from './abi/ReadyAimFireFactoryABI';
import { ERC2771ForwarderABI } from './abi/ERC2771ForwarderABI';

interface RequestBody {
	from: `0x${string}`;
	to: `0x${string}`;
	data: `0x${string}`;
	value: bigint;
	gas: bigint;
	deadline: bigint;
	signature: `0x${string}`;
}

interface NonceRequestBody {
	from: `0x${string}`;
}

interface SigHashRequestBody {
	from: `0x${string}`;
	to: `0x${string}`;
	value: bigint;
	gas: bigint;
	deadline: bigint;
	data: `0x${string}`;
	signature: `0x${string}`;
	nonce: bigint;
}

interface Env {
	ETH_RPC_URL: string;
	PRIVATE_KEY: string;
	ERC2771_FORWARDER_ADDRESS: string;
}

const corsHeaders = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function decodeCallData(data: `0x${string}`) {
	try {
		const decoded = decodeFunctionData({
			abi: [...ReadyAimFireABI, ...ReadyAimFireFactoryABI, ...ERC2771ForwarderABI],
			data,
		});
		return decoded;
	} catch (error) {
		console.error('Error decoding call data:', error);
		return null;
	}
}

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
		console.log('Request received:', request.method);
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (!env.PRIVATE_KEY) {
			return new Response(JSON.stringify({ error: 'Private key is not defined' }), {
				status: 500,
				headers: corsHeaders,
			});
		}

		const url = new URL(request.url);
		if (url.pathname === '/nonce') {
			if (request.method !== 'POST') {
				return new Response(JSON.stringify({ error: 'Method not allowed' }), {
					status: 405,
					headers: corsHeaders,
				});
			}

			const { from } = await request.json() as NonceRequestBody;
			if (!from) {
				return new Response(JSON.stringify({ error: 'Missing required field: from' }), {
					status: 400,
					headers: corsHeaders,
				});
			}

			const publicClient = createPublicClient({
				chain: localhost,
				transport: http(env.ETH_RPC_URL),
			});

			try {
				const nonce = await publicClient.readContract({
					address: env.ERC2771_FORWARDER_ADDRESS as `0x${string}`,
					abi: ERC2771ForwarderABI,
					functionName: 'nonces',
					args: [from],
				});

				return new Response(JSON.stringify({ nonce: nonce.toString() }), { headers: corsHeaders });
			} catch (error: any) {
				console.error('Error getting nonce:', error);
				return new Response(JSON.stringify({ error: error.message }), {
					status: 400,
					headers: corsHeaders,
				});
			}
		}

		console.log('Request received:', request.method);

		const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);

		const walletClient = createWalletClient({
			account,
			transport: http(env.ETH_RPC_URL),
		});

		const publicClient = createPublicClient({
			chain: localhost,
			transport: http(env.ETH_RPC_URL),
		});

		const { from, to, data, value, gas, deadline, signature } = await request.json() as RequestBody;

		if (!to || !data) {
			return new Response(JSON.stringify({ error: 'Missing required fields: to and data' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		try {
			const requestData = {
				from,
				to,
				value: 0n,
				gas,
				deadline: Number(deadline),
				data,
				signature
			} as const;

			console.log("VERIFYING", {
				address: env.ERC2771_FORWARDER_ADDRESS,
				functionName: 'validate',
				args: [requestData],
			});
			const result = await publicClient.readContract({
				address: env.ERC2771_FORWARDER_ADDRESS as `0x${string}`,
				abi: ERC2771ForwarderABI,
				functionName: 'validate',
				args: [requestData],
			});
			console.log("RESULT", result);

			// if (!result[0]) {
			// 	return new Response(JSON.stringify({ error: 'Not trusted forwarder' }), {
			// 		status: 400,
			// 		headers: corsHeaders,
			// 	});
			// }

			// if (!result[1]) {
			// 	return new Response(JSON.stringify({ error: 'Meta tx is not active' }), {
			// 		status: 400,
			// 		headers: corsHeaders,
			// 	});
			// }

			// if (!result[2]) {
			// 	return new Response(JSON.stringify({ error: 'Signer does not match' }), {
			// 		status: 400,
			// 		headers: corsHeaders,
			// 	});
			// }

			// @ts-ignore
			const transactionHash = await walletClient.sendTransaction({
				to: env.ERC2771_FORWARDER_ADDRESS as `0x${string}`,
				data: encodeFunctionData({
					abi: ERC2771ForwarderABI,
					functionName: 'execute',
					args: [requestData],
				}),
			});
			console.log('Transaction sent:', transactionHash);
			return new Response(JSON.stringify({ transactionHash }), { headers: corsHeaders });
		} catch (error: any) {
			console.error('Error sending transaction:', error);
			const decodedData = decodeCallData(data);
			console.log('Decoded call data:', decodedData);
			return new Response(JSON.stringify({ error: error.message }), {
				status: 400,
				headers: corsHeaders,
			});
		}
	},
} satisfies ExportedHandler<Env>;
