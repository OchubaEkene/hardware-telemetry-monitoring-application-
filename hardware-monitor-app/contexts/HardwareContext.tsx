import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { telemetryDB } from '@/lib/db';
import { hardwareClient } from '@/lib/hardware-client';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface HardwareContextValue {
  connectionStatus: ConnectionStatus;
  agentHost: string | null;
  saveAndConnect: (host: string) => Promise<void>;
  disconnect: () => void;
}

const STORE_KEY = 'hardware_agent_host';

const HardwareContext = createContext<HardwareContextValue | undefined>(undefined);

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [agentHost, setAgentHost] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const savedHost = await SecureStore.getItemAsync(STORE_KEY);
      if (!mounted) return;

      if (savedHost) {
        setAgentHost(savedHost);
        await telemetryDB.init();
        hardwareClient.connect(savedHost, {
          onStatusChange: (status) => {
            if (mounted) setConnectionStatus(status);
          },
        });
      } else {
        await telemetryDB.initWithSyntheticData();
      }
    };

    bootstrap().catch(console.error);

    return () => {
      mounted = false;
      hardwareClient.disconnect();
      telemetryDB.destroy();
    };
  }, []);

  const saveAndConnect = async (host: string) => {
    await SecureStore.setItemAsync(STORE_KEY, host);
    setAgentHost(host);
    hardwareClient.disconnect();
    hardwareClient.connect(host, {
      onStatusChange: (status) => setConnectionStatus(status),
    });
  };

  const disconnect = () => {
    hardwareClient.disconnect();
    setConnectionStatus('disconnected');
    setAgentHost(null);
    SecureStore.deleteItemAsync(STORE_KEY).catch(console.error);
  };

  return (
    <HardwareContext.Provider value={{ connectionStatus, agentHost, saveAndConnect, disconnect }}>
      {children}
    </HardwareContext.Provider>
  );
}

export function useHardware(): HardwareContextValue {
  const context = useContext(HardwareContext);
  if (!context) {
    throw new Error('useHardware must be used within HardwareProvider');
  }
  return context;
}
