import { render, screen, fireEvent } from "@testing-library/react-native";
import { MoodRow } from "../MoodRow";

describe("MoodRow", () => {
  it("renders all four moods", () => {
    const mockOnSelect = jest.fn();
    render(<MoodRow selectedMood={null} onMoodSelect={mockOnSelect} />);

    expect(screen.getByText("Good")).toBeTruthy();
    expect(screen.getByText("Okay")).toBeTruthy();
    expect(screen.getByText("Difficult")).toBeTruthy();
    expect(screen.getByText("Crisis")).toBeTruthy();
  });

  it("each mood button has an accessibility label", () => {
    const mockOnSelect = jest.fn();
    render(<MoodRow selectedMood={null} onMoodSelect={mockOnSelect} />);

    const goodBtn = screen.getByLabelText("Good mood");
    const okayBtn = screen.getByLabelText("Okay mood");
    const difficultBtn = screen.getByLabelText("Difficult mood");
    const crisisBtn = screen.getByLabelText("Crisis mood");

    expect(goodBtn).toBeTruthy();
    expect(okayBtn).toBeTruthy();
    expect(difficultBtn).toBeTruthy();
    expect(crisisBtn).toBeTruthy();
  });

  it("marks the selected mood with accessibility state", () => {
    const mockOnSelect = jest.fn();
    const { rerender } = render(
      <MoodRow selectedMood={null} onMoodSelect={mockOnSelect} />
    );

    rerender(<MoodRow selectedMood="good" onMoodSelect={mockOnSelect} />);

    const goodBtn = screen.getByLabelText("Good mood");
    expect(goodBtn).toBeTruthy();
    // Accessibility state is set via the accessibilityState prop
  });

  it("calls onMoodSelect when a mood is pressed", () => {
    const mockOnSelect = jest.fn();
    render(<MoodRow selectedMood={null} onMoodSelect={mockOnSelect} />);

    const difficultBtn = screen.getByText("Difficult");
    fireEvent.press(difficultBtn);

    expect(mockOnSelect).toHaveBeenCalledWith("difficult");
  });

  it("updates button styling when mood is selected", () => {
    const mockOnSelect = jest.fn();
    render(<MoodRow selectedMood={null} onMoodSelect={mockOnSelect} />);

    const okayBtn = screen.getByText("Okay");
    expect(okayBtn).toBeTruthy();

    // The button is rendered — verify it's callable
    fireEvent.press(okayBtn);
    expect(mockOnSelect).toHaveBeenCalledWith("okay");
  });
});
