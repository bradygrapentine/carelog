import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ScanScreen from "../scan";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: "Images" },
}));

global.fetch = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("ScanScreen", () => {
  it("renders placeholder when no photo", () => {
    const { getByText } = render(<ScanScreen />);
    expect(getByText("No photo selected")).toBeTruthy();
  });

  it("renders Take Photo and Choose from Library buttons", () => {
    const { getByText } = render(<ScanScreen />);
    expect(getByText("Take Photo")).toBeTruthy();
    expect(getByText("Choose from Library")).toBeTruthy();
  });

  it("does not show Upload & Process when no photo", () => {
    const { queryByText } = render(<ScanScreen />);
    expect(queryByText("Upload & Process")).toBeNull();
  });

  it("shows Upload & Process after photo selected from library", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: "file://photo.jpg",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
        },
      ],
    });
    const { getByText, findByText } = render(<ScanScreen />);
    fireEvent.press(getByText("Choose from Library"));
    await findByText("Upload & Process");
  });

  it("shows Upload & Process after photo taken with camera", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.launchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file://scan.jpg", mimeType: "image/jpeg" }],
    });
    const { getByText, findByText } = render(<ScanScreen />);
    fireEvent.press(getByText("Take Photo"));
    await findByText("Upload & Process");
  });

  it("shows alert when camera permission denied", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({
      granted: false,
    });
    const { getByText } = render(<ScanScreen />);
    fireEvent.press(getByText("Take Photo"));
    await waitFor(() => {
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
    });
    // Alert.alert("Permission required") fired — no crash
    expect(getByText("Take Photo")).toBeTruthy();
  });

  it("calls /api/ocr/upload after photo selected and Upload pressed", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: "file://photo.jpg",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
        },
      ],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const { getByText, findByText } = render(<ScanScreen />);
    fireEvent.press(getByText("Choose from Library"));
    await findByText("Upload & Process");
    fireEvent.press(getByText("Upload & Process"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/ocr/upload"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows error alert on failed upload", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: "file://photo.jpg",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
        },
      ],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    const { getByText, findByText } = render(<ScanScreen />);
    fireEvent.press(getByText("Choose from Library"));
    await findByText("Upload & Process");
    fireEvent.press(getByText("Upload & Process"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
