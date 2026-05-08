import { flow01 } from "./flow-01";
import { flow02 } from "./flow-02";
import { flow03 } from "./flow-03";
import { flow04 } from "./flow-04";
import { flow05 } from "./flow-05";
import type { PartnerFlow } from "./types";

export const allPartnerFlows: PartnerFlow[] = [flow01, flow02, flow03, flow04, flow05];

export function getFlowBySlug(slug: string): PartnerFlow | undefined {
  return allPartnerFlows.find((f) => f.slug === slug);
}

export function getFlowById(id: number): PartnerFlow | undefined {
  return allPartnerFlows.find((f) => f.id === id);
}

export type { PartnerFlow } from "./types";
export type {
  ModelType,
  FlowType,
  Actor,
  ControlOwnership,
  ControlItem,
  DataField,
  RACIEntry,
  PreLaunchCondition,
  GovernancePackItem,
} from "./types";
