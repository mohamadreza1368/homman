/**
 * HOOMAAN Memory Laboratory - Data Loader Hook
 *
 * Clean-room hook fetching clinical study notes, session histories,
 * and mapping them into spatial memory objects.
 */

import { useEffect, useState } from "react";
import {
  listNotes,
  listStudySessions,
  type StudyNote,
} from "@/lib/studyDb";
import { memoriesFrom, type Memory } from "./memories";
import { formatDiagnosticError } from "./memoryLabUtils";

export function useMemoryDataLoader() {
  const [memoryList, setMemoryList] = useState<Memory[] | null>(null);
  const [cachedNotesMap, setCachedNotesMap] = useState<Map<string, StudyNote>>(new Map());
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      listStudySessions(null, null, null, 1000),
      listNotes(null, null, 1000),
    ])
      .then(([sessions, fetchedNotes]) => {
        if (isCancelled) return;
        setCachedNotesMap(new Map(fetchedNotes.map((entry) => [String(entry.id), entry])));
        setMemoryList(memoriesFrom(sessions, fetchedNotes));
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setDisplayErrorMessage(formatDiagnosticError(err));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    memoryList,
    cachedNotesMap,
    displayErrorMessage,
    setDisplayErrorMessage,
  };
}
