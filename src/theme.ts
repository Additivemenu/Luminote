import { useColorScheme } from "react-native";

export interface Theme {
  mode: "light" | "dark";

  // Surfaces
  bg: string;
  bgElevated: string;
  border: string;

  // Text
  text: string;
  textMuted: string;
  textDim: string;

  // Brand & accents
  accent: string;
  accentOn: string;
  accentSoft: string;
  highlight: string;
  highlightSoft: string;

  // Status
  danger: string;

  // Shadows
  shadow: string;
}

// "Beach" — soft sand background, coral sunset accents, ocean teal highlight.
const light: Theme = {
  mode: "light",

  bg: "#fffaf0",
  bgElevated: "#ffffff",
  border: "#fde8c8",

  text: "#1f1916",
  textMuted: "#7a6a5d",
  textDim: "#c4b3a1",

  accent: "#fb923c",
  accentOn: "#ffffff",
  accentSoft: "#fff1de",
  highlight: "#0ea5e9",
  highlightSoft: "#e0f2fe",

  danger: "#f43f5e",

  shadow: "#7c2d12",
};

// "Beach at night" — still warm, but dimmed for low-light.
const dark: Theme = {
  mode: "dark",

  bg: "#1f1612",
  bgElevated: "#2a1f1a",
  border: "#3f2e25",

  text: "#fef7e8",
  textMuted: "#d4b89f",
  textDim: "#8a7666",

  accent: "#fdba74",
  accentOn: "#1f1612",
  accentSoft: "#4a2a14",
  highlight: "#38bdf8",
  highlightSoft: "#0c4a6e",

  danger: "#fb7185",

  shadow: "#000000",
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
