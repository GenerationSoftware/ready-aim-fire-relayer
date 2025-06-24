# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker that acts as an ERC-2771 transaction relayer for the Battle game. It forwards transactions to an OpenZeppelin ERC2771Forwarder smart contract and handles transaction signing and execution on the blockchain.

## Key Architecture

### Core Components
- **Main Handler** (`src/index.ts`): Single entry point that processes POST requests with transaction data
- **Decode Utilities** (`src/utils/decode.ts`): Functions to decode function calls and errors from blockchain data using multiple ABIs
- **Signing Utilities** (`src/utils/signForwardRequest.ts`): EIP-712 typed data signing for ERC-2771 forward requests
- **ABI Definitions** (`src/abi/`): JSON ABI files for all smart contracts (ReadyAimFire, Factory, Forwarder, etc.)

### Transaction Flow
1. Receives POST request with transaction parameters (from, to, data, value, gas, deadline, signature)
2. Decodes and logs the incoming call data for debugging
3. Routes to either Factory contract directly or wraps in ERC2771Forwarder.execute() call
4. Signs and sends transaction using the worker's private key
5. Returns transaction hash or decoded error messages

### Error Handling
- Sophisticated error decoding that matches error selectors to ABI definitions
- Special handling for `FailedCallWithMessage` errors with nested error decoding
- Extracts meaningful error messages from blockchain revert data

## Development Commands

```bash
# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy

# Run tests
npm test

# Run test script
npm run test:script
```

## Testing

- Uses Vitest with miniflare environment for Cloudflare Worker testing
- Test files in `test/` directory
- Main test file: `test/decode.spec.ts` for testing call data decoding functionality

## Environment Variables

Required environment variables for deployment:
- `ETH_RPC_URL`: Ethereum RPC endpoint URL
- `PRIVATE_KEY`: Private key for signing transactions
- `ERC2771_FORWARDER_ADDRESS`: Address of the ERC2771Forwarder contract

## Request Format

The worker expects POST requests with JSON body containing:
```typescript
{
  from: `0x${string}`;        // Sender address
  to: `0x${string}`;          // Target contract address
  data: `0x${string}`;        // Encoded function call data
  value: bigint;              // ETH value to send
  gas: bigint;                // Gas limit
  deadline: bigint;           // Transaction deadline
  signature: `0x${string}`;   // ERC-2771 signature
}
```

## Smart Contract Integration

The relayer works with multiple smart contracts:
- **Battle**: Main game contract
- **BattleFactory**: Factory for creating game instances  
- **ERC2771Forwarder**: OpenZeppelin meta-transaction forwarder
- **BasicDeck/BasicDeckLogic**: Deck management contracts
- **Minter**: NFT minting functionality

All ABIs are combined in decode utilities for comprehensive error and function decoding.