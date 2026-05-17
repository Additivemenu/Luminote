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
  fetchPages,
  generatePodcast,
  type PageSummary,
  type PodcastResult,
} from "./src/api";
import { PodcastPlayer } from "./src/components/PodcastPlayer";

interface Selection {
  title: string;
  source: string;
}

export default function App() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [hasDatabase, setHasDatabase] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [urlInput, setUrlInput] = useState("");

  const [selected, setSelected] = useState<Selection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<PodcastResult | null>(null);

  const loadPages = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoadingPages(true);
    else setRefreshing(true);
    setPagesError(null);
    try {
      const { pages: next, hasDatabase: hasDb } = await fetchPages();
      setPages(next);
      setHasDatabase(hasDb);
    } catch (err) {
      setPagesError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoadingPages(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPages("initial");
  }, [loadPages]);

  async function generate(selection: Selection) {
    setSelected(selection);
    setResult(null);
    setGenError(null);
    setGenerating(true);
    try {
      const next = await generatePodcast(selection.source);
      setResult(next);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate podcast");
    } finally {
      setGenerating(false);
    }
  }

  function generateFromUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    generate({ title: "Pasted Notion page", source: trimmed });
  }

  function back() {
    setSelected(null);
    setResult(null);
    setGenError(null);
    setGenerating(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Luminote</Text>
        <Text style={styles.subtitle}>Notion notes → podcast</Text>
      </View>

      {!selected ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPages("refresh")}
            />
          }
        >
          <View style={styles.urlSection}>
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
              Make sure your Notion integration has access to the page (open the
              page → ··· → Connections → add your integration).
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.dbSection}>
            <Text style={styles.sectionLabel}>From your database</Text>
            {loadingPages ? (
              <ActivityIndicator />
            ) : pagesError ? (
              <View>
                <Text style={styles.error}>{pagesError}</Text>
                <Pressable
                  style={styles.retry}
                  onPress={() => loadPages("initial")}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : !hasDatabase ? (
              <Text style={styles.dbStatus}>
                No NOTION_DATABASE_ID configured. Use the link input above, or
                set the env var to browse a database.
              </Text>
            ) : pages.length === 0 ? (
              <Text style={styles.dbStatus}>
                Database is empty. Pull to refresh.
              </Text>
            ) : (
              <FlatList
                data={pages}
                keyExtractor={(p) => p.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.rowGap} />}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() =>
                      generate({ title: item.title, source: item.id })
                    }
                  >
                    <Text style={styles.rowText}>{item.title}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.detail}>
          <Pressable onPress={back} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{selected.title}</Text>

          {generating ? (
            <View style={styles.generatingBlock}>
              <ActivityIndicator />
              <Text style={styles.generatingText}>
                Generating script + audio… (~20–40s)
              </Text>
            </View>
          ) : genError ? (
            <View>
              <Text style={styles.error}>{genError}</Text>
              <Pressable style={styles.retry} onPress={() => generate(selected)}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : result ? (
            <>
              <PodcastPlayer
                audioBase64={result.audioBase64}
                mimeType={result.mimeType}
              />
              <Text style={styles.scriptHeading}>Script</Text>
              <Text style={styles.scriptBody}>{result.script}</Text>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
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
  urlSection: {
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
  dbSection: {
    gap: 12,
  },
  dbStatus: {
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
  error: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  retry: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#0f172a",
  },
  retryText: {
    color: "white",
    fontWeight: "600",
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
  generatingText: {
    color: "#64748b",
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
