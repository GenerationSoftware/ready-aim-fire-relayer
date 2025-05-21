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
import { mainnet } from 'viem/chains';

const ERC2771ForwarderABI = [
	{
		type: 'function',
		name: 'execute',
		inputs: [
			{
				name: 'request',
				type: 'tuple',
				internalType: 'struct ERC2771Forwarder.ForwardRequestData',
				components: [
					{ name: 'from', type: 'address', internalType: 'address' },
					{ name: 'to', type: 'address', internalType: 'address' },
					{ name: 'value', type: 'uint256', internalType: 'uint256' },
					{ name: 'gas', type: 'uint256', internalType: 'uint256' },
					{ name: 'deadline', type: 'uint48', internalType: 'uint48' },
					{ name: 'data', type: 'bytes', internalType: 'bytes' },
					{ name: 'signature', type: 'bytes', internalType: 'bytes' },
				],
			},
		],
		outputs: [],
		stateMutability: 'payable',
	},
];

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
	async fetch(request, env: Env, ctx): Promise<Response> {
		const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);

		const walletClient = createWalletClient({
			account,
			transport: http(env.ETH_RPC_URL),
		});

		const { from, to, data, value, gas, deadline, signature } = await request.json() as RequestBody;
		try {
			// @ts-ignore
			const transactionHash = await walletClient.sendTransaction({
				to,
				data: encodeFunctionData({
					abi: ERC2771ForwarderABI,
					functionName: 'execute',
					args: [{ from, to, value, gas, deadline, data, signature }],
				}),
			});
			return new Response(JSON.stringify({ transactionHash }), { headers: { 'Content-Type': 'application/json' } });
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}
	},
} satisfies ExportedHandler<Env>;
