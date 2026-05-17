import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Linking,
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
import { Ionicons } from "@expo/vector-icons";
import {
  fetchEpisodes,
  fetchPages,
  generatePodcast,
  type Episode,
  type PageSummary,
} from "./src/api";
import { PodcastPlayer } from "./src/components/PodcastPlayer";
import { SyncedScript } from "./src/components/SyncedScript";
import { Theme, useTheme } from "./src/theme";

type View_ =
  | { kind: "home" }
  | { kind: "generating"; title: string }
  | { kind: "episode"; episode: Episode };

export default function App() {
  const theme = useTheme();
  const styles = useStyles(theme);

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

  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // Cross-fade between views (home / generating / episode)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view.kind, fadeAnim]);

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
    setPositionMs(0);
    setDurationMs(0);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Text style={styles.title}>Luminote</Text>
        <Text style={styles.subtitle}>Notion notes → podcast</Text>
      </View>

      <Animated.View style={[styles.fadeWrap, { opacity: fadeAnim }]}>
        {view.kind === "home" ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={theme.accent}
              />
            }
          >
            {genError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{genError}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Paste a Notion page link</Text>
              <TextInput
                style={styles.input}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://www.notion.so/chap15-25159919…"
                placeholderTextColor={theme.textDim}
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
                Add your Notion integration to the page first: open the page →
                ··· → Connections → add your integration.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Library</Text>
              {loadingEpisodes ? (
                <ActivityIndicator color={theme.accent} />
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
                  renderItem={({ item, index }) => (
                    <FadeInRow delay={index * 40}>
                      <View style={styles.row}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.rowMain,
                            pressed && styles.rowPressed,
                          ]}
                          onPress={() =>
                            setView({ kind: "episode", episode: item })
                          }
                        >
                          <Text style={styles.rowText} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {formatDate(item.createdAt)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Linking.openURL(notionUrl(item.pageId))
                          }
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.notionLink,
                            pressed && styles.notionLinkPressed,
                          ]}
                          accessibilityLabel="Open in Notion"
                        >
                          <Ionicons
                            name="open-outline"
                            size={14}
                            color={theme.accent}
                          />
                          <Text style={styles.notionLinkText}>Notion</Text>
                        </Pressable>
                      </View>
                    </FadeInRow>
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
                    <ActivityIndicator color={theme.accent} />
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
                            styles.rowSingle,
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
              <Ionicons name="chevron-back" size={18} color={theme.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.detailTitle}>{view.title}</Text>
            <View style={styles.generatingBlock}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.mutedText}>
                Generating script + audio… (~20–40s)
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detail}>
            <Pressable onPress={back} style={styles.backButton}>
              <Ionicons name="chevron-back" size={18} color={theme.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.detailTitle}>{view.episode.title}</Text>
            <Text style={styles.mutedText}>
              {formatDate(view.episode.createdAt)}
            </Text>
            <PodcastPlayer
              audioUrl={view.episode.audioUrl}
              onProgress={(pos, dur) => {
                setPositionMs(pos);
                if (dur) setDurationMs(dur);
              }}
            />
            <Text style={styles.scriptHeading}>Script</Text>
            <SyncedScript
              script={view.episode.script}
              positionMs={positionMs}
              durationMs={durationMs}
            />
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function FadeInRow({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function notionUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function useStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: theme.bg,
        },
        fadeWrap: {
          flex: 1,
        },
        header: {
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: theme.bg,
        },
        title: {
          fontSize: 28,
          fontWeight: "800",
          color: theme.text,
          letterSpacing: -0.5,
        },
        subtitle: {
          fontSize: 13,
          color: theme.textMuted,
          marginTop: 2,
        },
        scroll: {
          padding: 20,
          paddingBottom: 40,
        },
        section: {
          gap: 10,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        },
        input: {
          backgroundColor: theme.bgElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: 14,
          fontSize: 15,
          color: theme.text,
        },
        primaryButton: {
          backgroundColor: theme.accent,
          paddingVertical: 14,
          borderRadius: 999,
          alignItems: "center",
          shadowColor: theme.accent,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
        primaryButtonDisabled: {
          opacity: 0.45,
          shadowOpacity: 0,
        },
        primaryButtonPressed: {
          opacity: 0.92,
          transform: [{ scale: 0.99 }],
        },
        primaryButtonText: {
          color: theme.accentOn,
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: 0.2,
        },
        hint: {
          fontSize: 12,
          color: theme.textMuted,
          lineHeight: 17,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.border,
          marginVertical: 24,
        },
        mutedText: {
          color: theme.textMuted,
          fontSize: 14,
        },
        rowGap: { height: 8 },
        row: {
          backgroundColor: theme.bgElevated,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
        },
        rowSingle: {
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        rowMain: {
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        rowPressed: { opacity: 0.7 },
        rowText: {
          fontSize: 15,
          color: theme.text,
          fontWeight: "500",
        },
        rowMeta: {
          fontSize: 12,
          color: theme.textDim,
          marginTop: 3,
        },
        notionLink: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingVertical: 6,
          paddingHorizontal: 10,
          marginRight: 10,
          borderRadius: 999,
          backgroundColor: theme.accentSoft,
        },
        notionLinkPressed: { opacity: 0.6 },
        notionLinkText: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.accent,
        },
        errorBanner: {
          backgroundColor: theme.mode === "dark" ? "#3f1d1d" : "#fef2f2",
          borderColor: theme.danger,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 16,
        },
        errorBannerText: {
          color: theme.danger,
          fontSize: 13,
        },
        error: {
          color: theme.danger,
        },
        detail: {
          padding: 20,
          gap: 14,
        },
        backButton: {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          paddingVertical: 6,
          paddingRight: 8,
        },
        backText: {
          color: theme.text,
          fontSize: 15,
          fontWeight: "500",
        },
        detailTitle: {
          fontSize: 24,
          fontWeight: "800",
          color: theme.text,
          letterSpacing: -0.4,
        },
        generatingBlock: {
          alignItems: "center",
          paddingVertical: 32,
          gap: 10,
        },
        scriptHeading: {
          marginTop: 20,
          fontSize: 12,
          fontWeight: "700",
          color: theme.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        },
      }),
    [theme],
  );
}
