"use client";

import clsx from "clsx";
import { useCallback, useEffect, useReducer, useRef, type DragEvent } from "react";
import { useCredits } from "@/app/(core)/credit-context";

interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "queued" | "spending" | "processing" | "completed" | "error";
  message?: string;
}

interface State {
  items: UploadItem[];
  isDragging: boolean;
  processing: boolean;
}

type Action =
  | { type: "QUEUE_FILES"; files: File[] }
  | { type: "SET_DRAG"; value: boolean }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "UPDATE_ITEM"; id: string; patch: Partial<UploadItem> }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "RESET" };

const initialState: State = {
  items: [],
  isDragging: false,
  processing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "QUEUE_FILES": {
      const nextItems = action.files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: "queued" as const,
      }));
      return {
        ...state,
        items: [...state.items, ...nextItems],
      };
    }
    case "SET_DRAG":
      return { ...state, isDragging: action.value };
    case "SET_PROCESSING":
      return { ...state, processing: action.value };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsText(file);
  });
}

function summarizeContent(content: string) {
  const clean = content.trim();
  if (!clean) {
    return "Archivo vacío.";
  }
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const numbers = clean.match(/\d+/g) ?? [];
  return `${lines.length} líneas detectadas • ${numbers.length} números extraídos`;
}

export function Dropzone() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const { spend, spending } = useCredits();

  const queueFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const files = Array.from(fileList).slice(0, 20);
    dispatch({ type: "QUEUE_FILES", files });
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dispatch({ type: "SET_DRAG", value: false });
      queueFiles(event.dataTransfer.files);
    },
    [queueFiles],
  );

  const processNext = useCallback(async () => {
    const nextItem = state.items.find((item) => item.status === "queued");
    if (!nextItem || state.processing) {
      return;
    }

    dispatch({ type: "SET_PROCESSING", value: true });
    dispatch({
      type: "UPDATE_ITEM",
      id: nextItem.id,
      patch: { status: "spending", message: "Descontando crédito…" },
    });

    try {
      const ok = await spend(1);
      if (!ok) {
        dispatch({
          type: "UPDATE_ITEM",
          id: nextItem.id,
          patch: {
            status: "error",
            message: "No fue posible descontar crédito. Reintenta.",
          },
        });
        dispatch({ type: "SET_PROCESSING", value: false });
        return;
      }

      dispatch({
        type: "UPDATE_ITEM",
        id: nextItem.id,
        patch: { status: "processing", message: "Analizando archivo…" },
      });

      const text = await readFileAsText(nextItem.file);
      const summary = summarizeContent(text);

      dispatch({
        type: "UPDATE_ITEM",
        id: nextItem.id,
        patch: { status: "completed", message: summary },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error inesperado durante el análisis";
      dispatch({
        type: "UPDATE_ITEM",
        id: nextItem.id,
        patch: { status: "error", message },
      });
    } finally {
      dispatch({ type: "SET_PROCESSING", value: false });
    }
  }, [spend, state.items, state.processing]);

  useEffect(() => {
    if (state.processing) {
      return;
    }
    const pending = state.items.some((item) => item.status === "queued");
    if (pending) {
      void processNext();
    }
  }, [state.items, state.processing, processNext]);

  return (
    <section className="dropzone-section">
      <div
        className={clsx("dropzone", {
          dragging: state.isDragging,
        })}
        onDragEnter={(event) => {
          event.preventDefault();
          dispatch({ type: "SET_DRAG", value: true });
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dispatch({ type: "SET_DRAG", value: false });
        }}
        onDrop={handleDrop}
      >
        <div className="dropzone-body">
          <p className="dropzone-title">Arrastra tus archivos o haz clic para seleccionar</p>
          <p className="dropzone-helper">Se permiten hasta 20 archivos por lote.</p>
          <button
            type="button"
            className="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={state.processing || spending}
          >
            {state.processing ? "Procesando…" : "Subir archivos"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            queueFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <div className="upload-status">
        <header>
          <h3>Historial de carga</h3>
          {state.items.length > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={() => dispatch({ type: "RESET" })}
              disabled={state.processing}
            >
              Limpiar lista
            </button>
          )}
        </header>
        {state.items.length === 0 ? (
          <p className="empty">No has subido archivos aún.</p>
        ) : (
          <ul>
            {state.items.map((item) => (
              <li key={item.id} className={clsx(item.status)}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatBytes(item.size)}</span>
                </div>
                <p>{item.message}</p>
                {item.status === "error" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      dispatch({
                        type: "UPDATE_ITEM",
                        id: item.id,
                        patch: { status: "queued", message: undefined },
                      })
                    }
                    disabled={state.processing}
                  >
                    Reintentar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
