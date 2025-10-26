// contexts/ModalContext.tsx
import React, { createContext, useContext } from "react";
import { Alert } from "react-native";

type ModalType = "dialog" | "alert";

interface ModalConfig {
  type: ModalType;
  title: string;
  description?: string;
  content?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ModalContextValue {
  showModal: (config: ModalConfig) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const showModal = (config: ModalConfig) => {
    Alert.alert(
      config.title,
      config.description,
      [
        {
          text: config.cancelText || "Cancel",
          style: "cancel",
          onPress: config.onCancel,
        },
        ...(config.onConfirm ? [{
          text: config.confirmText || "Confirm",
          onPress: config.onConfirm,
        }] : []),
      ]
    );
  };

  const hideModal = () => {
    // React Native Alert doesn't need explicit hiding
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
};
