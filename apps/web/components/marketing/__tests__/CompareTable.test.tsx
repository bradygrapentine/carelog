import { render, screen } from "@testing-library/react";
import { CompareTable } from "../CompareTable";

describe("CompareTable", () => {
  it("renders all three product column headers", () => {
    render(<CompareTable />);
    // Desktop table headers
    const carelogHeaders = screen.getAllByText("CareSync");
    expect(carelogHeaders.length).toBeGreaterThan(0);
    const caringBridgeHeaders = screen.getAllByText("CaringBridge");
    expect(caringBridgeHeaders.length).toBeGreaterThan(0);
    const lotsaHeaders = screen.getAllByText("Lotsa Helping Hands");
    expect(lotsaHeaders.length).toBeGreaterThan(0);
  });

  it("renders the medication tracking feature row", () => {
    render(<CompareTable />);
    const medicationLabels = screen.getAllByText("Medication tracking");
    expect(medicationLabels.length).toBeGreaterThan(0);
  });

  it("renders the caregiver shift schedule row", () => {
    render(<CompareTable />);
    const shiftLabels = screen.getAllByText("Caregiver shift schedule");
    expect(shiftLabels.length).toBeGreaterThan(0);
  });

  it("renders the documents vault row", () => {
    render(<CompareTable />);
    const docsLabels = screen.getAllByText("Documents vault");
    expect(docsLabels.length).toBeGreaterThan(0);
  });

  it("shows $14/mo family as the CareSync pricing value", () => {
    render(<CompareTable />);
    expect(screen.getAllByText("$14/mo family").length).toBeGreaterThan(0);
  });

  it("shows HIPAA-conscious row", () => {
    render(<CompareTable />);
    const hipaaLabels = screen.getAllByText("HIPAA-conscious");
    expect(hipaaLabels.length).toBeGreaterThan(0);
  });
});
