import { createDemoAdapter } from "owlagents/adapters/demo";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import {
  selectCapabilities,
  selectMissingCapabilities,
} from "owlagents/selectors/catalog";
import { OWLAGENTS_APP_IDS, OWLAGENTS_REGISTRY } from "owlagents/registry";
import { createServices } from "owlagents/services";

const snapshot = createDemoSnapshot();

describe("capabilities are declared and enforceable", () => {
  /**
   * Adapters may not import the registry, so the demo capability list is
   * maintained by hand. This is the test that stops the two drifting.
   */
  test("the operator holds every capability the sixteen applications declare", () => {
    const declared = new Set(
      OWLAGENTS_APP_IDS.flatMap(
        (id) => OWLAGENTS_REGISTRY[id].requiredCapabilities
      )
    );

    expect(
      [...declared].filter(
        (capability) => !snapshot.capabilities.includes(capability)
      )
    ).toStrictEqual([]);
  });

  test("no application is gated by default", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(
        selectMissingCapabilities(OWLAGENTS_REGISTRY[id].requiredCapabilities)(
          snapshot
        )
      ).toStrictEqual([])
    ));

  test("a missing capability is named, not just refused", () =>
    expect(
      selectMissingCapabilities(["policy.read", "nonsense.read"])(snapshot)
    ).toStrictEqual(["nonsense.read"]));

  test("an application with no declared capabilities is never gated", () =>
    expect(selectMissingCapabilities([])(snapshot)).toStrictEqual([]));
});

describe("revoking a capability gates its application", () => {
  test("simulateDeniedPermission removes policy.read", async () => {
    const adapter = createDemoAdapter({
      now: () => "2026-07-28T16:00:00.000Z",
    });
    const services = createServices(adapter);

    expect(selectCapabilities(adapter.readSnapshot())).toContain("policy.read");

    await services.scenarioService.run("simulateDeniedPermission");

    const after = adapter.readSnapshot();

    expect(selectCapabilities(after)).not.toContain("policy.read");
    expect(
      selectMissingCapabilities(
        OWLAGENTS_REGISTRY.PolicyInspector.requiredCapabilities
      )(after)
    ).toStrictEqual(["policy.read"]);
  });

  test("it gates only the application that needs it", async () => {
    const adapter = createDemoAdapter({
      now: () => "2026-07-28T16:00:00.000Z",
    });
    const services = createServices(adapter);

    await services.scenarioService.run("simulateDeniedPermission");

    const after = adapter.readSnapshot();

    expect(
      selectMissingCapabilities(
        OWLAGENTS_REGISTRY.MissionControl.requiredCapabilities
      )(after)
    ).toStrictEqual([]);
  });

  test("reset restores the full capability set", async () => {
    const adapter = createDemoAdapter({
      now: () => "2026-07-28T16:00:00.000Z",
    });
    const services = createServices(adapter);

    await services.scenarioService.run("simulateDeniedPermission");
    await services.scenarioService.run("reset");

    expect(selectCapabilities(adapter.readSnapshot())).toContain("policy.read");
  });
});
