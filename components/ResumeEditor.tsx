"use client";

// TipTap rich text editor with toolbar and Improve Bullet button
import { useCallback, useEffect, useState } from "react";
import { EditorContent, useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export type ResumeEditorProps = {
  initialContent?: string;
  onChange?: (html: string) => void;
  onFocusEditor?: (editor: Editor) => void;
  label?: string;
};

export function ResumeEditor({ initialContent = "", onChange, onFocusEditor, label }: ResumeEditorProps) {
  const [error] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || "<p>Start writing your resume here...</p>",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && initialContent) editor.commands.setContent(initialContent);
  }, [editor, initialContent]);

  const handleFocus = useCallback(() => {
    if (editor && onFocusEditor) onFocusEditor(editor);
  }, [editor, onFocusEditor]);

  if (!editor) return <p className="small">Loading editor…</p>;

  return (
    <div>
      <div className="editor-shell" data-testid="editor-shell">
        <EditorContent editor={editor} onFocus={handleFocus} aria-label={label ?? "Resume editor"} />
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </div>
  );
}
