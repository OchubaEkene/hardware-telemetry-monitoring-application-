import React from "react";
import { Alert } from "react-native";

export default function CustomAlert({
  title,
  description,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm?: () => void;
}) {
  const showAlert = () => {
    Alert.alert(
      title,
      description,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: onCancel,
        },
        ...(onConfirm ? [{
          text: "Confirm",
          onPress: onConfirm,
        }] : []),
      ]
    );
  };

  // This component doesn't render anything directly
  // It's used to trigger alerts programmatically
  return null;
}