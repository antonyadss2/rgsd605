
export interface ProxyData {
  type: 'socks5' | 'https';
  apiKey: string;
  results: string[];
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
}
