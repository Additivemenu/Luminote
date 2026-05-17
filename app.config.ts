import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: config.name ?? "Luminote",
  slug: config.slug ?? "luminote",
  extra: {
    ...(config.extra ?? {}),
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  },
});
