import { renderHook, act } from "@testing-library/react-native";
import { usePushNotifications } from "../hooks/usePushNotifications";

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockMutateAsync = jest.fn().mockResolvedValue({ success: true });

jest.mock("../utils/trpc", () => ({
  trpc: {
    notifications: {
      registerToken: {
        useMutation: () => ({ mutateAsync: mockMutateAsync }),
      },
    },
  },
}));

const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getExpoPushTokenAsync: (opts: object) => mockGetExpoPushTokenAsync(opts),
  setNotificationChannelAsync: (id: string, opts: object) =>
    mockSetNotificationChannelAsync(id, opts),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock("expo-device", () => ({
  isDevice: true,
}), { virtual: true });

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      slug: "carelog",
      extra: { eas: { projectId: "test-project-id" } },
    },
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("usePushNotifications", () => {
  it("requests permissions and registers token on a physical device", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({
      data: "ExponentPushToken[test-token]",
    });
    mockSetNotificationChannelAsync.mockResolvedValue(null);

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith("default", {
      name: "Default",
      importance: 3,
    });
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "test-project-id",
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: "ExponentPushToken[test-token]",
      platform: "android",
    });
    expect(result.current.token).toBe("ExponentPushToken[test-token]");
    expect(result.current.permissionStatus).toBe("granted");
  });

  // NOTE: this test requires jest.resetModules() + dynamic re-import, which
  // is unsupported in Jest CJS mode (needs --experimental-vm-modules).
  // Skipped until the project migrates to ESM jest or jest-expo adds support.
  it.skip("skips registration on simulator (isDevice = false)", async () => {
    jest.resetModules();
    jest.mock("expo-device", () => ({ isDevice: false }), { virtual: true });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { usePushNotifications: useHook } = require("../hooks/usePushNotifications");

    const { result } = renderHook(() => useHook());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(result.current.token).toBeNull();
  });

  it("handles permission denied gracefully without throwing", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(result.current.token).toBeNull();
    expect(result.current.permissionStatus).toBe("denied");
  });
});
