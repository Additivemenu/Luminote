import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  fetchEpisodes,
  fetchPages,
  generatePodcast,
  type Episode,
  type PageSummary,
} from "./src/api";
import { PodcastPlayer } from "./src/components/PodcastPlayer";

type View_ =
  | { kind: "home" }
  | { kind: "generating"; title: string }
  | { kind: "episode"; episode: Episode };

export default function App() {
  const [view, setView] = useState<View_>({ kind: "home" });
  const [genError, setGenError] = useState<string | null>(null);

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [hasDatabase, setHasDatabase] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [loadingPages, setLoadingPages] = useState(true);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const loadPages = useCallback(async () => {
    setPagesError(null);
    try {
      const { pages: next, hasDatabase: hasDb } = await fetchPages();
      setPages(next);
      setHasDatabase(hasDb);
    } catch (err) {
      setPagesError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const loadEpisodes = useCallback(async () => {
    setEpisodesError(null);
    try {
      setEpisodes(await fetchEpisodes());
    } catch (err) {
      setEpisodesError(
        err instanceof Error ? err.message : "Failed to load library",
      );
    } finally {
      setLoadingEpisodes(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPages(), loadEpisodes()]);
    setRefreshing(false);
  }, [loadPages, loadEpisodes]);

  useEffect(() => {
    loadPages();
    loadEpisodes();
  }, [loadPages, loadEpisodes]);

  async function generate(input: string, title: string) {
    setGenError(null);
    setView({ kind: "generating", title });
    try {
      const ep = await generatePodcast(input);
      setEpisodes((prev) => [ep, ...prev.filter((e) => e.id !== ep.id)]);
      setView({ kind: "episode", episode: ep });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate");
      setView({ kind: "home" });
    }
  }

  function generateFromUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setUrlInput("");
    generate(trimmed, "Pasted Notion page");
  }

  function back() {
    setView({ kind: "home" });
    setGenError(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Luminote</Text>
        <Text style={styles.subtitle}>Notion notes → podcast</Text>
      </View>

      {view.kind === "home" ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
        >
          {genError && (
            <Text style={[styles.error, { marginBottom: 12 }]}>{genError}</Text>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Paste a Notion page link</Text>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://www.notion.so/chap15-25159919…"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={generateFromUrl}
            />
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !urlInput.trim() && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={generateFromUrl}
              disabled={!urlInput.trim()}
            >
              <Text style={styles.primaryButtonText}>Generate podcast</Text>
            </Pressable>
            <Text style={styles.hint}>
              Add your Notion integration to the page first: open the page → ···
              → Connections → add your integration.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Library</Text>
            {loadingEpisodes ? (
              <ActivityIndicator />
            ) : episodesError ? (
              <Text style={styles.error}>{episodesError}</Text>
            ) : episodes.length === 0 ? (
              <Text style={styles.mutedText}>
                No episodes yet. Generate one above.
              </Text>
            ) : (
              <FlatList
                data={episodes}
                keyExtractor={(e) => e.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.rowGap} />}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() =>
                      setView({ kind: "episode", episode: item })
                    }
                  >
                    <Text style={styles.rowText}>{item.title}</Text>
                    <Text style={styles.rowMeta}>{formatDate(item.createdAt)}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>

          {hasDatabase && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>From your database</Text>
                {loadingPages ? (
                  <ActivityIndicator />
                ) : pagesError ? (
                  <Text style={styles.error}>{pagesError}</Text>
                ) : pages.length === 0 ? (
                  <Text style={styles.mutedText}>
                    Database is empty. Pull to refresh.
                  </Text>
                ) : (
                  <FlatList
                    data={pages}
                    keyExtractor={(p) => p.id}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => (
                      <View style={styles.rowGap} />
                    )}
                    renderItem={({ item }) => (
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          pressed && styles.rowPressed,
                        ]}
                        onPress={() => generate(item.id, item.title)}
                      >
                        <Text style={styles.rowText}>{item.title}</Text>
                      </Pressable>
                    )}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      ) : view.kind === "generating" ? (
        <View style={styles.detail}>
          <Pressable onPress={back} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{view.title}</Text>
          <View style={styles.generatingBlock}>
            <ActivityIndicator />
            <Text style={styles.mutedText}>
              Generating script + audio… (~20–40s)
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.detail}>
          <Pressable onPress={back} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{view.episode.title}</Text>
          <Text style={styles.mutedText}>
            {formatDate(view.episode.createdAt)}
          </Text>
          <PodcastPlayer audioUrl={view.episode.audioUrl} />
          <Text style={styles.scriptHeading}>Script</Text>
          <Text style={styles.scriptBody}>{view.episode.script}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "white",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
    marginVertical: 24,
  },
  mutedText: {
    color: "#64748b",
    fontSize: 14,
  },
  rowGap: {
    height: 8,
  },
  row: {
    backgroundColor: "white",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    fontSize: 15,
    color: "#0f172a",
  },
  rowMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  error: {
    color: "#b91c1c",
  },
  detail: {
    padding: 20,
    gap: 12,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  backText: {
    color: "#0f172a",
    fontSize: 14,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  generatingBlock: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  scriptHeading: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scriptBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0f172a",
  },
});
