#!/usr/bin/env node

import { createServer } from 'node:http';
import { RelayerService, RelayRequest, RelayerConfig } from './services/RelayerService.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loggers, logConfiguration } from './utils/logger.js';

// Configuration interface
interface Config {
	port: number;
	rpcUrl: string;
	privateKey: `0x${string}`;
	forwarderAddress: `0x${string}`;
	basicAuth?: {
		username: string;
		password: string;
	};
}

// Load configuration from environment variables or config file
function loadConfig(): Config {
	// Try to load from config file first
	const configPath = path.join(process.cwd(), 'relayer.config.json');
	if (fs.existsSync(configPath)) {
		const configFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
		return {
			port: configFile.port || 3000,
			rpcUrl: configFile.rpcUrl || process.env.ETH_RPC_URL || '',
			privateKey: (configFile.privateKey || process.env.PRIVATE_KEY || '') as `0x${string}`,
			forwarderAddress: (configFile.forwarderAddress || process.env.ERC2771_FORWARDER_ADDRESS || '') as `0x${string}`,
			basicAuth: configFile.basicAuth || (
				process.env.RPC_BASIC_AUTH_USER && process.env.RPC_BASIC_AUTH_PASSWORD ? {
					username: process.env.RPC_BASIC_AUTH_USER,
					password: process.env.RPC_BASIC_AUTH_PASSWORD,
				} : undefined
			),
		};
	}

	// Fall back to environment variables
	return {
		port: parseInt(process.env.PORT || '3000', 10),
		rpcUrl: process.env.ETH_RPC_URL || '',
		privateKey: (process.env.PRIVATE_KEY || '') as `0x${string}`,
		forwarderAddress: (process.env.ERC2771_FORWARDER_ADDRESS || '') as `0x${string}`,
		basicAuth: process.env.RPC_BASIC_AUTH_USER && process.env.RPC_BASIC_AUTH_PASSWORD ? {
			username: process.env.RPC_BASIC_AUTH_USER,
			password: process.env.RPC_BASIC_AUTH_PASSWORD,
		} : undefined,
	};
}

// Validate configuration
function validateConfig(config: Config): void {
	const logger = loggers.cli;
	const errors: string[] = [];

	if (!config.rpcUrl) {
		errors.push('ETH_RPC_URL is required');
	}

	if (!config.privateKey || !config.privateKey.startsWith('0x')) {
		errors.push('PRIVATE_KEY is required and must start with 0x');
	}

	if (!config.forwarderAddress || !config.forwarderAddress.startsWith('0x')) {
		errors.push('ERC2771_FORWARDER_ADDRESS is required and must start with 0x');
	}

	if (errors.length > 0) {
		logger.error('Configuration errors:');
		errors.forEach(error => logger.error(`  - ${error}`));
		logger.error('\nYou can provide configuration via:');
		logger.error('  1. Environment variables: ETH_RPC_URL, PRIVATE_KEY, ERC2771_FORWARDER_ADDRESS');
		logger.error('  2. Configuration file: relayer.config.json in the current directory');
		process.exit(1);
	}
}

// CORS headers
const corsHeaders = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

// Main server function
async function startServer() {
	const logger = loggers.cli;
	
	// Log configuration on startup
	logConfiguration();
	
	const config = loadConfig();
	validateConfig(config);

	// Create RelayerService instance
	const relayerConfig: RelayerConfig = {
		rpcUrl: config.rpcUrl,
		privateKey: config.privateKey,
		forwarderAddress: config.forwarderAddress,
		basicAuth: config.basicAuth,
	};

	const relayer = new RelayerService(relayerConfig);

	// Create HTTP server
	const server = createServer(async (req, res) => {
		const requestId = Math.random().toString(36).substring(7);
		const requestLogger = logger.child({ requestId, method: req.method, url: req.url });
		
		// Handle CORS preflight
		if (req.method === 'OPTIONS') {
			requestLogger.debug('Handling CORS preflight');
			res.writeHead(200, corsHeaders);
			res.end();
			return;
		}

		// Only accept POST requests
		if (req.method !== 'POST') {
			requestLogger.warn('Method not allowed');
			res.writeHead(405, corsHeaders);
			res.end(JSON.stringify({ error: 'Method not allowed' }));
			return;
		}

		// Parse request body
		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			try {
				const request = JSON.parse(body) as RelayRequest;
				requestLogger.info('Received relay request', {
					from: request.from,
					to: request.to,
					value: request.value?.toString(),
					gas: request.gas?.toString()
				});
				
				// Process the relay request
				const result = await relayer.relay(request);

				// Send response
				if ('error' in result) {
					const status = result.errorType === 'validation' ? 400 : 
					               result.errorType === 'network' ? 503 : 500;
					requestLogger.error('Request failed', {
						status,
						error: result.error,
						errorType: result.errorType
					});
					res.writeHead(status, corsHeaders);
				} else {
					requestLogger.info('Request successful', {
						transactionHash: result.transactionHash
					});
					res.writeHead(200, corsHeaders);
				}
				
				res.end(JSON.stringify(result));
			} catch (error) {
				requestLogger.error('Request processing error', { error });
				res.writeHead(400, corsHeaders);
				res.end(JSON.stringify({ error: 'Invalid request format' }));
			}
		});
	});

	// Start listening
	server.listen(config.port, () => {
		logger.info('🚀 Relayer service started', {
			port: config.port,
			rpcUrl: config.rpcUrl,
			forwarderAddress: config.forwarderAddress,
			hasBasicAuth: !!config.basicAuth
		});
	});

	// Handle graceful shutdown
	process.on('SIGINT', () => {
		logger.info('⏹️  Shutting down gracefully...');
		server.close(() => {
			logger.info('✅ Server closed');
			process.exit(0);
		});
	});
}

// Start the server
startServer().catch(error => {
	loggers.cli.fatal('Failed to start server', { error });
	process.exit(1);
});