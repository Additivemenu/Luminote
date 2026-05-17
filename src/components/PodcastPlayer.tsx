import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  audioUrl: string;
  onProgress?: (positionMs: number, durationMs: number) => void;
}

const SKIP_MS = 15_000;
const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export function PodcastPlayer({ audioUrl, onProgress }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const trackWidthRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setError(null);
    setPositionMs(0);
    setDurationMs(0);

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
          { shouldPlay: false, progressUpdateIntervalMillis: 250 },
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
    const pos = status.positionMillis ?? 0;
    const dur = status.durationMillis ?? 0;
    setPositionMs(pos);
    if (dur) setDurationMs(dur);
    onProgressRef.current?.(pos, dur);
    if (status.didJustFinish) {
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }

  async function toggle() {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) await sound.pauseAsync();
    else await sound.playAsync();
  }

  async function seekBy(deltaMs: number) {
    const sound = soundRef.current;
    if (!sound || !durationMs) return;
    const next = clamp(positionMs + deltaMs, 0, durationMs);
    await sound.setPositionAsync(next);
    setPositionMs(next);
  }

  async function seekToFraction(fraction: number) {
    const sound = soundRef.current;
    if (!sound || !durationMs) return;
    const next = clamp(fraction * durationMs, 0, durationMs);
    await sound.setPositionAsync(next);
    setPositionMs(next);
  }

  async function cyclePlaybackRate() {
    const sound = soundRef.current;
    if (!sound) return;
    const nextIdx = (rateIdx + 1) % PLAYBACK_RATES.length;
    await sound.setRateAsync(PLAYBACK_RATES[nextIdx], true);
    setRateIdx(nextIdx);
  }

  function onTrackLayout(e: LayoutChangeEvent) {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.track}
        onLayout={onTrackLayout}
        onPress={(e) => {
          const w = trackWidthRef.current;
          if (w > 0) seekToFraction(e.nativeEvent.locationX / w);
        }}
        disabled={!isReady || durationMs === 0}
      >
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        <View
          style={[
            styles.thumb,
            { left: `${progress * 100}%` },
            (!isReady || durationMs === 0) && styles.thumbHidden,
          ]}
        />
      </Pressable>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
        <Text style={styles.timeText}>
          {durationMs > 0 ? formatTime(durationMs) : "--:--"}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={cyclePlaybackRate}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.rateButton,
            pressed && styles.controlPressed,
            !isReady && styles.controlDisabled,
          ]}
        >
          <Text style={styles.rateText}>{PLAYBACK_RATES[rateIdx]}×</Text>
        </Pressable>

        <Pressable
          onPress={() => seekBy(-SKIP_MS)}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.controlPressed,
            !isReady && styles.controlDisabled,
          ]}
          hitSlop={8}
        >
          <Ionicons name="play-back" size={22} color="#0f172a" />
          <Text style={styles.skipLabel}>15</Text>
        </Pressable>

        <Pressable
          onPress={toggle}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.playPressed,
            !isReady && styles.controlDisabled,
          ]}
          hitSlop={8}
        >
          {!isReady ? (
            <ActivityIndicator color="white" />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={28}
              color="white"
              style={!isPlaying ? styles.playOffset : undefined}
            />
          )}
        </Pressable>

        <Pressable
          onPress={() => seekBy(SKIP_MS)}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.controlPressed,
            !isReady && styles.controlDisabled,
          ]}
          hitSlop={8}
        >
          <Ionicons name="play-forward" size={22} color="#0f172a" />
          <Text style={styles.skipLabel}>15</Text>
        </Pressable>

        <View style={styles.rateButton} />
      </View>
    </View>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
const PRIMARY = "#0f172a";
const ACCENT = "#6366f1";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 12,
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
  },
  track: {
    height: THUMB_SIZE + 8,
    justifyContent: "center",
    marginTop: 4,
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "#e2e8f0",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: ACCENT,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: ACCENT,
    marginLeft: -THUMB_SIZE / 2,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbHidden: {
    opacity: 0,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  timeText: {
    fontSize: 12,
    color: "#64748b",
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  playPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  playOffset: {
    marginLeft: 3,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  skipLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: -2,
  },
  rateButton: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  rateText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  controlPressed: {
    opacity: 0.7,
  },
  controlDisabled: {
    opacity: 0.4,
  },
});
