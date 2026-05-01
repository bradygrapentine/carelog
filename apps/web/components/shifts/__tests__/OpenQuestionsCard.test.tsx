import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenQuestionsCard } from "../OpenQuestionsCard";
import type { OpenQuestion } from "../OpenQuestionsCard";

const questions: OpenQuestion[] = [
  { id: "q1", text: "Did Dr. Chen call back?", by: "Sarah", when: "2h ago", open: true },
  { id: "q2", text: "Is PT confirmed for Thursday?", by: "Mike", when: "4h ago", open: false },
];

describe("<OpenQuestionsCard />", () => {
  it("renders one item per question", () => {
    render(<OpenQuestionsCard questions={questions} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("renders text, by, when for each", () => {
    render(<OpenQuestionsCard questions={questions} />);
    expect(screen.getByText("Did Dr. Chen call back?")).toBeInTheDocument();
    expect(screen.getByText(/Sarah/)).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    expect(screen.getByText("Is PT confirmed for Thursday?")).toBeInTheDocument();
    expect(screen.getByText(/Mike/)).toBeInTheDocument();
  });

  it("when onRespond + question is open, 'Respond' button renders and clicks call onRespond with id", () => {
    const onRespond = vi.fn();
    render(<OpenQuestionsCard questions={questions} onRespond={onRespond} />);
    const btn = screen.getByRole("button", { name: /Respond/i });
    fireEvent.click(btn);
    expect(onRespond).toHaveBeenCalledWith("q1");
  });

  it("when question.open === false, no 'Respond' button renders; resolved tag shows", () => {
    render(<OpenQuestionsCard questions={questions} onRespond={vi.fn()} />);
    const buttons = screen.getAllByRole("button", { name: /Respond/i });
    // only 1 open question → only 1 Respond button
    expect(buttons).toHaveLength(1);
    expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
  });

  it("when onRespond is not provided, no 'Respond' buttons render at all", () => {
    render(<OpenQuestionsCard questions={questions} />);
    expect(screen.queryByRole("button", { name: /Respond/i })).toBeNull();
  });

  it("empty questions renders the empty fallback", () => {
    render(<OpenQuestionsCard questions={[]} />);
    expect(screen.getByText(/No open questions/i)).toBeInTheDocument();
  });
});
