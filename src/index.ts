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

import { http, encodeFunctionData, createWalletClient, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC2771ForwarderABI } from './abi/ERC2771ForwarderABI';
import { ReadyAimFireABI } from './abi/ReadyAimFireABI';
import { ReadyAimFireFactoryABI } from './abi/ReadyAimFireFactoryABI';
import { decodeCallData, decodeError } from './utils/decode';

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
		console.log('Request received:', { url: request.url  });
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

		const walletClient = createWalletClient({
			account,
			transport: http(env.ETH_RPC_URL),
		});

		const { from, to, data, value, gas, deadline, signature } = json;

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
			let message = error.message;
			console.log('Error message:', error.message);
			console.log('Error short message:', error.shortMessage);
			// Extract error selector and data from error message
			const errorMatch = error.shortMessage.match(/(0x[a-fA-F0-9]{8}):\s*([a-fA-F0-9]*)/);
			if (errorMatch) {
				const errorSelector = errorMatch[1] as `0x${string}`;
				const errorData = errorMatch[2] as `0x${string}`;
				console.log({ errorData })
				// Find error definition in ABIs
				const allABIs = [...ReadyAimFireABI, ...ReadyAimFireFactoryABI, ...ERC2771ForwarderABI];
				const errorDef = allABIs.find(
					(item) => item.type === 'error' && 
					`0x${keccak256(toBytes(`${(item as any).name}(${(item as any).inputs?.map((input: any) => input.type).join(',') || ''})`)).slice(2, 10)}` === errorSelector
				) as any;

				if (errorDef) {
					console.log('Error:', errorDef);
				} else {
					console.log('Unknown error selector:', errorSelector);
				}

				if (errorDef.name == 'FailedCallWithMessage' && errorData !== '') {
					const decodedError = decodeError(`${errorSelector}${errorData}`);
					if (decodedError) {
						console.log({ decodedError })
						const nestedError = decodeError(decodedError.args[0] as `0x${string}`);
						console.log({ nestedError })
						message = nestedError
					}
				}
			}

			return new Response(JSON.stringify({ error: message }), {
				status: 400,
				headers: corsHeaders,
			});
		}
	},
} satisfies ExportedHandler<Env>;
