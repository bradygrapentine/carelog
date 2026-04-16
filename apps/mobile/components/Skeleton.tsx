import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View, StyleSheet } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
};

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
}: SkeletonProps) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.6);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceSubtle,
          opacity,
        },
      ]}
    />
  );
}

export function SkeletonRow() {
  const styles = StyleSheet.create({
    row: {
      paddingVertical: 12,
      gap: 8,
    },
  });

  return (
    <View style={styles.row}>
      {/* Title line */}
      <Skeleton width="60%" height={16} borderRadius={4} />
      {/* Body line 1 */}
      <Skeleton width="100%" height={13} borderRadius={4} />
      {/* Body line 2 */}
      <Skeleton width="80%" height={13} borderRadius={4} />
    </View>
  );
}
