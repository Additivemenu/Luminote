import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";

interface Props {
  audioBase64: string;
  mimeType: string;
}

async function makePlayableUri(
  audioBase64: string,
  mimeType: string,
): Promise<{ uri: string; cleanup: () => void }> {
  if (Platform.OS === "web") {
    const byteString = atob(audioBase64);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i += 1) {
      bytes[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    return { uri: url, cleanup: () => URL.revokeObjectURL(url) };
  }

  const path = `${FileSystem.cacheDirectory}episode-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(path, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    uri: path,
    cleanup: () => {
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    },
  };
}

export function PodcastPlayer({ audioBase64, mimeType }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS !== "web") {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        }

        const { uri, cleanup } = await makePlayableUri(audioBase64, mimeType);
        if (cancelled) {
          cleanup();
          return;
        }
        cleanupRef.current = cleanup;

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          onPlaybackStatus,
        );
        if (cancelled) {
          await sound.unloadAsync();
          cleanup();
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
      const cleanup = cleanupRef.current;
      soundRef.current = null;
      cleanupRef.current = null;
      if (sound) sound.unloadAsync().catch(() => {});
      if (cleanup) cleanup();
    };
  }, [audioBase64, mimeType]);

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
