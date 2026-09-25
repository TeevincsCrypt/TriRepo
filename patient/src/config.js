const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxInvoiceItems: parseInt(process.env.MAX_INVOICE_ITEMS, 10) || 50,
  currency: process.env.INVOICE_CURRENCY || 'USD',
  apiKey: process.env.API_KEY || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
export const { port, host, apiPrefix, logLevel, maxInvoiceItems, currency, apiKey, nodeEnv } = config;
