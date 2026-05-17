import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";

interface Props {
  audioUrl: string;
}

export function PodcastPlayer({ audioUrl }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setError(null);

    (async () => {
      try {
        if (Platform.OS !== "web") {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          onPlaybackStatus,
        );

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load audio");
        }
      }
    })();

    return () => {
      cancelled = true;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, [audioUrl]);

  function onPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }

  async function toggle() {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={toggle}
        disabled={!isReady}
        style={({ pressed }) => [
          styles.button,
          !isReady && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {!isReady ? "Loading…" : isPlaying ? "Pause" : "Play"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  button: {
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#b91c1c",
  },
});
