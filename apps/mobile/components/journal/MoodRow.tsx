import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Mood } from "../../utils/journalUtils";
import { useAppTheme } from "../../hooks/useAppTheme";

type MoodRowProps = {
  selectedMood: Mood | null;
  onMoodSelect: (mood: Mood) => void;
};

const MOODS: Mood[] = ["good", "okay", "difficult", "crisis"];

export function MoodRow({ selectedMood, onMoodSelect }: MoodRowProps) {
  const { colors, spacing, radii } = useAppTheme();

  const MOOD_DISPLAY = {
    good: "Good",
    okay: "Okay",
    difficult: "Difficult",
    crisis: "Crisis",
  } as const;

  const styles = StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    scroll: {
      flexDirection: "row",
      gap: spacing.md,
    },
    button: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderNeutral,
      backgroundColor: colors.surfaceSubtle,
    },
    buttonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySubtle,
    },
    text: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    textSelected: {
      color: colors.primary,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood;
          return (
            <TouchableOpacity
              key={mood}
              style={[styles.button, isSelected && styles.buttonSelected]}
              onPress={() => onMoodSelect(mood)}
              accessibilityRole="button"
              accessibilityLabel={`${MOOD_DISPLAY[mood]} mood`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[styles.text, isSelected && styles.textSelected]}
              >
                {MOOD_DISPLAY[mood]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
