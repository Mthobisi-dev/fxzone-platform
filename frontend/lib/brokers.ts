export const DEFAULT_BROKER = 'Exness';

const BROKER_URLS: Record<string, string> = {
  exness: 'https://www.exness.com/',
  'ic markets': 'https://www.icmarkets.com/',
  pepperstone: 'https://pepperstone.com/',
  'xm group': 'https://www.xm.com/',
  deriv: 'https://deriv.com/',
  'fxtm (forextime)': 'https://www.fxtm.com/',
  'interactive brokers': 'https://www.interactivebrokers.com/',
  oanda: 'https://www.oanda.com/',
};

export function getBrokerDestination(preferredBroker?: string | null) {
  const requestedName = preferredBroker?.trim() || DEFAULT_BROKER;
  const url = BROKER_URLS[requestedName.toLowerCase()];
  return {
    name: url ? requestedName : DEFAULT_BROKER,
    url: url || BROKER_URLS.exness,
  };
}
