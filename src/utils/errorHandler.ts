import {
  type Abi,
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  RpcRequestError,
  HttpRequestError,
} from 'viem';
import { decodeError } from './decode.js';
import { loggers } from './logger.js';

export interface UnifiedError {
  type: 'contract' | 'rpc' | 'network' | 'validation' | 'unknown';
  message: string;
  code?: string | number;
  details?: {
    selector?: string;
    data?: string;
    decodedError?: any;
    nestedErrors?: UnifiedError[];
    transactionRequest?: any;
    rpcError?: {
      code: number;
      message: string;
      data?: any;
    };
  };
  originalError?: any;
}

export class ErrorHandler {
  private abis: Abi[];
  private logger = loggers.errorHandler;

  constructor(abis: Abi[]) {
    this.abis = abis;
  }

  public handleError(error: unknown): UnifiedError {
    
    // Log detailed error information for debugging
    if (error instanceof BaseError) {
      // console.log('BaseError details:');
      // console.log('- shortMessage:', error.shortMessage);
      // console.log('- message:', error.message);
      // console.log('- cause:', error.cause);
      
      // Walk and log all errors in the chain
      // let current = error;
      // let depth = 0;
      // while (current && depth < 10) {
      //   console.log(`Error chain [${depth}]:`, {
      //     name: current.constructor.name,
      //     message: current.message,
      //     shortMessage: (current as any).shortMessage,
      //     data: (current as any).data,
      //     code: (current as any).code
      //   });
      //   current = current.cause as any;
      //   depth++;
      // }
      
      return this.handleViemError(error);
    }
    
    // Handle standard Error types
    if (error instanceof Error) {
      return this.handleStandardError(error);
    }
    
    // Handle unknown errors
    return {
      type: 'unknown',
      message: String(error),
      originalError: error
    };
  }

  private handleViemError(error: BaseError): UnifiedError {
    const unifiedError: UnifiedError = {
      type: 'unknown',
      message: error.shortMessage || error.message,
      originalError: error
    };

    // Walk the error chain to find specific error types
    const rpcError = error.walk(e => e instanceof RpcRequestError) as RpcRequestError | undefined;
    const contractError = error.walk(e => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined;
    const executionError = error.walk(e => e instanceof ExecutionRevertedError) as ExecutionRevertedError | undefined;
    const httpError = error.walk(e => e instanceof HttpRequestError) as HttpRequestError | undefined;
    
    // Also look for any error in the chain that has revert data
    const errorWithData = error.walk(e => (e as any).data && typeof (e as any).data === 'string' && (e as any).data.startsWith('0x')) as any;

    // Handle network/HTTP errors
    if (httpError) {
      return {
        type: 'network',
        message: 'Network request failed',
        code: httpError.status,
        details: {
          rpcError: {
            code: httpError.status || 0,
            message: httpError.message
          }
        },
        originalError: error
      };
    }

    // Handle RPC errors
    if (rpcError) {
      // Check if RPC error contains revert data
      let decodedRevert = null;
      let revertData = null;
      
      // Look for revert data in various places
      if (rpcError.data) {
        if (typeof rpcError.data === 'string' && rpcError.data.startsWith('0x')) {
          revertData = rpcError.data as `0x${string}`;
          
          // Check if this is a wrapped error (like FailedCallWithMessage)
          // The data might be ABI-encoded with the actual error nested inside
          if (revertData.length > 138) { // Has enough data for wrapped structure
            try {
              const decoded = decodeError(revertData as `0x${string}`);
              if (decoded && decoded.args && decoded.args.length > 0) {
                // Look for nested error data in the args
                for (const arg of decoded.args) {
                  if (typeof arg === 'string' && arg.startsWith('0x') && arg.length >= 10) {
                    // Try to decode this as the actual revert data
                    const nestedDecoded = decodeError(arg as `0x${string}`);
                    if (nestedDecoded) {
                      this.logger.debug('Found nested error', { nestedDecoded });
                      decodedRevert = nestedDecoded;
                      revertData = arg;
                      break;
                    }
                  }
                }
              }
            } catch (e) {
              this.logger.debug('Could not decode wrapped error, trying direct decode');
            }
          }
        } else if (typeof rpcError.data === 'object' && rpcError.data && 'data' in rpcError.data) {
          revertData = (rpcError.data as any).data as `0x${string}`;
        }
      }
      
      // Try to decode the revert data if found
      if (revertData && revertData.length > 2) {
        try {
          const decoded = decodeError(revertData as `0x${string}`);
          if (decoded) {
            this.logger.debug('Successfully decoded outer error', { decoded });
            
            // Check if this is a wrapper error like FailedCallWithMessage
            if (decoded.errorName === 'FailedCallWithMessage' && decoded.args && decoded.args.length > 0) {
              // console.log('Found FailedCallWithMessage, extracting inner error...');
              
              // The first argument should contain the inner error data
              const innerErrorData = decoded.args[0];
              if (typeof innerErrorData === 'string' && innerErrorData.startsWith('0x')) {
                try {
                  const innerDecoded = decodeError(innerErrorData as `0x${string}`);
                  if (innerDecoded) {
                    // console.log('Successfully decoded inner error:', innerDecoded);
                    decodedRevert = innerDecoded; // Use the inner error as the main error
                    // Keep the original data but note it was nested
                  } else {
                    // console.log('Inner error data could not be decoded:', innerErrorData);
                    decodedRevert = decoded; // Fall back to outer error
                  }
                } catch (innerError) {
                  // console.log('Failed to decode inner error:', innerError);
                  decodedRevert = decoded; // Fall back to outer error
                }
              } else {
                // console.log('FailedCallWithMessage args not in expected format:', decoded.args);
                decodedRevert = decoded;
              }
            } else {
              // Not a wrapper error, use as-is
              decodedRevert = decoded;
            }
          }
        } catch (e) {
          console.error('Could not decode revert data:', revertData, e);
        }
      }
      
      // If we found revert data, treat as contract error
      if (decodedRevert) {
        const errorMessage = decodedRevert.errorName || 'Unknown contract error';
        const errorArgs = decodedRevert.args || [];
        
        // Create a more detailed message if there are args
        let detailedMessage = `Transaction reverted: ${errorMessage}`;
        if (errorArgs.length > 0) {
          detailedMessage += ` (${errorArgs.join(', ')})`;
        }
        
        return {
          type: 'contract',
          message: detailedMessage,
          details: {
            selector: revertData!.slice(0, 10),
            data: revertData || undefined,
            decodedError: decodedRevert,
            rpcError: {
              code: rpcError.code,
              message: rpcError.message,
              data: rpcError.data
            }
          },
          originalError: error
        };
      }
      
      return {
        type: 'rpc',
        message: rpcError.shortMessage || 'RPC request failed',
        code: rpcError.code,
        details: {
          rpcError: {
            code: rpcError.code,
            message: rpcError.message,
            data: rpcError.data
          }
        },
        originalError: error
      };
    }

    // Handle contract revert errors
    if (contractError) {
      const decoded = this.decodeContractError(contractError);
      return {
        type: 'contract',
        message: decoded.message,
        details: {
          selector: decoded.selector,
          data: decoded.data,
          decodedError: decoded.decodedError,
          nestedErrors: decoded.nestedErrors
        },
        originalError: error
      };
    }

    // Handle execution reverted errors
    if (executionError) {
      const decoded = this.decodeExecutionError(executionError);
      return {
        type: 'contract',
        message: decoded.message,
        details: decoded.details,
        originalError: error
      };
    }
    
    // Handle any error with revert data that we haven't caught yet
    if (errorWithData?.data) {
      try {
        const decoded = decodeError(errorWithData.data);
        if (decoded) {
          return {
            type: 'contract',
            message: `Transaction reverted: ${decoded.errorName}`,
            details: {
              selector: errorWithData.data.slice(0, 10),
              data: errorWithData.data,
              decodedError: decoded
            },
            originalError: error
          };
        }
      } catch (e) {
        console.log('Could not decode error data from error chain:', errorWithData.data);
      }
    }

    return unifiedError;
  }

  private decodeContractError(error: ContractFunctionRevertedError): {
    message: string;
    selector?: string;
    data?: string;
    decodedError?: any;
    nestedErrors?: UnifiedError[];
  } {
    // First, try to use the built-in reason if available
    if (error.reason) {
      return { message: `Contract reverted: ${error.reason}` };
    }

    // If we have error data, try to decode it
    if (error.data) {
      const errorData = (typeof error.data === 'string' ? error.data : JSON.stringify(error.data)) as `0x${string}`;
      const decoded = decodeError(errorData);
      if (decoded) {
        // Handle nested errors (like FailedCallWithMessage)
        if (decoded.errorName === 'FailedCallWithMessage' && decoded.args?.[0]) {
          const nestedDecoded = decodeError(decoded.args[0] as `0x${string}`);
          if (nestedDecoded) {
            return {
              message: `Contract reverted: ${nestedDecoded.errorName}`,
              selector: errorData.slice(0, 10),
              data: errorData,
              decodedError: decoded,
              nestedErrors: [{
                type: 'contract',
                message: nestedDecoded.errorName || 'Unknown nested error',
                details: {
                  decodedError: nestedDecoded
                }
              }]
            };
          }
        }
        
        return {
          message: `Contract reverted: ${decoded.errorName}`,
          selector: errorData.slice(0, 10),
          data: errorData,
          decodedError: decoded
        };
      }
    }

    return { message: 'Contract reverted with unknown error' };
  }

  private decodeExecutionError(error: ExecutionRevertedError): {
    message: string;
    details?: any;
  } {
    // Try to extract revert data from the error
    let revertData: `0x${string}` | undefined;
    
    // Walk the error chain to find data
    const errorWithData = error.walk(e => (e as any).data) as any;
    if (errorWithData?.data) {
      revertData = errorWithData.data;
    }
    
    if (revertData) {
      const decoded = decodeError(revertData);
      if (decoded) {
        return {
          message: `Execution reverted: ${decoded.errorName}`,
          details: {
            selector: revertData.slice(0, 10),
            data: revertData,
            decodedError: decoded
          }
        };
      }
    }

    return { message: error.message || 'Execution reverted' };
  }

  private handleStandardError(error: Error): UnifiedError {
    // Check if it's a network-related error
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        type: 'network',
        message: 'Network connection failed',
        originalError: error
      };
    }

    // Check if it's a validation error
    if (error.message.includes('Missing required fields') || error.message.includes('Invalid')) {
      return {
        type: 'validation',
        message: error.message,
        originalError: error
      };
    }

    return {
      type: 'unknown',
      message: error.message,
      originalError: error
    };
  }
}