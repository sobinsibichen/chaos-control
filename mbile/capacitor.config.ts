import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lastpuff.mobile",
  appName: "Last Puff",
  webDir: "dist/client",
  server: {
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
