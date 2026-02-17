"use client";

import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Palette,
  Highlighter,
  Eraser
} from "lucide-react";

const fonts = [
  { label: "Sans Serif", value: "" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Georgia", value: "Georgia, serif" }
];

const sizes = ["10", "11", "12", "13", "14", "16", "18"];

const swatches = [
  "#f8fafc",
  "#e5e7eb",
  "#cbd5e1",
  "#fca5a5",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#c084fc",
  "#f472b6"
];

type ToolbarProps = {
  editor: Editor | null;
  onImprove: (sel: string, replace: (txt: string) => void) => void;
};

export function ResumeToolbar({ editor, onImprove }: ToolbarProps) {
  const [font, setFont] = useState("");
  const [size, setSize] = useState("12");
  const [improving, setImproving] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const attrs = editor.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string };
      if (attrs.fontFamily !== undefined) setFont(attrs.fontFamily || "");
      if (attrs.fontSize !== undefined) setSize(String(parseInt(attrs.fontSize || "12", 10)));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).on("selectionUpdate", update);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).off("selectionUpdate", update);
    };
  }, [editor]);

  const hasSelection = useMemo(() => {
    if (!editor) return false;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ");
    return selected.trim().length > 0;
  }, [editor]);

  const handleImprove = () => {
    if (!editor || !hasSelection) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ");
    const replace = (txt: string) => editor.commands.insertContentAt({ from, to }, txt);
    setImproving(true);
    Promise.resolve(onImprove(selected, replace)).finally(() => setImproving(false));
  };

  const btn = (icon: React.ReactNode, action: () => void, active = false, aria: string) => (
    <button
      type="button"
      className={`icon-btn${active ? " active" : ""}`}
      aria-label={aria}
      title={aria}
      onClick={() => editor?.chain().focus() && action()}
      disabled={!editor}
      data-active={active}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      {btn(<Undo2 size={16} />, () => editor?.chain().focus().undo().run(), false, "Undo")}
      {btn(<Redo2 size={16} />, () => editor?.chain().focus().redo().run(), false, "Redo")}

      <div className="separator" />

      <select
        aria-label="Font family"
        title="Font family"
        className="compact-select"
        value={font}
        onChange={(e) => {
          const val = e.target.value;
          setFont(val);
          editor?.chain().focus().setMark("textStyle", { fontFamily: val || null }).run();
        }}
      >
        {fonts.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Font size"
        title="Font size"
        className="compact-select w-16"
        value={size}
        onChange={(e) => {
          const val = e.target.value;
          setSize(val);
          editor?.chain().focus().setMark("textStyle", { fontSize: `${val}px` }).run();
        }}
      >
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="separator" />

      {btn(<Bold size={16} />, () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold") ?? false, "Bold")}
      {btn(<Italic size={16} />, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic") ?? false, "Italic")}
      {btn(<Underline size={16} />, () => editor?.chain().focus().toggleUnderline().run(), editor?.isActive("underline") ?? false, "Underline")}
      {btn(<Strikethrough size={16} />, () => editor?.chain().focus().toggleStrike().run(), editor?.isActive("strike") ?? false, "Strike")}

      <ColorPicker
        label="Text color"
        icon={<Palette size={16} />}
        swatches={swatches}
        onPick={(color) => editor?.chain().focus().setColor(color).run()}
      />
      <ColorPicker
        label="Highlight"
        icon={<Highlighter size={16} />}
        swatches={swatches}
        onPick={(color) => editor?.chain().focus().toggleHighlight({ color }).run()}
      />

      <div className="separator" />

      {btn(
        <AlignLeft size={16} />,
        () => editor?.chain().focus().setTextAlign("left").run(),
        editor?.isActive({ textAlign: "left" }) ?? false,
        "Align left"
      )}
      {btn(
        <AlignCenter size={16} />,
        () => editor?.chain().focus().setTextAlign("center").run(),
        editor?.isActive({ textAlign: "center" }) ?? false,
        "Align center"
      )}
      {btn(
        <AlignRight size={16} />,
        () => editor?.chain().focus().setTextAlign("right").run(),
        editor?.isActive({ textAlign: "right" }) ?? false,
        "Align right"
      )}

      {btn(<List size={16} />, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList") ?? false, "Bullet list")}
      {btn(<ListOrdered size={16} />, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList") ?? false, "Numbered list")}

      <div className="separator" />

      <LinkButton editor={editor} />

      {btn(
        <Eraser size={16} />,
        () => editor?.chain().focus().unsetAllMarks().clearNodes().run(),
        false,
        "Clear formatting"
      )}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="button"
        onClick={handleImprove}
        disabled={!hasSelection || !editor || improving}
        aria-label="Improve bullet"
      >
        {improving ? "Improving…" : "Improve bullet"}
      </button>
    </div>
  );
}

function ColorPicker({ label, icon, swatches, onPick }: { label: string; icon: React.ReactNode; swatches: string[]; onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </button>
      {open ? (
        <div
          className="absolute z-20 mt-2 p-2 rounded-lg border border-[var(--line)] shadow-lg"
          style={{ background: "var(--panel)", minWidth: 140 }}
        >
          <div className="grid grid-cols-4 gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                className="h-7 w-7 rounded-md border"
                style={{ background: c, borderColor: "var(--line)" }}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                aria-label={label}
                title={c}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LinkButton({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const apply = () => {
    if (!editor) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="icon-btn"
        aria-label="Link"
        title="Link"
        onClick={() => {
          setUrl(editor?.getAttributes("link")?.href ?? "");
          setOpen((v) => !v);
        }}
      >
        <Link2 size={16} />
      </button>
      {open ? (
        <div
          className="absolute z-20 mt-2 p-2 rounded-lg border border-[var(--line)] shadow-lg"
          style={{ background: "var(--panel)", minWidth: 200 }}
        >
          <input
            className="w-full"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Link URL"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="button secondary" onClick={() => editor?.chain().focus().unsetLink().run()}>
              Remove
            </button>
            <button type="button" className="button" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
