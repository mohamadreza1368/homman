/**
 * HOOMAAN 3D Scene & Clinical Tools (Function Calling Definitions).
 *
 * Provides OpenAI-compatible function schemas for the 3D anatomical viewport
 * and clinical case drills, allowing any OpenAI-compatible Custom API model
 * to directly steer camera focus, system visibility, cross-sections,
 * cardiac rhythm, and animated physiological pathways.
 */

import type {
  AnatomicalSystem,
  HeartRhythmId,
  ScannerPlane,
  SceneCommand,
  SectionPlane,
} from "@/lib/schemas";

export interface OpenAiFunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const HOOMAAN_ANATOMY_TOOLS: OpenAiFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "focus_organ",
      description:
        "Fly the 3D camera and focus the viewport directly onto an anatomical organ or structure.",
      parameters: {
        type: "object",
        properties: {
          organ_id: {
            type: "string",
            description:
              "Canonical slug of the organ or structure (e.g. 'heart', 'liver', 'brain', 'stomach', 'coronary_artery_left', 'ren_sinister', 'lung_left').",
          },
        },
        required: ["organ_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "illuminate_structures",
      description:
        "Highlight and shine an accent illumination light on specific structures while keeping the rest of the body in context. An empty array turns illumination off.",
      parameters: {
        type: "object",
        properties: {
          organ_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of organ slugs to illuminate (up to 24 structures).",
          },
        },
        required: ["organ_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "isolate_structures",
      description:
        "Isolate specific anatomical structures, hiding all other non-selected anatomy to inspect them in isolation.",
      parameters: {
        type: "object",
        properties: {
          organ_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of organ slugs to isolate (up to 64 structures).",
          },
        },
        required: ["organ_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "isolate_region",
      description:
        "Isolate an anatomical parent organ along with all its internal sub-structures and descendant parts (e.g., the heart with its ventricles, atria, valves, and septum).",
      parameters: {
        type: "object",
        properties: {
          organ_id: {
            type: "string",
            description: "Parent organ slug (e.g. 'heart', 'brain', 'stomach', 'lung_left').",
          },
        },
        required: ["organ_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "highlight_pathway",
      description:
        "Animate an anatomical or physiological pathway across an ordered sequence of structures (e.g. blood circulation, digestive transit, nerve conduction).",
      parameters: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Short descriptive title for the pathway (e.g. 'گردش خون عمومی' or 'مسیر بلع').",
          },
          organ_ids: {
            type: "array",
            items: { type: "string" },
            description: "Ordered sequence of organ slugs the pathway flows through (2 to 24 structures).",
          },
          step_seconds: {
            type: "number",
            description: "Speed per segment in seconds (default 1.2, range 0.2 to 10.0).",
          },
          loop: {
            type: "boolean",
            description: "Whether the animation loops continuously (default true).",
          },
        },
        required: ["label", "organ_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_pathway",
      description: "Stop and clear any currently active animated pathway.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_cross_section",
      description:
        "Cut the 3D body along an anatomical cross-section plane to reveal deep interior structures.",
      parameters: {
        type: "object",
        properties: {
          plane: {
            type: "string",
            enum: ["axial", "sagittal", "coronal"],
            description: "The anatomical slicing plane.",
          },
          position: {
            type: "number",
            description: "Normalized position along the slicing plane (-1.0 to 1.0, 0.0 is center).",
          },
        },
        required: ["plane", "position"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_at_structure",
      description:
        "Position the anatomical radiology / tomography scanner slice at the exact height of an organ.",
      parameters: {
        type: "object",
        properties: {
          organ_id: {
            type: "string",
            description: "Target organ slug.",
          },
          plane: {
            type: "string",
            enum: ["axial", "coronal"],
            description: "Radiology slice plane (optional, defaults to current).",
          },
        },
        required: ["organ_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_heart_rhythm",
      description:
        "Set the 3D cardiac rhythm and electromechanical heartbeat animation.",
      parameters: {
        type: "object",
        properties: {
          rhythm: {
            type: "string",
            enum: [
              "normal",
              "sinus_bradycardia",
              "sinus_tachycardia",
              "atrial_fibrillation",
              "atrial_flutter",
              "mobitz_1",
              "mobitz_2",
              "av_block_1",
              "av_block_3",
              "aortic_stenosis",
              "mitral_regurgitation",
              "asystole",
            ],
            description: "Cardiac electrophysiology rhythm ID.",
          },
          sound: {
            type: "boolean",
            description: "Whether cardiac auscultation audio is active.",
          },
        },
        required: ["rhythm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_layer_visibility",
      description: "Toggle visibility for an entire anatomical / physiological system.",
      parameters: {
        type: "object",
        properties: {
          system: {
            type: "string",
            enum: [
              "skeletal",
              "muscular",
              "nervous",
              "cardiovascular",
              "respiratory",
              "digestive",
              "endocrine",
              "lymphatic",
              "renal",
              "reproductive",
              "articular",
              "integumentary",
              "regional",
            ],
            description: "Anatomical system to show or hide.",
          },
          visible: {
            type: "boolean",
            description: "True to show, false to hide.",
          },
        },
        required: ["system", "visible"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_layer_opacity",
      description:
        "Set translucent ghosting / opacity for an entire system to inspect deep anatomy through it.",
      parameters: {
        type: "object",
        properties: {
          system: {
            type: "string",
            enum: [
              "skeletal",
              "muscular",
              "nervous",
              "cardiovascular",
              "respiratory",
              "digestive",
              "endocrine",
              "lymphatic",
              "renal",
              "reproductive",
              "articular",
              "integumentary",
              "regional",
            ],
            description: "Anatomical system name.",
          },
          opacity: {
            type: "number",
            description: "Opacity from 0.0 (transparent) to 1.0 (solid).",
          },
        },
        required: ["system", "opacity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_view",
      description: "Reset 3D camera, visible systems, highlights, and cross-sections back to default.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

export const HOOMAAN_CASE_TOOL: OpenAiFunctionTool = {
  type: "function",
  function: {
    name: "record_case_verdict",
    description:
      "Record clinical evaluation score and feedback for a student's diagnostic drill attempt. Call this once after evaluating the student's clinical reasoning.",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "integer",
          description: "Diagnostic accuracy and clinical reasoning score (0 to 100).",
        },
        verdict: {
          type: "string",
          description:
            "Written evaluation summarizing clinical reasoning, correct identifications, and missed differential diagnoses.",
        },
      },
      required: ["score", "verdict"],
    },
  },
};

export interface ToolConversionResult {
  command?: SceneCommand;
  verdict?: { score: number; verdict: string };
  rawToolName: string;
}

/**
 * Converts an OpenAI function call into a typed SceneCommand or case verdict.
 */
export function convertToolCallToCommand(
  name: string,
  args: Record<string, unknown>,
): ToolConversionResult {
  switch (name) {
    case "focus_organ": {
      const organ_id = String(args.organ_id || "").trim();
      if (!organ_id) return { rawToolName: name };
      return {
        rawToolName: name,
        command: { action: "focus_organ", organ_id },
      };
    }

    case "illuminate_structures": {
      const raw = Array.isArray(args.organ_ids) ? args.organ_ids : [];
      const organ_ids = raw.map((id) => String(id).trim()).filter(Boolean).slice(0, 24);
      return {
        rawToolName: name,
        command: { action: "illuminate_structures", organ_ids },
      };
    }

    case "isolate_structures": {
      const raw = Array.isArray(args.organ_ids) ? args.organ_ids : [args.organ_ids];
      const organ_ids = raw.map((id) => String(id).trim()).filter(Boolean).slice(0, 64);
      if (organ_ids.length === 0) return { rawToolName: name };
      return {
        rawToolName: name,
        command: { action: "isolate_structures", organ_ids },
      };
    }

    case "isolate_region": {
      const organ_id = String(args.organ_id || "").trim();
      if (!organ_id) return { rawToolName: name };
      return {
        rawToolName: name,
        command: { action: "isolate_region", organ_id },
      };
    }

    case "highlight_pathway": {
      const label = String(args.label || "مسیر آناتومیک").trim().slice(0, 120);
      const raw = Array.isArray(args.organ_ids) ? args.organ_ids : [];
      const organ_ids = raw.map((id) => String(id).trim()).filter(Boolean).slice(0, 24);
      if (organ_ids.length < 2) return { rawToolName: name };
      const rawStep = Number(args.step_seconds);
      const step_seconds = Number.isFinite(rawStep) ? Math.min(10, Math.max(0.2, rawStep)) : 1.2;
      const loop = args.loop !== false;
      return {
        rawToolName: name,
        command: {
          action: "highlight_pathway",
          label,
          organ_ids,
          step_seconds,
          loop,
        },
      };
    }

    case "clear_pathway":
      return { rawToolName: name, command: { action: "clear_pathway" } };

    case "set_cross_section": {
      const plane = (["axial", "sagittal", "coronal"].includes(String(args.plane))
        ? args.plane
        : "axial") as SectionPlane;
      const rawPos = Number(args.position);
      const position = Number.isFinite(rawPos) ? Math.min(1, Math.max(-1, rawPos)) : 0;
      return {
        rawToolName: name,
        command: { action: "set_cross_section", plane, position },
      };
    }

    case "scan_at_structure": {
      const organ_id = String(args.organ_id || "").trim();
      if (!organ_id) return { rawToolName: name };
      const rawPlane = String(args.plane || "");
      const plane = (["axial", "coronal"].includes(rawPlane) ? rawPlane : undefined) as
        | ScannerPlane
        | undefined;
      return {
        rawToolName: name,
        command: { action: "scan_at_structure", organ_id, ...(plane ? { plane } : {}) },
      };
    }

    case "set_heart_rhythm": {
      const validRhythms: HeartRhythmId[] = [
        "normal",
        "sinus_bradycardia",
        "sinus_tachycardia",
        "atrial_fibrillation",
        "atrial_flutter",
        "mobitz_1",
        "mobitz_2",
        "av_block_1",
        "av_block_3",
        "aortic_stenosis",
        "mitral_regurgitation",
        "asystole",
      ];
      const rawRhythm = String(args.rhythm || "") as HeartRhythmId;
      const rhythm = validRhythms.includes(rawRhythm) ? rawRhythm : "normal";
      const sound = typeof args.sound === "boolean" ? args.sound : undefined;
      return {
        rawToolName: name,
        command: {
          action: "set_heart_rhythm",
          rhythm,
          ...(typeof sound === "boolean" ? { sound } : {}),
        },
      };
    }

    case "set_layer_visibility": {
      const validSystems: AnatomicalSystem[] = [
        "skeletal",
        "muscular",
        "nervous",
        "cardiovascular",
        "respiratory",
        "digestive",
        "endocrine",
        "lymphatic",
        "renal",
        "reproductive",
        "articular",
        "integumentary",
        "regional",
      ];
      const system = String(args.system || "") as AnatomicalSystem;
      if (!validSystems.includes(system)) return { rawToolName: name };
      return {
        rawToolName: name,
        command: {
          action: "set_layer_visibility",
          system,
          visible: Boolean(args.visible),
        },
      };
    }

    case "set_layer_opacity": {
      const validSystems: AnatomicalSystem[] = [
        "skeletal",
        "muscular",
        "nervous",
        "cardiovascular",
        "respiratory",
        "digestive",
        "endocrine",
        "lymphatic",
        "renal",
        "reproductive",
        "articular",
        "integumentary",
        "regional",
      ];
      const system = String(args.system || "") as AnatomicalSystem;
      if (!validSystems.includes(system)) return { rawToolName: name };
      const rawOpacity = Number(args.opacity);
      const opacity = Number.isFinite(rawOpacity) ? Math.min(1, Math.max(0, rawOpacity)) : 1;
      return {
        rawToolName: name,
        command: {
          action: "set_layer_opacity",
          system,
          opacity,
        },
      };
    }

    case "reset_view":
      return { rawToolName: name, command: { action: "reset_view" } };

    case "record_case_verdict": {
      const rawScore = Number(args.score);
      const score = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 75;
      const verdict = String(args.verdict || "ارزیابی انجام شد.").slice(0, 4000);
      return {
        rawToolName: name,
        verdict: { score, verdict },
      };
    }

    default:
      return { rawToolName: name };
  }
}
