import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { askLocal, cancelRequest, listLocalModels, newRequestId, onEngineEvent } from "@/lib/ipc";
import type { ChatTurn, GenderModel, OrganContext, UserProfile } from "@/lib/schemas";
import { useLocalChatStore, type LocalMessage } from "@/stores/localChatStore";
import { useSceneStore } from "@/stores/sceneStore";

export interface OllamaSessionOptions {
  open: boolean;
  engineReady: boolean;
  profile: UserProfile;
  genderModel: GenderModel;
}

function buildTurnHistory(messages: readonly LocalMessage[]): ChatTurn[] {
  const history: ChatTurn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q?.role === "user" && a?.role === "assistant" && a.status === "done") {
      history.push({ role: "user", content: q.content });
      history.push({ role: "assistant", content: a.content });
    }
  }
  return history.slice(-50);
}

export function useOllamaSession({
  open,
  engineReady,
  profile,
  genderModel,
}: OllamaSessionOptions) {
  const store = useLocalChatStore();
  const { model, models, status, statusDetail, messages, pendingId } = store;

  const organs = useSceneStore((s) => s.organs);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);

  const [inputQuery, setInputQuery] = useState("");
  const listingRequestId = useRef<string | null>(null);

  // Subscribe to engine IPC when panel opens
  useEffect(() => {
    if (!open) return;

    let cleanupFn: (() => void) | undefined;
    let isSubscribed = true;

    async function initSubscription() {
      cleanupFn = await onEngineEvent((event) => {
        if (!isSubscribed) return;

        if (event.type === "local_models") {
          if (event.request_id === listingRequestId.current) {
            useLocalChatStore
              .getState()
              .receiveModels(event.running, event.running ? event.models : []);
          }
        } else if (event.type === "text_delta") {
          useLocalChatStore.getState().append(event.request_id, event.text);
        } else if (event.type === "done") {
          useLocalChatStore.getState().finish(event.request_id, event.model ?? "");
        } else if (event.type === "error") {
          const reqId = event.request_id ?? useLocalChatStore.getState().pendingId ?? "";
          if (reqId) {
            useLocalChatStore.getState().fail(reqId, event.message ?? "Unknown error");
          }
        }
      });

      const reqId = "local-" + newRequestId();
      listingRequestId.current = reqId;
      await listLocalModels({ request_id: reqId });
    }

    initSubscription();

    return () => {
      isSubscribed = false;
      cleanupFn?.();
    };
  }, [open]);

  // Active selections in atlas
  const activeSelectionContext = useMemo((): OrganContext[] => {
    return selectedOrganIds
      .map((id) => organs[id])
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => ({
        organ_id: o.organ_id,
        ta2_latin: o.ta2_latin,
        name_en: o.name_en,
        system: o.system,
      }));
  }, [selectedOrganIds, organs]);

  // Submit query
  const submitTurn = useCallback(async () => {
    const text = inputQuery.trim();
    if (!text || !model || pendingId !== null) return;

    const reqId = "local-" + newRequestId();
    const historyTurns = buildTurnHistory(messages);

    useLocalChatStore.getState().begin(reqId, text);
    setInputQuery("");

    await askLocal({
      request_id: reqId,
      query: text,
      history: historyTurns,
      model,
      profile,
      gender_model: genderModel,
      selection: activeSelectionContext,
    });
  }, [inputQuery, model, pendingId, messages, profile, genderModel, activeSelectionContext]);

  // Cancel streaming
  const cancelTurn = useCallback(async () => {
    if (!pendingId) return;
    await cancelRequest(pendingId);
    useLocalChatStore.getState().fail(pendingId, "Cancelled");
  }, [pendingId]);

  return {
    model,
    models,
    status,
    statusDetail,
    messages,
    pendingId,
    inputQuery,
    setInputQuery,
    submitTurn,
    cancelTurn,
    engineReady,
  };
}
