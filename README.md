# Ready Aim Fire Relayer

## Description
This project is a Cloudflare Worker designed to forward ERC-2771 transactions to an OpenZeppelin ERC2771Forwarder smart contract. It uses viem to interact with the Ethereum blockchain and handles transaction signing and sending.

## Intent
The intent of this project is to provide a secure and efficient way to relay transactions using the ERC-2771 standard, ensuring that transactions are properly signed and executed on the blockchain.

## Usage Example
To use this worker, send a POST request with the following JSON body:

```json
{
  "from": "0x...", // The address of the sender.
  "to": "0x...", // The address of the recipient or contract.
  "data": "0x...", // The encoded function call data.
  "value": 1000000000000000000n, // The amount of ETH to send with the transaction.
  "gas": 21000n, // The gas limit for the transaction.
  "deadline": 1234567890n, // The deadline for the transaction to be executed.
  "signature": "0x..." // The signature of the transaction.
}
```

### Response
The worker will return a JSON response with the transaction hash:

```json
{
  "transactionHash": "0x..." // The hash of the sent transaction.
}
```

### Error Handling
If the transaction fails, the worker will return an error message:

```json
{
  "error": "Transaction reverted: ..." // The error message if the transaction fails.
}
```

## API Documentation
- **Endpoint**: `POST /`
- **Request Body**: JSON object containing transaction details.
- **Response**: JSON object containing the transaction hash or an error message.
- **Environment Variables for Deployment**:
  - `ETH_RPC_URL`: The URL of the Ethereum RPC provider.
  - `PRIVATE_KEY`: The private key used to sign transactions. 