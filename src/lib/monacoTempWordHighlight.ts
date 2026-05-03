import type * as Monaco from "monaco-editor";

/**
 * TEMP — 删除本文件并移除 App.tsx 中的 `installTempWordHighlightTest` 调用与 index.css 里对应样式。
 * 用于验证：Monaco 可对匹配词加自定义背景（decorations + inlineClassName）。
 */
export const TEMP_HIGHLIGHT_WORD = "GCLSID";

const INLINE_CLASS = "sql-tool-temp-word-highlight";

export function installTempWordHighlightTest(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
): Monaco.IDisposable {
  let decorationIds: string[] = [];

  const refresh = () => {
    const model = editor.getModel();
    if (!model || model.isDisposed()) {
      decorationIds = editor.deltaDecorations(decorationIds, []);
      return;
    }
    const matches = model.findMatches(TEMP_HIGHLIGHT_WORD, false, false, false, null, false);
    const next: Monaco.editor.IModelDeltaDecoration[] = matches.map((m) => ({
      range: m.range,
      options: {
        description: "temp-word-highlight-test",
        inlineClassName: INLINE_CLASS,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }));
    decorationIds = editor.deltaDecorations(decorationIds, next);
  };

  refresh();

  const dModel = editor.onDidChangeModel(() => {
    decorationIds = editor.deltaDecorations(decorationIds, []);
    refresh();
  });
  const dContent = editor.onDidChangeModelContent(() => refresh());

  return {
    dispose() {
      dModel.dispose();
      dContent.dispose();
      decorationIds = editor.deltaDecorations(decorationIds, []);
    },
  };
}
