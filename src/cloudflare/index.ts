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

import { RelayerService, RelayRequest, RelayerConfig } from '../services/RelayerService.js';

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

		const json = await request.json() as RelayRequest;

		if (!env.PRIVATE_KEY) {
			return new Response(JSON.stringify({ error: 'Private key is not defined' }), {
				status: 500,
				headers: corsHeaders,
			});
		}

		// Create relayer config
		const config: RelayerConfig = {
			rpcUrl: env.ETH_RPC_URL,
			privateKey: env.PRIVATE_KEY as `0x${string}`,
			forwarderAddress: env.ERC2771_FORWARDER_ADDRESS as `0x${string}`,
		};

		// Add basic auth if configured
		if (env.RPC_BASIC_AUTH_USER && env.RPC_BASIC_AUTH_PASSWORD) {
			config.basicAuth = {
				username: env.RPC_BASIC_AUTH_USER,
				password: env.RPC_BASIC_AUTH_PASSWORD,
			};
		}

		// Create RelayerService instance
		const relayer = new RelayerService(config);

		// Process the relay request
		const result = await relayer.relay(json);

		// Handle response
		if ('error' in result) {
			// Determine appropriate HTTP status code
			let status = 500;
			if (result.errorType === 'validation') {
				status = 400;
			} else if (result.errorType === 'network') {
				status = 503;
			}
			
			return new Response(JSON.stringify(result), {
				status,
				headers: corsHeaders,
			});
		}

		return new Response(JSON.stringify(result), { headers: corsHeaders });
	},
} satisfies ExportedHandler<Env>;
