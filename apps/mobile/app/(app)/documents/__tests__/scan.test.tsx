import React from "react";
import { render } from "@testing-library/react-native";
import ScanScreen from "../scan";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "rec-1" }),
}));
jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

describe("ScanScreen", () => {
  it("renders camera and library buttons", () => {
    const { getByText } = render(<ScanScreen />);
    expect(getByText("Take Photo")).toBeTruthy();
    expect(getByText("Choose from Library")).toBeTruthy();
  });

  it("does not show upload button until a photo is selected", () => {
    const { queryByText } = render(<ScanScreen />);
    expect(queryByText("Upload & Process")).toBeNull();
  });
});
