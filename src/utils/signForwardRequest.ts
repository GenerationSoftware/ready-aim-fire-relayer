import { WalletClient, Address, Hash, Account, PublicClient, type Abi } from 'viem';
import ERC2771ForwarderABIJson from '../contracts/abis/ERC2771Forwarder.json' assert { type: 'json' };
const ERC2771ForwarderABI = ERC2771ForwarderABIJson as Abi;

export interface ForwardRequestData {
	from: Address;
	to: Address;
	value: bigint;
	gas: bigint;
	nonce: bigint;
	deadline: bigint;
	data: Hash;
	signature: Hash;
}

export async function signForwardRequest(
	walletClient: WalletClient,
	publicClient: PublicClient,
	forwarderAddress: Address,
	request: Omit<ForwardRequestData, 'signature'>,
	account: Account
): Promise<Hash> {
	const domainResult = await publicClient.readContract({
		address: forwarderAddress,
		abi: ERC2771ForwarderABI,
		functionName: 'eip712Domain',
	}) as any;
	
	const [fields, name, version, chainId, verifyingContract, salt] = domainResult;

	const domain = {
		name,
		version,
		chainId,
		verifyingContract
	};

	console.log("DOMAIN", domain);	

	/*
	expected domain: 
	
	{
		name: 'ERC2771Forwarder',
		version: '1',
		chainId: 31337n,
		verifyingContract: '0xc4Fe39a1588807CfF8d8897050c39F065eBAb0B8'
	}
		*/

	const types = {
		ForwardRequest: [
			{ name: 'from', type: 'address' },
			{ name: 'to', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'gas', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint48' },
			{ name: 'data', type: 'bytes' },
		],
	};

	// @ts-ignore
	const signature = await walletClient.signTypedData({
		domain,
		types,
		primaryType: 'ForwardRequest',
		message: request
	});

	return signature;
} 