import type { GenderModel, SessionMode, UserProfile } from "@/lib/schemas";
import {
  buildCustomSystemPrompt,
  streamCustomChat,
  type CustomHistoryTurn,
} from "./customApiClient";
import type { TurnRegistry } from "./turnRegistry";
import { useSceneStore } from "@/stores/sceneStore";
import { useChatStore } from "@/stores/chatStore";

export interface CustomStreamOptions {
  newTurnId: string;
  rawQuery: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isPersian: boolean;
  profile: UserProfile;
  genderModel: GenderModel;
  mode: SessionMode;
  selectedOrgansList: Array<{ organ_id: string; ta2_latin: string; name_en: string; system: string }>;
  organCount: number;
  history: CustomHistoryTurn[];
  turns: TurnRegistry;
  onVerdict?: (score: number, verdict: string) => void;
  signal?: AbortSignal;
}

export async function runCustomChatStream({
  newTurnId,
  rawQuery,
  baseUrl,
  apiKey,
  model,
  isPersian,
  profile,
  genderModel,
  mode,
  selectedOrgansList,
  organCount,
  history,
  turns,
  onVerdict,
  signal,
}: CustomStreamOptions) {
  const appendDelta = useChatStore.getState().appendDelta;
  const noteTool = useChatStore.getState().noteTool;
  const noteCommand = useChatStore.getState().noteCommand;
  const executeSceneCommand = useSceneStore.getState().applyCommand;

  return streamCustomChat({
    baseUrl,
    apiKey,
    model,
    systemPrompt: buildCustomSystemPrompt({
      fa: isPersian,
      profile,
      genderModel,
      mode,
      selection: selectedOrgansList as any,
      organCount,
    }),
    history,
    query: rawQuery,
    mode,
    ...(signal ? { signal } : {}),
    onDelta: (chunk) => {
      if (turns.accepts(newTurnId)) appendDelta(newTurnId, chunk);
    },
    onToolStarted: (tool) => {
      if (turns.accepts(newTurnId)) noteTool(newTurnId, tool);
    },
    onSceneCommand: (cmd) => {
      if (turns.accepts(newTurnId)) {
        noteCommand(newTurnId, cmd);
        executeSceneCommand(cmd);
      }
    },
    onCaseVerdict: (score, verdict) => {
      if (turns.accepts(newTurnId)) {
        onVerdict?.(score, verdict);
      }
    },
  });
}
