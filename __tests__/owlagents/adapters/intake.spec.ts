import { createDemoAdapter } from "owlagents/adapters/demo";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import {
  type CommandEnvelope,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import { INTAKE_STAGES } from "owlagents/domain/authority";

const NOW = "2026-07-28T16:00:00.000Z";
const HASH = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";

const setup = (): OwlAgentsAdapter => createDemoAdapter({ now: () => NOW });

const ingest = (
  overrides: Partial<{
    hash: string;
    name: string;
    path: string;
    projectId: string;
    size: number;
  }> = {}
): CommandEnvelope => {
  const projectId = overrides.projectId ?? "PRJ-001";
  const hash = overrides.hash ?? HASH;

  return {
    actorId: "operator",
    command: {
      hash,
      kind: "source.ingest",
      name: overrides.name ?? "dropped-note.md",
      path: overrides.path ?? `/OwlAgents/Sources/${projectId}/dropped-note.md`,
      projectId,
      size: overrides.size ?? 2048,
    },
    idempotencyKey: `source.ingest:${projectId}:${hash}`,
    permissionScope: "source.intake",
    requestedAt: 0,
  };
};

const advance = (id: string, seq: number): CommandEnvelope => ({
  actorId: "runtime",
  command: { id, kind: "source.advanceIntake" },
  idempotencyKey: `source.advanceIntake:${id}:${seq}`,
  permissionScope: "source.intake",
  requestedAt: 0,
});

describe("a dropped file is not authoritative on arrival", () => {
  test("ingest creates a source at the first stage, not at ready", async () => {
    const adapter = setup();
    const result = await adapter.applyCommand(ingest());
    const created = result.ok ? result.data.objectId : "";
    const source = adapter.readSnapshot().sources[created];

    expect(result.ok).toBe(true);
    expect(source?.intakeStage).toBe("received");
    expect(source?.authority).toBe("raw");
  });

  test("the id is sequential and never reuses an existing one", async () => {
    const adapter = setup();
    const before = Object.keys(createDemoSnapshot().sources);
    const result = await adapter.applyCommand(ingest());

    expect(before).not.toContain(result.ok ? result.data.objectId : "");
    expect(result.ok ? result.data.objectId : "").toBe("SRC-0149");
  });

  test("the measured hash is stored, not a placeholder", async () => {
    const adapter = setup();
    const result = await adapter.applyCommand(ingest());
    const created = result.ok ? result.data.objectId : "";

    expect(adapter.readSnapshot().sources[created]?.hash).toBe(HASH);
    expect(adapter.readSnapshot().sources[created]?.hashAlgorithm).toBe(
      "sha256"
    );
  });

  test("arrival appends a ledger event that says it is not yet authoritative", async () => {
    const adapter = setup();

    await adapter.applyCommand(ingest());

    const [event] = adapter.readSnapshot().ledger;

    expect(event?.eventType).toBe("source.received");
    expect(event?.message).toContain("not yet authoritative");
  });

  test("dropping the same bytes into the same project twice is one intake", async () => {
    const adapter = setup();

    const first = await adapter.applyCommand(ingest());
    const count = Object.keys(adapter.readSnapshot().sources).length;
    const second = await adapter.applyCommand(ingest());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.ok ? undefined : second.error.code).toBe("duplicate_request");
    expect(Object.keys(adapter.readSnapshot().sources)).toHaveLength(count);
  });

  test("a source cannot be ingested into a project that does not exist", async () => {
    const result = await setup().applyCommand(ingest({ projectId: "PRJ-999" }));

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("not_found");
  });

  test("ingest is refused without the intake scope", async () => {
    const result = await setup().applyCommand({
      ...ingest(),
      permissionScope: "source.nonsense",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("permission_denied");
  });
});

describe("intake walks every stage in order", () => {
  test("each advance is one committed transition with its own event", async () => {
    const adapter = setup();
    const created = await adapter.applyCommand(ingest());
    const id = created.ok ? created.data.objectId : "";
    const seen: string[] = ["received"];
    const ledgerAtStart = adapter.readSnapshot().ledger.length;

    for (let step = 0; step < 6; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.applyCommand(advance(id, step));
      seen.push(adapter.readSnapshot().sources[id]?.intakeStage ?? "?");
    }

    expect(seen).toStrictEqual([...INTAKE_STAGES].slice(0, 7));
    expect(adapter.readSnapshot().ledger).toHaveLength(ledgerAtStart + 6);
  });

  test("it stops at ready and refuses to go further", async () => {
    const adapter = setup();
    const created = await adapter.applyCommand(ingest());
    const id = created.ok ? created.data.objectId : "";

    for (let step = 0; step < 6; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.applyCommand(advance(id, step));
    }

    const extra = await adapter.applyCommand(advance(id, 99));

    expect(adapter.readSnapshot().sources[id]?.intakeStage).toBe("ready");
    expect(extra.ok).toBe(false);
    expect(extra.ok ? undefined : extra.error.code).toBe("stale_state");
  });

  test("the policy stage names the rule it was checked against", async () => {
    const adapter = setup();
    const created = await adapter.applyCommand(ingest());
    const id = created.ok ? created.data.objectId : "";

    for (let step = 0; step < 6; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.applyCommand(advance(id, step));
    }

    expect(
      adapter
        .readSnapshot()
        .ledger.some((event) => event.message.includes("POL-002"))
    ).toBe(true);
  });
});
