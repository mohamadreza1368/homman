import type { AiProvider, GenderModel, Language, SessionMode, UserProfile } from "@/lib/schemas";

export interface TurnScope {
  sessionId: string;
  sessionRevision: number;
  mode: SessionMode;
  genderModel: GenderModel;
  caseId: string | null;
}

export interface TurnContext extends TurnScope {
  provider: AiProvider;
  model: string | null;
  profile: UserProfile;
  language: Language;
  organIds: readonly string[];
  title: string;
}

export type SpendContext = Pick<TurnContext, "sessionId" | "provider">;

export type TurnRegistryEntry =
  | { active: true; context: Readonly<TurnContext>; sent: boolean }
  | { active: false; context: Readonly<SpendContext>; sent: true };

/**
 * Checks equality of session routing scope across dialogue turns.
 */
export function sameTurnScope(first: TurnScope, second: TurnScope): boolean {
  return (
    first.sessionId === second.sessionId &&
    first.sessionRevision === second.sessionRevision &&
    first.mode === second.mode &&
    first.genderModel === second.genderModel &&
    first.caseId === second.caseId
  );
}

/**
 * Manages conversation request turn lifecycles, ensuring thread safety, scope matching,
 * cost attribution persistence, and orderly invalidation upon session navigation.
 */
export class TurnRegistry {
  private records = new Map<string, TurnRegistryEntry>();
  private activeId: string | null = null;

  constructor(
    private readonly currentScopeProvider: () => TurnScope,
    private readonly handleInvalidate: (id: string, wasDispatched: boolean) => void,
  ) {}

  begin(turnId: string, turnContext: TurnContext): void {
    this.invalidate();

    const immutableSnapshot: TurnContext = Object.freeze({
      ...turnContext,
      organIds: Object.freeze([...turnContext.organIds]),
    });

    this.records.set(turnId, {
      active: true,
      context: immutableSnapshot,
      sent: false,
    });
    this.activeId = turnId;
  }

  checkScope = (): void => {
    if (!this.activeId) return;

    const item = this.records.get(this.activeId);
    if (item && item.active) {
      const activeScope = this.currentScopeProvider();
      if (!sameTurnScope(item.context, activeScope)) {
        this.invalidate();
      }
    }
  };

  accepts(turnId: string): boolean {
    this.checkScope();
    return this.activeId === turnId && this.records.get(turnId)?.active === true;
  }

  markSent(turnId: string): boolean {
    if (!this.accepts(turnId)) {
      return false;
    }
    const item = this.records.get(turnId);
    if (item) {
      item.sent = true;
    }
    return true;
  }

  invalidate(turnId: string | null = this.activeId): void {
    if (!turnId) return;

    const item = this.records.get(turnId);
    if (!item || !item.active) return;

    if (this.activeId === turnId) {
      this.activeId = null;
    }

    if (!item.sent) {
      this.records.delete(turnId);
    } else {
      const minimalProvenance: SpendContext = Object.freeze({
        sessionId: item.context.sessionId,
        provider: item.context.provider,
      });

      this.records.set(turnId, {
        active: false,
        sent: true,
        context: minimalProvenance,
      });
    }

    this.handleInvalidate(turnId, item.sent);
  }

  take(turnId: string): TurnRegistryEntry | undefined {
    this.checkScope();
    const entry = this.records.get(turnId);
    this.records.delete(turnId);
    if (this.activeId === turnId) {
      this.activeId = null;
    }
    return entry;
  }
}
