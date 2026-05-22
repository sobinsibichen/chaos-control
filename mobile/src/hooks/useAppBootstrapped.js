import { useAppStore } from "@/store/appStore";

export function useAppBootstrapped() {
  return useAppStore((state) => state.bootstrapped);
}
