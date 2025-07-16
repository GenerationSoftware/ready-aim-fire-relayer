import pino from 'pino';

// Define operator types
export enum Operator {
  CLI = 'cli',
  RELAYER = 'relayer',
  DECODE = 'decode',
  ERROR_HANDLER = 'error-handler',
  FORWARDER = 'forwarder',
  TRANSACTION = 'transaction',
}

// Get log level from environment variable
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Get enabled operators from environment variable (comma-separated list)
// If not set, all operators are enabled
const ENABLED_OPERATORS = process.env.LOG_OPERATORS 
  ? process.env.LOG_OPERATORS.split(',').map(op => op.trim().toLowerCase())
  : null;

// Check if pretty printing is enabled (default: true in development)
const PRETTY_PRINT = process.env.LOG_PRETTY !== 'false';

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  base: {
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Add pretty printing in development
const transport = PRETTY_PRINT
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
        messageFormat: '{operator} | {msg}',
      },
    }
  : undefined;

// Create the base logger
const baseLogger = pino({
  ...baseConfig,
  ...(transport && { transport }),
});

// Create a logger factory that checks if the operator is enabled
export function createLogger(operator: Operator): pino.Logger {
  // Check if this operator's logs are enabled
  const isEnabled = 
    ENABLED_OPERATORS === null || 
    ENABLED_OPERATORS.includes(operator.toLowerCase());

  // Create a child logger with the operator context
  const logger = baseLogger.child({ operator });

  // If operator is disabled, set level to 'silent'
  if (!isEnabled) {
    logger.level = 'silent';
  }

  return logger;
}

// Export a type-safe logger factory
export interface LoggerFactory {
  cli: pino.Logger;
  relayer: pino.Logger;
  decode: pino.Logger;
  errorHandler: pino.Logger;
  forwarder: pino.Logger;
  transaction: pino.Logger;
}

// Create pre-configured loggers for each operator
export const loggers: LoggerFactory = {
  cli: createLogger(Operator.CLI),
  relayer: createLogger(Operator.RELAYER),
  decode: createLogger(Operator.DECODE),
  errorHandler: createLogger(Operator.ERROR_HANDLER),
  forwarder: createLogger(Operator.FORWARDER),
  transaction: createLogger(Operator.TRANSACTION),
};

// Helper function to log configuration on startup
export function logConfiguration(): void {
  const configLogger = createLogger(Operator.CLI);
  configLogger.info('Logger configuration:', {
    level: LOG_LEVEL,
    prettyPrint: PRETTY_PRINT,
    enabledOperators: ENABLED_OPERATORS || 'all',
  });
}