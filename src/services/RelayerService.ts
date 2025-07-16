import { http, encodeFunctionData, createWalletClient, WalletClient, Transport, Chain, Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC2771ForwarderABI, allABIs } from '../allAbis.js';
import { decodeCallData } from '../utils/decode.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import deployments from '../contracts/deployments.json' assert { type: 'json' };
import { loggers } from '../utils/logger.js';

export interface RelayRequest {
	from: `0x${string}`;
	to: `0x${string}`;
	data: `0x${string}`;
	value: bigint;
	gas: bigint;
	deadline: bigint;
	signature: `0x${string}`;
}

export interface RelayerConfig {
	rpcUrl: string;
	privateKey: `0x${string}`;
	forwarderAddress: `0x${string}`;
	basicAuth?: {
		username: string;
		password: string;
	};
}

export interface RelayResult {
	transactionHash: `0x${string}`;
}

export interface RelayError {
	error: string;
	errorType?: string;
	errorDetails?: any;
}

export class RelayerService {
	private walletClient: WalletClient<Transport, Chain, Account>;
	private errorHandler: ErrorHandler;
	private battleFactoryAddress: string;
	private logger = loggers.relayer;

	constructor(private config: RelayerConfig) {
		const account = privateKeyToAccount(config.privateKey);
		
		this.logger.debug('Initializing RelayerService', {
			forwarderAddress: config.forwarderAddress,
			rpcUrl: config.rpcUrl,
			hasBasicAuth: !!config.basicAuth
		});
		
		// Build headers with optional basic auth
		const headers: Record<string, string> = {};
		
		// Add basic auth header if credentials are provided
		if (config.basicAuth) {
			const authString = `${config.basicAuth.username}:${config.basicAuth.password}`;
			const encodedAuth = btoa(authString);
			headers['Authorization'] = `Basic ${encodedAuth}`;
			this.logger.debug('Basic auth configured');
		}

		this.walletClient = createWalletClient({
			account,
			transport: http(config.rpcUrl, {
				fetchOptions: {
					headers
				}
			}),
		});

		this.errorHandler = new ErrorHandler(allABIs as any[]);

		// Get BattleFactory address from deployments.json
		const battleFactoryDeployment = deployments.find(d => d.contractName === 'BattleFactory');
		if (!battleFactoryDeployment) {
			this.logger.error('BattleFactory deployment not found in deployments.json');
			throw new Error('BattleFactory deployment not found');
		}
		this.battleFactoryAddress = battleFactoryDeployment.contractAddress;
		this.logger.info('RelayerService initialized', {
			battleFactoryAddress: this.battleFactoryAddress
		});
	}

	async relay(request: RelayRequest): Promise<RelayResult | RelayError> {
		this.logger.info('Processing relay request', {
			from: request.from,
			to: request.to,
			value: request.value.toString(),
			gas: request.gas.toString(),
			deadline: request.deadline.toString(),
			dataLength: request.data.length
		});

		const decodedCall = decodeCallData(request.data);
		this.logger.debug('Decoded call data', decodedCall);

		const { from, to, data, value, gas, deadline, signature } = request;

		if (!to || !data) {
			this.logger.warn('Missing required fields in request', { hasTo: !!to, hasData: !!data });
			return { error: 'Missing required fields: to and data' };
		}

		try {
			let recipient: `0x${string}`;
			let calldata: `0x${string}`;
			
			if (to.toLowerCase() === this.battleFactoryAddress.toLowerCase()) {
				this.logger.info('Direct call to BattleFactory', { to });
				recipient = to;
				calldata = data;
			} else {
				this.logger.info('Wrapping call in ERC2771Forwarder', {
					originalTo: to,
					forwarderAddress: this.config.forwarderAddress
				});
				recipient = this.config.forwarderAddress;
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

			this.logger.debug('Sending transaction', {
				recipient,
				calldataLength: calldata.length
			});

			// @ts-ignore
			const transactionHash = await this.walletClient.sendTransaction({
				to: recipient,
				data: calldata
			});
			
			this.logger.info('Transaction sent successfully', { transactionHash });
			return { transactionHash };
		} catch (error) {
			const unifiedError = this.errorHandler.handleError(error);
			
			this.logger.error('Transaction failed', {
				errorType: unifiedError.type,
				errorMessage: unifiedError.message,
				errorDetails: unifiedError.details
			});
			
			return { 
				error: unifiedError.message,
				errorType: unifiedError.type,
				errorDetails: unifiedError.details
			};
		}
	}
}