import React from "react";
import { render } from "@testing-library/react-native";
import OcrReviewScreen from "../[jobId]";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ jobId: "job-123" }),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("../../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

const mockJob = {
  id: "job-123",
  status: "needs_review",
  parsed_data: {
    document_type: "bill",
    fields: [
      {
        label: "Total Due",
        value: "$42.00",
        type: "currency",
        confidence: 0.9,
      },
      { label: "Account", value: "UNCERTAIN", type: "text", confidence: 0.5 },
    ],
  },
};

(global as unknown as { fetch: jest.Mock }).fetch = jest
  .fn()
  .mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ job: mockJob }),
  });

describe("OcrReviewScreen", () => {
  it("renders the document type badge", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText("Bill");
  });

  it("renders field labels", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText("Total Due");
    await findByText("Account");
  });

  it("marks low-confidence fields with a warning indicator", async () => {
    const { findByTestId } = render(<OcrReviewScreen />);
    await findByTestId("low-confidence-Account");
  });

  it("renders Save button", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText("Save");
  });
});
