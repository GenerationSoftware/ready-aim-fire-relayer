# Relayer CLI Mode

This relayer has been refactored to support both Cloudflare Workers and standalone Node.js CLI modes.

## Architecture Changes

### Directory Structure
```
src/
├── index.ts                 # Node.js CLI entry point
├── cloudflare/
│   └── index.ts            # Cloudflare Worker entry point
├── services/
│   └── RelayerService.ts   # Core business logic (platform-agnostic)
├── utils/                  # Shared utilities
├── contracts/              # ABIs and deployments
└── allAbis.ts             # ABI aggregation
```

### Key Changes

1. **Decoupled Architecture**: Core business logic has been extracted into `RelayerService` class that works in both environments
2. **Separate Entry Points**: 
   - `src/index.ts` - Node.js CLI server
   - `src/cloudflare/index.ts` - Cloudflare Worker handler
3. **Configuration Management**: Node.js mode supports both environment variables and config files

## Running as Node.js CLI

### Configuration

You can configure the relayer using either:

1. **Environment Variables**:
   ```bash
   export ETH_RPC_URL="https://your-rpc-url"
   export PRIVATE_KEY="0xYourPrivateKey"
   export ERC2771_FORWARDER_ADDRESS="0xForwarderAddress"
   export RPC_BASIC_AUTH_USER="username"  # Optional
   export RPC_BASIC_AUTH_PASSWORD="password"  # Optional
   export PORT=3000  # Optional, defaults to 3000
   
   # Logging configuration
   export LOG_LEVEL="info"  # Options: trace, debug, info, warn, error, fatal (default: info)
   export LOG_PRETTY="true"  # Pretty print logs (default: true)
   export LOG_OPERATORS="cli,relayer,transaction"  # Comma-separated list of operators to enable (default: all)
   ```

2. **Configuration File** (`relayer.config.json`):
   ```json
   {
     "port": 3000,
     "rpcUrl": "https://your-ethereum-rpc-url.com",
     "privateKey": "0xYourPrivateKeyHere",
     "forwarderAddress": "0xYourERC2771ForwarderAddressHere",
     "basicAuth": {
       "username": "your-username",
       "password": "your-password"
     }
   }
   ```

### Logging

The relayer uses [pino](https://github.com/pinojs/pino) for structured logging with operator-based filtering.

#### Log Levels

Set the log level using the `LOG_LEVEL` environment variable:
- `trace`: Very detailed debugging information
- `debug`: Debugging information
- `info`: General information (default)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal errors that cause the application to exit

#### Operator Filtering

Control which components log messages using the `LOG_OPERATORS` environment variable. Available operators:
- `cli`: Main CLI server operations
- `relayer`: RelayerService operations
- `decode`: Call data and error decoding
- `error-handler`: Error handling and processing
- `forwarder`: ERC2771 forwarder operations
- `transaction`: Transaction sending and monitoring

Examples:
```bash
# Only show logs from CLI and relayer operators
export LOG_OPERATORS="cli,relayer"

# Show all logs except decode operations
export LOG_OPERATORS="cli,relayer,error-handler,forwarder,transaction"

# Disable pretty printing for production
export LOG_PRETTY="false"
```

### Running the Server

```bash
# Development mode with auto-reload
npm run start:dev

# Production mode
npm run start

# Build and run compiled JavaScript
npm run build
npm run relayer
```

### API Usage

The CLI server exposes the same API as the Cloudflare Worker:

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x...",
    "to": "0x...",
    "data": "0x...",
    "value": "1000000000000000000",
    "gas": "21000",
    "deadline": "1234567890",
    "signature": "0x..."
  }'
```

## Running as Cloudflare Worker

The Cloudflare Worker mode continues to work as before:

```bash
# Development
npm run dev

# Deploy
npm run deploy
```

## Package.json Scripts

- `npm run dev` - Run Cloudflare Worker in development
- `npm run deploy` - Deploy to Cloudflare
- `npm run start` - Run Node.js CLI server
- `npm run start:dev` - Run Node.js CLI server with auto-reload
- `npm run build` - Build Node.js version
- `npm run relayer` - Run compiled Node.js server
- `npm test` - Run tests

## TypeScript Configuration

Two TypeScript configurations are used:
- `tsconfig.json` - For Cloudflare Worker (ES modules, no emit)
- `tsconfig.node.json` - For Node.js CLI (CommonJS output to dist/)

## Notes

- The core `RelayerService` class is platform-agnostic and can be used in any JavaScript environment
- Both modes share the same business logic, utilities, and contract ABIs
- The Cloudflare-specific code is isolated in `src/cloudflare/`
- The Node.js CLI provides graceful shutdown handling with SIGINT