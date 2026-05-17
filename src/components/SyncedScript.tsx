import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  script: string;
  positionMs: number;
  durationMs: number;
}

function splitSentences(text: string): string[] {
  const result: string[] = [];
  let current = "";
  for (const ch of text) {
    current += ch;
    if (/[.!?。！？]/.test(ch)) {
      result.push(current);
      current = "";
    } else if (ch === "\n" && current.trim().length > 0) {
      result.push(current);
      current = "";
    }
  }
  if (current.trim().length > 0) result.push(current);
  return result.length > 0 ? result : [text];
}

export function SyncedScript({ script, positionMs, durationMs }: Props) {
  const { sentences, cumulative, total } = useMemo(() => {
    const sentences = splitSentences(script);
    const cumulative: number[] = [];
    let running = 0;
    for (const s of sentences) {
      running += s.length;
      cumulative.push(running);
    }
    return { sentences, cumulative, total: running || 1 };
  }, [script]);

  const activeIdx = useMemo(() => {
    if (durationMs <= 0) return -1;
    const currentChar = (positionMs / durationMs) * total;
    const idx = cumulative.findIndex((c) => c > currentChar);
    return idx === -1 ? sentences.length - 1 : idx;
  }, [positionMs, durationMs, cumulative, total, sentences.length]);

  return (
    <View>
      <Text style={styles.body}>
        {sentences.map((s, i) => (
          <Text
            key={i}
            style={
              i === activeIdx
                ? styles.active
                : i < activeIdx
                  ? styles.past
                  : styles.upcoming
            }
          >
            {s}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 26,
  },
  past: {
    color: "#94a3b8",
  },
  active: {
    color: "#6366f1",
    fontWeight: "700",
  },
  upcoming: {
    color: "#334155",
  },
});
