"use client";

import { AtlasView } from "@/components/atlas";
import type { LpRecord } from "@/lib/api";

/**
 * A real record for the dev preview: canopy-be's answer for the team wallet,
 * captured on 2026-09-16. The live page asks canopy-be; this only
 * saves the preview from needing a session and a running backend.
 */
const FIXTURE: LpRecord = {
  "address": "CK2TVHYorRwobV2VqHncHp3kKD4NKJMdkPATtFxq7kAh",
  "pairs": [
    "biketyson/SOL",
    "KNOTS/SOL",
    "STONK/SOL",
    "baton/SOL"
  ],
  "venue": "Meteora DLMM",
  "startedAt": "2026-09-10T08:13:24.000Z",
  "asOf": "2026-09-16T18:42:08.000Z",
  "daysLive": 7,
  "depositedUsd": 1062.084466515151,
  "withdrawnUsd": 201.25277340202368,
  "valueUsd": 1094.8822719857121,
  "valueSol": 11.133761223338078,
  "netReturnPct": 22.036908198133972,
  "netReturnSolPct": 25.083440222267416,
  "pnlUsd": 234.05057887258477,
  "feesUsd": 537.3219374005623,
  "openPositions": 1,
  "positionsOpened": 18,
  "actions": 120,
  "series": [
    {
      "t": "2026-09-11T00:00:00.000Z",
      "pnlUsd": -23.452560313597587
    },
    {
      "t": "2026-09-12T00:00:00.000Z",
      "pnlUsd": 21.668329723437637
    },
    {
      "t": "2026-09-13T00:00:00.000Z",
      "pnlUsd": 50.560819507453516
    },
    {
      "t": "2026-09-14T00:00:00.000Z",
      "pnlUsd": 28.24158764881031
    },
    {
      "t": "2026-09-15T00:00:00.000Z",
      "pnlUsd": 154.59262982152381
    },
    {
      "t": "2026-09-16T00:00:00.000Z",
      "pnlUsd": 139.8329428742769
    },
    {
      "t": "2026-09-16T18:42:08.000Z",
      "pnlUsd": 234.05057887258477
    }
  ]
};

export function AtlasPreview() {
  return <AtlasView record={{ phase: "ready", data: FIXTURE, reload: () => {} }} />;
}
