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
}));

jest.mock("expo-constants", () => ({
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

  it("skips registration on simulator (isDevice = false)", async () => {
    jest.resetModules();
    jest.mock("expo-device", () => ({ isDevice: false }));

    // Re-import after resetting modules so the mock takes effect
    const { usePushNotifications: useHook } =
      await import("../hooks/usePushNotifications");

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
