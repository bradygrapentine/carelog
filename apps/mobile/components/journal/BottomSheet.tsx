import { useState, useEffect } from "react";
import {
  View,
  Modal,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export function BottomSheet({
  visible,
  onClose,
  children,
  title,
}: BottomSheetProps) {
  const { colors, spacing } = useAppTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = height * 0.7; // 70% of screen height

  const slideAnim = useState(new Animated.Value(sheetHeight))[0];
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 40,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: sheetHeight,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible, slideAnim, sheetHeight]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, { dy }) => Math.abs(dy) > 10,
    onPanResponderMove: (evt, { dy }) => {
      if (dy > 0) {
        slideAnim.setValue(dy);
      }
    },
    onPanResponderRelease: (evt, { dy, vy }) => {
      if (dy > sheetHeight * 0.3 || vy > 0.5) {
        onClose();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start();
      }
    },
  });

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
          }}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: sheetHeight,
          backgroundColor: colors.surfaceRaised,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          transform: [{ translateY: slideAnim }],
          paddingTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        }}
      >
        {/* Drag handle */}
        <View
          style={{
            width: 40,
            height: 4,
            backgroundColor: colors.borderNeutral,
            borderRadius: 2,
            alignSelf: "center",
            marginBottom: spacing.md,
          }}
        />

        {/* Content */}
        <View style={{ flex: 1, gap: spacing.md }}>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}
