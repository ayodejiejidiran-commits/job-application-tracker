"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { History } from "@tiptap/extension-history";

import { ResumeToolbar } from "@/components/resume/ResumeToolbar";

const FontFamilyExt = TextStyle.extend({
  name: "fontFamily",
  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (el) => (el.style.fontFamily ? el.style.fontFamily : null),
        renderHTML: (attrs) => ({ style: attrs.fontFamily ? `font-family: ${attrs.fontFamily}` : undefined })
      }
    };
  }
});

const FontSizeExt = TextStyle.extend({
  name: "fontSize",
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (el) => (el.style.fontSize ? el.style.fontSize : null),
        renderHTML: (attrs) => ({ style: attrs.fontSize ? `font-size: ${attrs.fontSize}` : undefined })
      }
    };
  }
});

export type ResumeUnifiedEditorProps = {
  initialContent: string;
  onChange?: (html: string, json?: unknown) => void;
  onFocusEditor?: (ed: Editor) => void;
  onImprove?: (sel: string, replace: (txt: string) => void) => void;
};

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 0.8; // of viewport height

export function ResumeUnifiedEditor({ initialContent, onChange, onFocusEditor, onImprove }: ResumeUnifiedEditorProps) {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_HEIGHT;
    const saved = Number(window.localStorage.getItem("resumeEditorHeight"));
    return Number.isFinite(saved) && saved > 100 ? saved : DEFAULT_HEIGHT;
  });

  const editor = useEditor({
    extensions: [
      History,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      Strike,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontFamilyExt,
      FontSizeExt,
      StarterKit.configure({
        history: false,
        heading: { levels: [2, 3] }
      })
    ],
    content: initialContent || "<p>Paste or upload your resume to start editing.</p>",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON());
    }
  });

  useEffect(() => {
    if (editor && initialContent) {
      editor.commands.setContent(initialContent, false);
    }
  }, [editor, initialContent]);

  const containerStyle = useMemo(() => {
    const vhMax = typeof window !== "undefined" ? Math.max(MIN_HEIGHT, Math.min(window.innerHeight * MAX_HEIGHT, 2000)) : 800;
    return {
      border: "1px solid #1f2937",
      borderRadius: 12,
      background: "#0f172a",
      padding: "10px 12px",
      resize: "vertical" as const,
      overflow: "auto" as const,
      minHeight: MIN_HEIGHT,
      maxHeight: vhMax,
      height
    };
  }, [height]);

  const proseStyle: React.CSSProperties = {
    minHeight: "100%",
    outline: "none",
    color: "#e5e7eb"
  };

  if (!editor) return <p className="small">Loading editor…</p>;

  return (
    <div>
      <ResumeToolbar editor={editor} onImprove={(sel, replace) => onImprove?.(sel, replace)} />
      <div
        className="editor-shell"
        data-testid="editor-shell"
        style={containerStyle}
        aria-label="Resume unified editor"
        onMouseUp={(e) => {
          // save user-resized height
          const target = e.currentTarget as HTMLDivElement;
          const newH = target.getBoundingClientRect().height;
          setHeight(newH);
          if (typeof window !== "undefined") window.localStorage.setItem("resumeEditorHeight", String(newH));
        }}
      >
        <EditorContent editor={editor} onFocus={() => onFocusEditor?.(editor)} style={proseStyle} />
      </div>
    </div>
  );
}
