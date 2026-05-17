import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { fetchVoicePreview } from "../api";
import { Theme, useTheme } from "../theme";

export const VOICES = [
  { id: "nova", label: "Nova", description: "Bright, friendly" },
  { id: "shimmer", label: "Shimmer", description: "Soft, gentle" },
  { id: "echo", label: "Echo", description: "Warm, conversational" },
  { id: "onyx", label: "Onyx", description: "Deep, authoritative" },
  { id: "alloy", label: "Alloy", description: "Neutral, balanced" },
  { id: "fable", label: "Fable", description: "British, narrative" },
] as const;

interface Props {
  value: string;
  onChange: (voice: string) => void;
}

export function VoicePicker({ value, onChange }: Props) {
  const theme = useTheme();
  const styles = useStyles(theme);

  const soundRef = useRef<Audio.Sound | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, []);

  const selectedDescription = useMemo(
    () => VOICES.find((v) => v.id === value)?.description ?? "",
    [value],
  );

  async function selectAndPreview(voiceId: string) {
    onChange(voiceId);

    // Stop any previous preview
    const prev = soundRef.current;
    soundRef.current = null;
    if (prev) {
      try {
        await prev.unloadAsync();
      } catch {}
    }
    setPlayingId(null);

    setLoadingId(voiceId);
    try {
      const url = await fetchVoicePreview(voiceId);

      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlayingId((current) => (current === voiceId ? null : current));
          }
        },
      );
      soundRef.current = sound;
      setLoadingId(null);
      setPlayingId(voiceId);
    } catch {
      setLoadingId(null);
      setPlayingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Voice</Text>
        <Text style={styles.description}>{selectedDescription}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {VOICES.map((voice) => {
          const isSelected = voice.id === value;
          const isLoading = loadingId === voice.id;
          const isPlaying = playingId === voice.id;

          return (
            <Pressable
              key={voice.id}
              onPress={() => selectAndPreview(voice.id)}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
              accessibilityLabel={`${voice.label} voice, ${voice.description}`}
            >
              <View style={styles.chipIcon}>
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isSelected ? theme.accentOn : theme.accent}
                  />
                ) : (
                  <Ionicons
                    name={
                      isPlaying
                        ? "volume-high"
                        : isSelected
                          ? "checkmark"
                          : "play"
                    }
                    size={14}
                    color={isSelected ? theme.accentOn : theme.accent}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {voice.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 8,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        },
        label: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        },
        description: {
          fontSize: 12,
          color: theme.textDim,
          fontStyle: "italic",
        },
        row: {
          flexDirection: "row",
          gap: 8,
          paddingVertical: 2,
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bgElevated,
        },
        chipSelected: {
          backgroundColor: theme.accent,
          borderColor: theme.accent,
        },
        chipPressed: {
          opacity: 0.75,
        },
        chipIcon: {
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
        },
        chipText: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.text,
        },
        chipTextSelected: {
          color: theme.accentOn,
        },
      }),
    [theme],
  );
}
