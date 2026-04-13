# Phase 6 Mobile — Missing Screens + Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 missing mobile screens (outer circle, care brief, benefits, EOL planner), wire them into the More tab, and write Jest test skeletons for all screens currently missing coverage.

**Architecture:** New screens live under `apps/mobile/app/(app)/` following the existing pattern (StyleSheet, `useApp()` for org context, tRPC hooks from `utils/trpc`). Each gets registered as `href: null` in `_layout.tsx` and linked from the More grid. Tests use React Native Testing Library + Jest mocks, matching the pattern in `symptoms/__tests__/index.test.tsx`.

**Tech Stack:** Expo Router, React Native, tRPC client (`utils/trpc`), `@testing-library/react-native`, Jest

---

## File Map

**Create:**
- `apps/mobile/app/(app)/outer-circle/index.tsx` — list + create requests, view claims (coordinator)
- `apps/mobile/app/(app)/outer-circle/__tests__/index.test.tsx` — Jest skeleton
- `apps/mobile/app/(app)/care-brief/index.tsx` — generate brief, copy URL, revoke (coordinator)
- `apps/mobile/app/(app)/care-brief/__tests__/index.test.tsx` — Jest skeleton
- `apps/mobile/app/(app)/benefits/index.tsx` — eligibility screening form + results
- `apps/mobile/app/(app)/benefits/__tests__/index.test.tsx` — Jest skeleton
- `apps/mobile/app/(app)/eol-planner/index.tsx` — read/edit advance directive (coordinator only)
- `apps/mobile/app/(app)/eol-planner/__tests__/index.test.tsx` — Jest skeleton
- `apps/mobile/app/(app)/expenses/__tests__/index.test.tsx` — Jest skeleton (screen exists)
- `apps/mobile/app/(app)/expenses/__tests__/add.test.tsx` — Jest skeleton (screen exists)
- `apps/mobile/app/(app)/burnout/__tests__/checkin.test.tsx` — Jest skeleton (screen exists)
- `apps/mobile/app/(app)/burnout/__tests__/summary.test.tsx` — Jest skeleton (screen exists)
- `apps/mobile/app/(app)/symptoms/__tests__/log.test.tsx` — Jest skeleton (screen exists)
- `apps/mobile/app/(app)/documents/__tests__/index.test.tsx` — Jest skeleton (screen exists)

**Modify:**
- `apps/mobile/app/(app)/more/index.tsx` — add 4 new items to ITEMS array
- `apps/mobile/app/(app)/_layout.tsx` — register 4 new screen paths as `href: null`

---

## Task 1: Outer Circle Screen

**Files:**
- Create: `apps/mobile/app/(app)/outer-circle/index.tsx`
- Create: `apps/mobile/app/(app)/outer-circle/__tests__/index.test.tsx`

### tRPC procedures used
- `trpc.outerCircle.list` — input: `{ org_id, recipient_id }` — returns requests with `id, title, description, slots_total, slots_filled, active, share_token`
- `trpc.outerCircle.create` — coordinator only — input: `{ org_id, recipient_id, title, description, request_type, slots_total, needed_by? }`
- `trpc.outerCircle.deactivate` — coordinator only — input: `{ id, org_id }`

- [ ] **Step 1: Write the failing test skeleton**

Create `apps/mobile/app/(app)/outer-circle/__tests__/index.test.tsx`:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import OuterCircleScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockRequests = [
  {
    id: "req-1",
    title: "Grocery run",
    description: "Weekly groceries",
    slots_total: 2,
    slots_filled: 1,
    active: true,
    share_token: "abc123",
    created_at: "2026-04-01T10:00:00Z",
  },
];

const mockCreate = jest.fn();
const mockDeactivate = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    outerCircle: {
      list: {
        useQuery: jest.fn(() => ({ data: mockRequests, isLoading: false, refetch: jest.fn() })),
      },
      create: {
        useMutation: jest.fn(() => ({ mutate: mockCreate, isPending: false })),
      },
      deactivate: {
        useMutation: jest.fn(() => ({ mutate: mockDeactivate, isPending: false })),
      },
    },
  },
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe("OuterCircleScreen", () => {
  it("renders request list", () => {
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("Grocery run")).toBeTruthy();
    expect(getByText("1 / 2 slots filled")).toBeTruthy();
  });

  it("renders empty state when no requests", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.outerCircle.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("No volunteer requests yet.")).toBeTruthy();
  });

  it("shows Add Request button for coordinator", () => {
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("Add Request")).toBeTruthy();
  });

  it("hides Add Request for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({ orgId: "org-1", recipientId: "r-1", currentRole: "caregiver" });
    const { queryByText } = render(<OuterCircleScreen />);
    expect(queryByText("Add Request")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/mobile && npx jest outer-circle --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `Cannot find module '../index'`

- [ ] **Step 3: Implement `outer-circle/index.tsx`**

Create `apps/mobile/app/(app)/outer-circle/index.tsx`:

```tsx
import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function OuterCircleScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const isCoordinator = currentRole === "coordinator";
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slotsTotal, setSlotsTotal] = useState("1");

  const { data, isLoading, refetch } = trpc.outerCircle.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  const createMut = trpc.outerCircle.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setTitle("");
      setDescription("");
      setSlotsTotal("1");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const deactivateMut = trpc.outerCircle.deactivate.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  function handleCreate() {
    const slots = parseInt(slotsTotal, 10);
    if (!title.trim() || isNaN(slots) || slots < 1) {
      Alert.alert("Please fill in all fields");
      return;
    }
    const orgIdVal = orgId;
    const recipientIdVal = recipientId;
    if (!orgIdVal || !recipientIdVal) return;
    createMut.mutate({
      org_id: orgIdVal,
      recipient_id: recipientIdVal,
      title: title.trim(),
      description: description.trim(),
      request_type: "volunteer",
      slots_total: slots,
    });
  }

  function handleCopyLink(shareToken: string) {
    const url = API_URL + "/care/" + shareToken;
    Clipboard.setStringAsync(url).then(() =>
      Alert.alert("Link copied", url),
    );
  }

  function confirmDeactivate(id: string) {
    Alert.alert("Close request?", "Volunteers will no longer be able to claim slots.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: () => deactivateMut.mutate({ id, org_id: orgId ?? "" }),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {isCoordinator && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
          accessibilityRole="button"
          accessibilityLabel="Add Request"
        >
          <Text style={styles.addBtnText}>Add Request</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.cardDesc}>{item.description}</Text>
              ) : null}
              <Text style={styles.slots}>
                {item.slots_filled} / {item.slots_total} slots filled
              </Text>
              {isCoordinator && item.active && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => handleCopyLink(item.share_token)}
                    accessibilityRole="button"
                    accessibilityLabel="Copy share link"
                  >
                    <Text style={styles.actionLink}>Copy link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeactivate(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Close request"
                  >
                    <Text style={[styles.actionLink, styles.danger]}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!item.active && (
                <Text style={styles.closedBadge}>Closed</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No volunteer requests yet.</Text>
          }
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New volunteer request</Text>
            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Grocery run)"
              value={title}
              onChangeText={setTitle}
              accessibilityLabel="Title"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              accessibilityLabel="Description"
            />
            <TextInput
              style={styles.input}
              placeholder="Number of slots"
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              keyboardType="number-pad"
              accessibilityLabel="Number of slots"
            />
            <TouchableOpacity
              style={[styles.submitBtn, createMut.isPending && styles.disabled]}
              onPress={handleCreate}
              disabled={createMut.isPending}
              accessibilityRole="button"
              accessibilityLabel={createMut.isPending ? "Creating" : "Create Request"}
            >
              <Text style={styles.submitText}>
                {createMut.isPending ? "Creating…" : "Create Request"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowForm(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  addBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  loader: { marginTop: 48 },
  list: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#f9fafb",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardDesc: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  slots: { fontSize: 13, color: "#374151", marginTop: 8 },
  cardActions: { flexDirection: "row", gap: 16, marginTop: 12 },
  actionLink: { fontSize: 13, color: "#0369a1", fontWeight: "600" },
  danger: { color: "#dc2626" },
  closedBadge: {
    marginTop: 8,
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 48 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  submitBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelText: { color: "#6b7280", fontSize: 15 },
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/mobile && npx jest outer-circle --no-coverage 2>&1 | tail -10
```
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/outer-circle/
git commit -m "feat(mobile): add outer circle screen with coordinator request management"
```

---

## Task 2: Care Brief Screen

**Files:**
- Create: `apps/mobile/app/(app)/care-brief/index.tsx`
- Create: `apps/mobile/app/(app)/care-brief/__tests__/index.test.tsx`

**API used:** `POST /api/brief` (bearer auth, returns `{ shareToken }`), no tRPC procedure.

- [ ] **Step 1: Write the failing test skeleton**

Create `apps/mobile/app/(app)/care-brief/__tests__/index.test.tsx`:

```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import CareBriefScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

global.fetch = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("CareBriefScreen", () => {
  it("renders Generate Brief button for coordinator", () => {
    const { getByText } = render(<CareBriefScreen />);
    expect(getByText("Generate Care Brief")).toBeTruthy();
  });

  it("hides Generate Brief for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { queryByText } = render(<CareBriefScreen />);
    expect(queryByText("Generate Care Brief")).toBeNull();
  });

  it("shows share URL after successful generation", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareToken: "tok123" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("Generate Care Brief"));
    await findByText(/tok123/);
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("Generate Care Brief"));
    await findByText(/Failed/);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/mobile && npx jest care-brief --no-coverage 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '../index'`

- [ ] **Step 3: Implement `care-brief/index.tsx`**

Create `apps/mobile/app/(app)/care-brief/index.tsx`:

```tsx
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useApp } from "../../../context/AppContext";
import { getSession } from "../../../utils/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type Brief = { shareToken: string; generatedAt: string };

export default function CareBriefScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const isCoordinator = currentRole === "coordinator";
  const [generating, setGenerating] = useState(false);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const session = await getSession();
    if (!session || !orgId || !recipientId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(API_URL + "/api/brief", {
        method: "POST",
        headers: {
          authorization: "Bearer " + session.access_token,
          "content-type": "application/json",
        },
        body: JSON.stringify({ orgId, recipientId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Generation failed");
      setBriefs((prev) => [
        { shareToken: body.shareToken, generatedAt: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate brief");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(shareToken: string) {
    const url = API_URL + "/brief/" + shareToken;
    await Clipboard.setStringAsync(url);
    Alert.alert("Link copied", url);
  }

  async function handleRevoke(shareToken: string) {
    const session = await getSession();
    if (!session) return;
    try {
      await fetch(API_URL + "/api/brief/" + shareToken + "/revoke", {
        method: "POST",
        headers: { authorization: "Bearer " + session.access_token },
      });
      setBriefs((prev) => prev.filter((b) => b.shareToken !== shareToken));
    } catch {
      Alert.alert("Error", "Could not revoke brief");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Care Brief</Text>
      <Text style={styles.subtitle}>
        Generate a shareable summary for doctors or specialists. No account required to view.
      </Text>

      {isCoordinator && (
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.disabled]}
          onPress={handleGenerate}
          disabled={generating}
          accessibilityRole="button"
          accessibilityLabel={generating ? "Generating" : "Generate Care Brief"}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateText}>Generate Care Brief</Text>
          )}
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {briefs.map((brief) => (
        <View key={brief.shareToken} style={styles.card}>
          <Text style={styles.cardDate}>
            Generated {new Date(brief.generatedAt).toLocaleDateString()}
          </Text>
          <Text style={styles.token} numberOfLines={1}>
            {API_URL}/brief/{brief.shareToken}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handleCopy(brief.shareToken)}
              accessibilityRole="button"
              accessibilityLabel="Copy link"
            >
              <Text style={styles.actionLink}>Copy link</Text>
            </TouchableOpacity>
            {isCoordinator && (
              <TouchableOpacity
                onPress={() => handleRevoke(brief.shareToken)}
                accessibilityRole="button"
                accessibilityLabel="Revoke"
              >
                <Text style={[styles.actionLink, styles.danger]}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {briefs.length === 0 && !generating && (
        <Text style={styles.empty}>No briefs generated yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  generateBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  generateText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: "#dc2626", fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#f9fafb",
    gap: 8,
  },
  cardDate: { fontSize: 12, color: "#9ca3af" },
  token: { fontSize: 12, color: "#374151", fontFamily: "monospace" },
  cardActions: { flexDirection: "row", gap: 16 },
  actionLink: { fontSize: 13, color: "#0369a1", fontWeight: "600" },
  danger: { color: "#dc2626" },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 32 },
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/mobile && npx jest care-brief --no-coverage 2>&1 | tail -10
```
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/care-brief/
git commit -m "feat(mobile): add care brief generation and share screen"
```

---

## Task 3: Benefits Navigator Screen

**Files:**
- Create: `apps/mobile/app/(app)/benefits/index.tsx`
- Create: `apps/mobile/app/(app)/benefits/__tests__/index.test.tsx`

**tRPC procedures:**
- `trpc.benefits.screen` — mutation, input: `{ org_id, recipient_id, answers: { age65plus, veteran, lowIncome, medicareEnrolled, medicaidEnrolled }, results: [] }` — saves screening + returns saved record
- `trpc.benefits.latest` — query, input: `{ org_id, recipient_id }` — returns last screening or null

**Eligibility logic lives client-side** (same as web `BenefitsNavigator.tsx`). You determine eligible programs from `answers`, then call `trpc.benefits.screen` to save with the computed `results`.

Eligible programs computation (copy from web or implement inline):
- `medicaid_waiver`: `answers.lowIncome && !answers.medicaidEnrolled`
- `snap`: `answers.lowIncome`
- `medicare_savings`: `answers.age65plus && answers.medicareEnrolled && answers.lowIncome`
- `va_caregiver`: `answers.veteran`
- `pace`: `answers.age65plus && answers.medicareEnrolled`

- [ ] **Step 1: Write the failing test skeleton**

Create `apps/mobile/app/(app)/benefits/__tests__/index.test.tsx`:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import BenefitsScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockScreen = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    benefits: {
      screen: {
        useMutation: jest.fn(() => ({ mutate: mockScreen, isPending: false })),
      },
      latest: {
        useQuery: jest.fn(() => ({ data: null, isLoading: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("BenefitsScreen", () => {
  it("renders screening questions", () => {
    const { getByText } = render(<BenefitsScreen />);
    expect(getByText(/Age 65/)).toBeTruthy();
    expect(getByText(/Veteran/)).toBeTruthy();
    expect(getByText(/Low income/)).toBeTruthy();
  });

  it("calls screen mutation on submit", () => {
    const { getByText } = render(<BenefitsScreen />);
    fireEvent.press(getByText("Check Eligibility"));
    expect(mockScreen).toHaveBeenCalled();
  });

  it("shows non-coordinator message for caregivers", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { getByText } = render(<BenefitsScreen />);
    expect(getByText(/coordinator/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/mobile && npx jest benefits --no-coverage 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '../index'`

- [ ] **Step 3: Implement `benefits/index.tsx`**

Create `apps/mobile/app/(app)/benefits/index.tsx`:

```tsx
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";

type Answers = {
  age65plus: boolean;
  veteran: boolean;
  lowIncome: boolean;
  medicareEnrolled: boolean;
  medicaidEnrolled: boolean;
};

type Program = {
  key: string;
  name: string;
  description: string;
  applyUrl: string;
};

const QUESTIONS: { key: keyof Answers; label: string }[] = [
  { key: "age65plus", label: "Age 65 or older" },
  { key: "veteran", label: "Veteran or surviving spouse" },
  { key: "lowIncome", label: "Low income household" },
  { key: "medicareEnrolled", label: "Enrolled in Medicare" },
  { key: "medicaidEnrolled", label: "Enrolled in Medicaid" },
];

const ALL_PROGRAMS: Program[] = [
  {
    key: "medicaid_waiver",
    name: "Medicaid HCBS Waiver",
    description: "Home and community-based services for low-income individuals not on Medicaid.",
    applyUrl: "https://www.medicaid.gov/medicaid/home-community-based-services/index.html",
  },
  {
    key: "snap",
    name: "SNAP Food Benefits",
    description: "Supplemental nutrition assistance for low-income households.",
    applyUrl: "https://www.fns.usda.gov/snap/apply",
  },
  {
    key: "medicare_savings",
    name: "Medicare Savings Program",
    description: "Helps pay Medicare premiums, deductibles, and copayments.",
    applyUrl: "https://www.medicare.gov/basics/costs/help/medicare-savings-programs",
  },
  {
    key: "va_caregiver",
    name: "VA Caregiver Support",
    description: "Support services for veterans and their family caregivers.",
    applyUrl: "https://www.caregiver.va.gov/",
  },
  {
    key: "pace",
    name: "PACE Program",
    description: "All-inclusive care for elderly Medicare/Medicaid enrollees.",
    applyUrl: "https://www.medicaid.gov/medicaid/ltss/pace/index.html",
  },
];

function computeEligible(answers: Answers): Program[] {
  return ALL_PROGRAMS.filter((p) => {
    if (p.key === "medicaid_waiver") return answers.lowIncome && !answers.medicaidEnrolled;
    if (p.key === "snap") return answers.lowIncome;
    if (p.key === "medicare_savings") return answers.age65plus && answers.medicareEnrolled && answers.lowIncome;
    if (p.key === "va_caregiver") return answers.veteran;
    if (p.key === "pace") return answers.age65plus && answers.medicareEnrolled;
    return false;
  });
}

export default function BenefitsScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const isCoordinator = currentRole === "coordinator";

  const [answers, setAnswers] = useState<Answers>({
    age65plus: false,
    veteran: false,
    lowIncome: false,
    medicareEnrolled: false,
    medicaidEnrolled: false,
  });
  const [results, setResults] = useState<Program[] | null>(null);

  const screenMut = trpc.benefits.screen.useMutation({
    onError: () => {},
  });

  const { data: latest } = trpc.benefits.latest.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId && isCoordinator },
  );

  if (!isCoordinator) {
    return (
      <View style={styles.locked}>
        <Text style={styles.lockedText}>
          Benefits screening is available to coordinators only.
        </Text>
      </View>
    );
  }

  function handleCheck() {
    const eligible = computeEligible(answers);
    setResults(eligible);
    const orgIdVal = orgId;
    const recipientIdVal = recipientId;
    if (!orgIdVal || !recipientIdVal) return;
    const answersSnap = answers;
    screenMut.mutate({
      org_id: orgIdVal,
      recipient_id: recipientIdVal,
      answers: answersSnap,
      results: eligible,
    });
  }

  function toggle(key: keyof Answers) {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Benefits Eligibility</Text>
      <Text style={styles.subtitle}>
        Answer questions about the care recipient to see which programs may apply.
      </Text>

      {QUESTIONS.map((q) => (
        <TouchableOpacity
          key={q.key}
          style={styles.questionRow}
          onPress={() => toggle(q.key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: answers[q.key] }}
          accessibilityLabel={q.label}
        >
          <View style={[styles.checkbox, answers[q.key] && styles.checkboxChecked]}>
            {answers[q.key] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.questionLabel}>{q.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.checkBtn, screenMut.isPending && styles.disabled]}
        onPress={handleCheck}
        disabled={screenMut.isPending}
        accessibilityRole="button"
        accessibilityLabel="Check Eligibility"
      >
        {screenMut.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.checkBtnText}>Check Eligibility</Text>
        )}
      </TouchableOpacity>

      {results !== null && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsHeading}>
            {results.length > 0
              ? `${results.length} program${results.length === 1 ? "" : "s"} may apply`
              : "No programs matched"}
          </Text>
          {results.map((p) => (
            <View key={p.key} style={styles.programCard}>
              <Text style={styles.programName}>{p.name}</Text>
              <Text style={styles.programDesc}>{p.description}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(p.applyUrl)}
                accessibilityRole="link"
                accessibilityLabel={"Apply for " + p.name}
              >
                <Text style={styles.applyLink}>Learn more →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  questionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#0369a1", borderColor: "#0369a1" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  questionLabel: { fontSize: 15, color: "#111827" },
  checkBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  disabled: { opacity: 0.4 },
  checkBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  resultsSection: { gap: 12 },
  resultsHeading: { fontSize: 16, fontWeight: "700", color: "#111827" },
  programCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: "#f0fdf4",
  },
  programName: { fontSize: 15, fontWeight: "700", color: "#166534" },
  programDesc: { fontSize: 13, color: "#374151", lineHeight: 18 },
  applyLink: { fontSize: 13, color: "#0369a1", fontWeight: "600" },
  locked: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  lockedText: { fontSize: 15, color: "#6b7280", textAlign: "center" },
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/mobile && npx jest benefits --no-coverage 2>&1 | tail -10
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/benefits/
git commit -m "feat(mobile): add benefits eligibility navigator"
```

---

## Task 4: EOL Planner Screen

**Files:**
- Create: `apps/mobile/app/(app)/eol-planner/index.tsx`
- Create: `apps/mobile/app/(app)/eol-planner/__tests__/index.test.tsx`

**tRPC procedures:**
- `trpc.eolPlan.get` — query, input: `{ org_id, recipient_id }` — coordinator only, returns plan or null
- `trpc.eolPlan.upsert` — mutation, input has fields for healthcare proxy, resuscitation preference, organ donation, funeral wishes, notes, advance_directive_document_id

Read `apps/web/server/routers/eolPlan.ts` to confirm the full `eolPlanUpsertInput` shape before implementing. The key fields are: `org_id`, `recipient_id`, `healthcare_proxy_name`, `healthcare_proxy_contact`, `resuscitation_preference` (string), `organ_donation` (boolean), `funeral_wishes` (string), `notes` (string), `advance_directive_document_id` (uuid or null).

- [ ] **Step 1: Confirm upsert input shape**

```bash
grep -A 20 "eolPlanUpsertInput" /Users/bradygrapentine/Documents/projects/carelog/packages/schemas/src/index.ts | head -25
```

- [ ] **Step 2: Write the failing test skeleton**

Create `apps/mobile/app/(app)/eol-planner/__tests__/index.test.tsx`:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import EolPlannerScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockUpsert = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    eolPlan: {
      get: {
        useQuery: jest.fn(() => ({ data: null, isLoading: false })),
      },
      upsert: {
        useMutation: jest.fn(() => ({ mutate: mockUpsert, isPending: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("EolPlannerScreen", () => {
  it("renders form fields", () => {
    const { getByPlaceholderText } = render(<EolPlannerScreen />);
    expect(getByPlaceholderText(/Healthcare proxy name/i)).toBeTruthy();
  });

  it("shows invisible/locked state for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { getByText } = render(<EolPlannerScreen />);
    expect(getByText(/coordinator/i)).toBeTruthy();
  });

  it("calls upsert on save", () => {
    const { getByText } = render(<EolPlannerScreen />);
    fireEvent.press(getByText("Save"));
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("pre-fills form from existing plan", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.eolPlan.get.useQuery.mockReturnValueOnce({
      data: {
        healthcare_proxy_name: "Jane Doe",
        healthcare_proxy_contact: "555-1234",
        resuscitation_preference: "DNR",
        organ_donation: false,
        funeral_wishes: "",
        notes: "",
      },
      isLoading: false,
    });
    const { getByDisplayValue } = render(<EolPlannerScreen />);
    expect(getByDisplayValue("Jane Doe")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd apps/mobile && npx jest eol-planner --no-coverage 2>&1 | tail -10
```

- [ ] **Step 4: Confirm the upsert schema fields** (from step 1 output), then implement `eol-planner/index.tsx` following this structure:

```tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";

export default function EolPlannerScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const isCoordinator = currentRole === "coordinator";

  const [proxyName, setProxyName] = useState("");
  const [proxyContact, setProxyContact] = useState("");
  const [resuscitationPref, setResuscitationPref] = useState("");
  const [organDonation, setOrganDonation] = useState(false);
  const [funeralWishes, setFuneralWishes] = useState("");
  const [notes, setNotes] = useState("");

  const { data: existing } = trpc.eolPlan.get.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId && isCoordinator },
  );

  useEffect(() => {
    if (!existing) return;
    setProxyName(existing.healthcare_proxy_name ?? "");
    setProxyContact(existing.healthcare_proxy_contact ?? "");
    setResuscitationPref(existing.resuscitation_preference ?? "");
    setOrganDonation(existing.organ_donation ?? false);
    setFuneralWishes(existing.funeral_wishes ?? "");
    setNotes(existing.notes ?? "");
  }, [existing]);

  const upsertMut = trpc.eolPlan.upsert.useMutation({
    onSuccess: () => Alert.alert("Saved"),
    onError: (err) => Alert.alert("Error", err.message),
  });

  if (!isCoordinator) {
    return (
      <View style={styles.locked}>
        <Text style={styles.lockedText}>
          End-of-life planning is only accessible to coordinators.
        </Text>
      </View>
    );
  }

  function handleSave() {
    const orgIdVal = orgId;
    const recipientIdVal = recipientId;
    if (!orgIdVal || !recipientIdVal) return;
    const proxyNameSnap = proxyName;
    const proxyContactSnap = proxyContact;
    const resuscitationPrefSnap = resuscitationPref;
    const organDonationSnap = organDonation;
    const funeralWishesSnap = funeralWishes;
    const notesSnap = notes;
    upsertMut.mutate({
      org_id: orgIdVal,
      recipient_id: recipientIdVal,
      healthcare_proxy_name: proxyNameSnap,
      healthcare_proxy_contact: proxyContactSnap,
      resuscitation_preference: resuscitationPrefSnap,
      organ_donation: organDonationSnap,
      funeral_wishes: funeralWishesSnap,
      notes: notesSnap,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>End-of-Life Planning</Text>
      <Text style={styles.subtitle}>
        This information is private and only visible to coordinators.
      </Text>

      <Text style={styles.fieldLabel}>Healthcare proxy name</Text>
      <TextInput
        style={styles.input}
        placeholder="Healthcare proxy name"
        value={proxyName}
        onChangeText={setProxyName}
        accessibilityLabel="Healthcare proxy name"
      />

      <Text style={styles.fieldLabel}>Proxy contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Phone or email"
        value={proxyContact}
        onChangeText={setProxyContact}
        accessibilityLabel="Proxy contact"
      />

      <Text style={styles.fieldLabel}>Resuscitation preference</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. DNR, Full code"
        value={resuscitationPref}
        onChangeText={setResuscitationPref}
        accessibilityLabel="Resuscitation preference"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Organ donation</Text>
        <Switch
          value={organDonation}
          onValueChange={setOrganDonation}
          accessibilityLabel="Organ donation"
        />
      </View>

      <Text style={styles.fieldLabel}>Funeral wishes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any known preferences"
        value={funeralWishes}
        onChangeText={setFuneralWishes}
        multiline
        numberOfLines={3}
        accessibilityLabel="Funeral wishes"
      />

      <Text style={styles.fieldLabel}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Additional notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        accessibilityLabel="Notes"
      />

      <TouchableOpacity
        style={[styles.saveBtn, upsertMut.isPending && styles.disabled]}
        onPress={handleSave}
        disabled={upsertMut.isPending}
        accessibilityRole="button"
        accessibilityLabel="Save"
      >
        {upsertMut.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: { fontSize: 15, color: "#111827" },
  saveBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  disabled: { opacity: 0.4 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  locked: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  lockedText: { fontSize: 15, color: "#6b7280", textAlign: "center" },
});
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd apps/mobile && npx jest eol-planner --no-coverage 2>&1 | tail -10
```
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(app\)/eol-planner/
git commit -m "feat(mobile): add EOL planner screen for coordinators"
```

---

## Task 5: Wire New Screens into Navigation

**Files:**
- Modify: `apps/mobile/app/(app)/more/index.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Add 4 items to More grid**

In `apps/mobile/app/(app)/more/index.tsx`, update the `ITEMS` array:

```tsx
const ITEMS = [
  { title: "Symptoms", route: "/symptoms" as const, icon: "🩺" },
  { title: "Burnout", route: "/burnout" as const, icon: "🔋" },
  { title: "Expenses", route: "/expenses" as const, icon: "💰" },
  { title: "Documents", route: "/documents" as const, icon: "📄" },
  { title: "Volunteer Requests", route: "/outer-circle" as const, icon: "🤝" },
  { title: "Care Brief", route: "/care-brief" as const, icon: "📋" },
  { title: "Benefits", route: "/benefits" as const, icon: "🏥" },
  { title: "End-of-Life", route: "/eol-planner" as const, icon: "📝" },
];
```

- [ ] **Step 2: Register new screens in `_layout.tsx`**

Add 4 new `<Tabs.Screen>` entries (with `href: null`) inside the `<Tabs>` component after the existing hidden screens:

```tsx
<Tabs.Screen name="outer-circle/index" options={{ href: null }} />
<Tabs.Screen name="care-brief/index" options={{ href: null }} />
<Tabs.Screen name="benefits/index" options={{ href: null }} />
<Tabs.Screen name="eol-planner/index" options={{ href: null }} />
```

- [ ] **Step 3: Run existing tests to confirm no regressions**

```bash
cd apps/mobile && npx jest --no-coverage 2>&1 | tail -10
```
Expected: all existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/more/index.tsx apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): wire outer circle, care brief, benefits, EOL into More tab"
```

---

## Task 6: Missing Test Skeletons for Existing Screens

**Files to create** (screens exist, tests don't):
- `apps/mobile/app/(app)/expenses/__tests__/index.test.tsx`
- `apps/mobile/app/(app)/expenses/__tests__/add.test.tsx`
- `apps/mobile/app/(app)/burnout/__tests__/checkin.test.tsx`
- `apps/mobile/app/(app)/burnout/__tests__/summary.test.tsx`
- `apps/mobile/app/(app)/symptoms/__tests__/log.test.tsx`
- `apps/mobile/app/(app)/documents/__tests__/index.test.tsx`

Read each screen file before writing its test. Use `symptoms/__tests__/index.test.tsx` as the pattern template.

- [ ] **Step 1: Read existing screens to understand their props/structure**

```bash
# Read each screen before writing its test:
# expenses/index.tsx — SectionList, groupByMonth, formatCurrency, canLogExpense
# expenses/add.tsx — form: amount, category, date, description
# burnout/checkin.tsx — form with numeric inputs for sleep/stress/support scores
# burnout/summary.tsx — org summary display
# symptoms/log.tsx — form with pain_level, mood, appetite, mobility, notes
# documents/index.tsx — FlatList, upload modal, camera/file picker
```

- [ ] **Step 2: Write `expenses/__tests__/index.test.tsx`**

```tsx
import { render } from "@testing-library/react-native";
import ExpensesScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "coordinator" }),
}));

const mockExpenses = [
  {
    id: "e1",
    amount: 4250,
    category: "medication",
    description: "Lisinopril refill",
    incurred_at: "2026-04-01T10:00:00Z",
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    expenses: {
      list: {
        useQuery: jest.fn(() => ({ data: mockExpenses, isLoading: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("ExpensesScreen", () => {
  it("renders expense list grouped by month", () => {
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText("Lisinopril refill")).toBeTruthy();
  });

  it("renders empty state when no expenses", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.expenses.list.useQuery.mockReturnValueOnce({ data: [], isLoading: false });
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText(/No expenses/)).toBeTruthy();
  });

  it("shows Add Expense button for eligible roles", () => {
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText("Add Expense")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Write `expenses/__tests__/add.test.tsx`**

Read `apps/mobile/app/(app)/expenses/add.tsx` first to confirm field names and mutation procedure, then write:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import AddExpenseScreen from "../add";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "coordinator" }),
}));

const mockAdd = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    expenses: {
      add: {
        useMutation: jest.fn(() => ({ mutate: mockAdd, isPending: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("AddExpenseScreen", () => {
  it("renders amount and description inputs", () => {
    const { getByPlaceholderText } = render(<AddExpenseScreen />);
    expect(getByPlaceholderText(/amount/i)).toBeTruthy();
  });

  it("calls add mutation on submit", () => {
    const { getByText, getByPlaceholderText } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByPlaceholderText(/amount/i), "42.50");
    fireEvent.press(getByText("Add Expense"));
    expect(mockAdd).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Write `burnout/__tests__/checkin.test.tsx`**

Read `apps/mobile/app/(app)/burnout/checkin.tsx` first, then write:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import BurnoutCheckinScreen from "../checkin";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "caregiver" }),
}));

const mockCheckIn = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      checkIn: {
        useMutation: jest.fn(() => ({ mutate: mockCheckIn, isPending: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("BurnoutCheckinScreen", () => {
  it("renders check-in form", () => {
    const { getByText } = render(<BurnoutCheckinScreen />);
    expect(getByText(/sleep/i)).toBeTruthy();
    expect(getByText(/stress/i)).toBeTruthy();
  });

  it("calls checkIn mutation on submit", () => {
    const { getByText } = render(<BurnoutCheckinScreen />);
    fireEvent.press(getByText(/submit/i));
    expect(mockCheckIn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Write `burnout/__tests__/summary.test.tsx`**

Read `apps/mobile/app/(app)/burnout/summary.tsx` first, then write:

```tsx
import { render } from "@testing-library/react-native";
import BurnoutSummaryScreen from "../summary";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "coordinator" }),
}));

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      orgSummary: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false })),
      },
      myHistory: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("BurnoutSummaryScreen", () => {
  it("renders without crash", () => {
    expect(() => render(<BurnoutSummaryScreen />)).not.toThrow();
  });

  it("shows empty state when no check-ins", () => {
    const { getByText } = render(<BurnoutSummaryScreen />);
    expect(getByText(/no check-ins/i)).toBeTruthy();
  });
});
```

- [ ] **Step 6: Write `symptoms/__tests__/log.test.tsx`**

Read `apps/mobile/app/(app)/symptoms/log.tsx` first, then write:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import SymptomsLogScreen from "../log";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "caregiver" }),
}));

const mockLog = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    symptoms: {
      log: {
        useMutation: jest.fn(() => ({ mutate: mockLog, isPending: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("SymptomsLogScreen", () => {
  it("renders log form", () => {
    const { getByText } = render(<SymptomsLogScreen />);
    expect(getByText(/log/i)).toBeTruthy();
  });

  it("calls log mutation on submit", () => {
    const { getByText } = render(<SymptomsLogScreen />);
    fireEvent.press(getByText(/save/i));
    expect(mockLog).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Write `documents/__tests__/index.test.tsx`**

```tsx
import { render } from "@testing-library/react-native";
import DocumentsScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1", currentRole: "coordinator" }),
}));

jest.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

const mockDocuments = [
  {
    id: "doc-1",
    display_name: "Lab results.pdf",
    doc_type: "lab_result",
    file_size: 204800,
    created_at: "2026-04-01T10:00:00Z",
  },
];

const mockDelete = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    documents: {
      list: {
        useQuery: jest.fn(() => ({ data: mockDocuments, isLoading: false, refetch: jest.fn() })),
      },
      delete: {
        useMutation: jest.fn(() => ({ mutate: mockDelete })),
      },
    },
  },
}));

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

beforeEach(() => jest.clearAllMocks());

describe("DocumentsScreen", () => {
  it("renders document list", () => {
    const { getByText } = render(<DocumentsScreen />);
    expect(getByText("Lab results.pdf")).toBeTruthy();
  });

  it("renders empty state when no documents", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.documents.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<DocumentsScreen />);
    expect(getByText("No documents yet.")).toBeTruthy();
  });

  it("shows upload FAB for coordinator", () => {
    const { getByLabelText } = render(<DocumentsScreen />);
    expect(getByLabelText("Upload document")).toBeTruthy();
  });
});
```

- [ ] **Step 8: Run all new tests**

```bash
cd apps/mobile && npx jest --no-coverage 2>&1 | tail -15
```
Expected: all pass (some skeletons may need minor adjustments based on actual screen implementations — fix any mismatch)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/\(app\)/expenses/__tests__/ \
        apps/mobile/app/\(app\)/burnout/__tests__/ \
        apps/mobile/app/\(app\)/symptoms/__tests__/ \
        apps/mobile/app/\(app\)/documents/__tests__/
git commit -m "test(mobile): add Jest skeletons for expenses, burnout, symptoms, documents screens"
```

---

## Self-Review Checklist

- [x] Outer circle: list, create, deactivate, copy link — all covered
- [x] Care brief: generate, copy link, revoke — all covered
- [x] Benefits: all 5 programs, coordinator-only guard, form submit — covered
- [x] EOL planner: read existing, edit, save, coordinator-only guard — covered
- [x] More screen: 8 items (4 existing + 4 new) — covered
- [x] Layout: 4 new screen registrations — covered
- [x] Existing screen tests: expenses (2 files), burnout (2 files), symptoms (1 file), documents (1 file) — covered
- [x] All tasks have complete code blocks, no TBDs
- [x] Form pattern matches CLAUDE.md: read all form values before any `await` — applied in Tasks 1, 3, 4
- [x] No template literals in JSX props — verified
