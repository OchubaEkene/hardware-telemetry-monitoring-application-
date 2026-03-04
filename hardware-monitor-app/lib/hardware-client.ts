import { telemetryDB, TelemetryLog } from './db';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ClientOptions {
  onStatusChange: (status: ConnectionStatus) => void;
}

class HardwareClient {
  private ws: WebSocket | null = null;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxAttempts = 10;
  private readonly maxBackoff = 30000;
  private options: ClientOptions | null = null;
  private host: string | null = null;

  connect(host: string, options: ClientOptions): void {
    this.host = host;
    this.options = options;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this._open();
  }

  private _open(): void {
    if (!this.host || !this.options) return;
    this.options.onStatusChange('connecting');

    const url = `ws://${this.host}:8765`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options?.onStatusChange('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (
          typeof data.timestamp === 'number' &&
          typeof data.gpu_temp === 'number' &&
          typeof data.cpu_temp === 'number' &&
          typeof data.fan_rpm === 'number' &&
          typeof data.power_draw === 'number'
        ) {
          const log: TelemetryLog = {
            timestamp: data.timestamp,
            gpu_temp: data.gpu_temp,
            cpu_temp: data.cpu_temp,
            fan_rpm: data.fan_rpm,
            power_draw: data.power_draw,
          };
          telemetryDB.insertTelemetry(log);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      this.options?.onStatusChange('error');
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.shouldReconnect && this.reconnectAttempts < this.maxAttempts) {
        this.options?.onStatusChange('error');
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxBackoff);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this._open(), delay);
      } else if (!this.shouldReconnect) {
        this.options?.onStatusChange('disconnected');
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.host = null;
    this.options = null;
    this.reconnectAttempts = 0;
  }
}

export const hardwareClient = new HardwareClient();
