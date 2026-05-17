import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "../theme";

interface Props {
  audioUrl: string;
  onProgress?: (positionMs: number, durationMs: number) => void;
}

const SKIP_MS = 15_000;
const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export function PodcastPlayer({ audioUrl, onProgress }: Props) {
  const theme = useTheme();
  const styles = useStyles(theme);

  const soundRef = useRef<Audio.Sound | null>(null);
  const trackWidthRef = useRef(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const playScale = useRef(new Animated.Value(1)).current;

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
    progressAnim.setValue(0);

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
  }, [audioUrl, progressAnim]);

  // Smoothly tween the progress bar between status callbacks.
  useEffect(() => {
    if (durationMs <= 0) return;
    const target = positionMs / durationMs;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [positionMs, durationMs, progressAnim]);

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
    Animated.sequence([
      Animated.timing(playScale, {
        toValue: 0.92,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(playScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
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

  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

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
        <Animated.View style={[styles.trackFill, { width: widthInterp }]} />
        <Animated.View
          style={[
            styles.thumb,
            { left: widthInterp },
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
          <Ionicons name="play-back" size={22} color={theme.text} />
          <Text style={styles.skipLabel}>15</Text>
        </Pressable>

        <Animated.View style={{ transform: [{ scale: playScale }] }}>
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
              <ActivityIndicator color={theme.accentOn} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={28}
                color={theme.accentOn}
                style={!isPlaying ? styles.playOffset : undefined}
              />
            )}
          </Pressable>
        </Animated.View>

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
          <Ionicons name="play-forward" size={22} color={theme.text} />
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

function useStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.bgElevated,
          borderRadius: 16,
          padding: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          shadowColor: theme.shadow,
          shadowOpacity: theme.mode === "dark" ? 0.4 : 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          gap: 12,
        },
        errorText: {
          color: theme.danger,
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
          backgroundColor: theme.border,
        },
        trackFill: {
          position: "absolute",
          left: 0,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: theme.accent,
        },
        thumb: {
          position: "absolute",
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: theme.accent,
          marginLeft: -THUMB_SIZE / 2,
          shadowColor: theme.accent,
          shadowOpacity: 0.35,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
        thumbHidden: { opacity: 0 },
        timeRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: -4,
        },
        timeText: {
          fontSize: 12,
          color: theme.textMuted,
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
          backgroundColor: theme.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: theme.accent,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        playPressed: { opacity: 0.9 },
        playOffset: { marginLeft: 3 },
        skipButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.mode === "dark" ? theme.border : "#f5f5f4",
        },
        skipLabel: {
          fontSize: 10,
          fontWeight: "700",
          color: theme.text,
          marginTop: -2,
        },
        rateButton: {
          width: 48,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.mode === "dark" ? theme.border : "#f5f5f4",
        },
        rateText: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.text,
        },
        controlPressed: { opacity: 0.7 },
        controlDisabled: { opacity: 0.4 },
      }),
    [theme],
  );
}
