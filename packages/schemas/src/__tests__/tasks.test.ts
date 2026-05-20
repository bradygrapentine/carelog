import { describe, it, expect } from "vitest";
import {
  taskStatus,
  createTaskPayload,
  updateTaskPayload,
  taskPermissionsPayload,
  checklistItem,
} from "../tasks";

const UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";

describe("taskStatus", () => {
  it("accepts the four canonical statuses", () => {
    for (const s of ["todo", "in_progress", "done", "cancelled"]) {
      expect(taskStatus.parse(s)).toBe(s);
    }
  });
  it("rejects an unknown status", () => {
    expect(() => taskStatus.parse("archived")).toThrow();
  });
});

describe("checklistItem", () => {
  it("accepts a valid item", () => {
    expect(checklistItem.parse({ label: "Refill meds", done: false })).toEqual({
      label: "Refill meds",
      done: false,
    });
  });
  it("rejects an empty label", () => {
    expect(() => checklistItem.parse({ label: "", done: false })).toThrow();
  });
});

describe("createTaskPayload", () => {
  it("accepts a minimal task", () => {
    const r = createTaskPayload.parse({
      recipient_id: UUID,
      title: "Pick up prescription",
    });
    expect(r.title).toBe("Pick up prescription");
  });
  it("accepts checklist + nullable instructions/assignee", () => {
    const r = createTaskPayload.parse({
      recipient_id: UUID,
      title: "Morning routine",
      instructions: null,
      assigned_to: null,
      checklist: [{ label: "Vitals", done: false }],
    });
    expect(r.checklist).toHaveLength(1);
  });
  it("rejects a blank title", () => {
    expect(() =>
      createTaskPayload.parse({ recipient_id: UUID, title: "" }),
    ).toThrow();
  });
  it("rejects a title over 200 chars", () => {
    expect(() =>
      createTaskPayload.parse({ recipient_id: UUID, title: "x".repeat(201) }),
    ).toThrow();
  });
  it("rejects a non-uuid recipient_id", () => {
    expect(() =>
      createTaskPayload.parse({ recipient_id: "nope", title: "t" }),
    ).toThrow();
  });
  it("rejects a checklist over 100 items", () => {
    const checklist = Array.from({ length: 101 }, () => ({
      label: "x",
      done: false,
    }));
    expect(() =>
      createTaskPayload.parse({ recipient_id: UUID, title: "t", checklist }),
    ).toThrow();
  });
});

describe("updateTaskPayload", () => {
  it("accepts a status transition", () => {
    expect(updateTaskPayload.parse({ id: UUID, status: "done" }).status).toBe(
      "done",
    );
  });
  it("does not accept server-forced completed_by", () => {
    const r = updateTaskPayload.parse({
      id: UUID,
      status: "done",
      completed_by: UUID,
    } as never);
    expect("completed_by" in r).toBe(false);
  });
});

// TD-218: guards the shared-base refactor — `title` must keep its differing
// optionality across the two payloads (required on create, optional on update).
describe("title optionality parity (shared-base refactor guard)", () => {
  it("create REQUIRES title (rejects when omitted)", () => {
    expect(() => createTaskPayload.parse({ recipient_id: UUID })).toThrow();
  });
  it("update ACCEPTS a missing title", () => {
    const r = updateTaskPayload.parse({ id: UUID });
    expect("title" in r).toBe(false);
  });
  it("shared base fields still parse on both payloads", () => {
    expect(
      createTaskPayload.parse({
        recipient_id: UUID,
        title: "t",
        shift_id: null,
      }).shift_id,
    ).toBeNull();
    expect(
      updateTaskPayload.parse({ id: UUID, shift_id: null }).shift_id,
    ).toBeNull();
  });
});

describe("taskPermissionsPayload", () => {
  it("accepts role arrays", () => {
    const r = taskPermissionsPayload.parse({
      creator_roles: ["coordinator"],
      completer_roles: ["coordinator", "caregiver"],
    });
    expect(r.completer_roles).toContain("caregiver");
  });
  it("rejects an empty role array", () => {
    expect(() =>
      taskPermissionsPayload.parse({
        creator_roles: [],
        completer_roles: ["coordinator"],
      }),
    ).toThrow();
  });
  it("rejects an unknown role", () => {
    expect(() =>
      taskPermissionsPayload.parse({
        creator_roles: ["admin"],
        completer_roles: ["coordinator"],
      }),
    ).toThrow();
  });
});
