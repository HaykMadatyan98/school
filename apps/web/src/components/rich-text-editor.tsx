"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { mediaUrl, uploadImage } from "@/lib/api";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** Hide photo/PDF buttons — media is managed in a separate section. */
  textOnly?: boolean;
};

/** Drop empty markdown images like `![alt]()` that render as broken icons. */
function cleanMarkdown(md: string) {
  return md
    .replace(/!\[[^\]]*]\((?:\s*|null|undefined|#)\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveSrc(src: string) {
  if (!src?.trim()) return "";
  return mediaUrl(src) || src;
}

function removeEmptyImages(editor: Editor) {
  const { state, view } = editor;
  const tr = state.tr;
  let changed = false;
  state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && !String(node.attrs.src || "").trim()) {
      tr.delete(pos, pos + node.nodeSize);
      changed = true;
    }
  });
  if (changed) view.dispatch(tr);
}

function getMarkdown(editor: Editor) {
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
  const raw = storage.markdown?.getMarkdown() ?? editor.getText();
  // TipTap glues images: ![](a)![](b) → put each on its own line for the site renderer
  return cleanMarkdown(raw.replace(/\)\s*!\[/g, ")\n\n!["));
}

const SafeImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute("src");
          return src && src.trim() ? src.trim() : null;
        },
        renderHTML: (attributes) => {
          const src = resolveSrc(String(attributes.src || ""));
          if (!src) return {};
          return { src };
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const src = el.getAttribute("src");
          if (!src?.trim() || src === "#" || src.startsWith("javascript:")) {
            return false;
          }
          return null;
        },
      },
    ];
  },
});

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
        active ? "bg-ink text-white" : "bg-white text-ink hover:bg-mist"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  onUploadImage,
  uploading,
  textOnly,
}: {
  editor: Editor;
  onUploadImage: () => void;
  uploading: boolean;
  textOnly?: boolean;
}) {
  const t = useTranslations("admin");

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("editorLinkPrompt"), prev || "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] bg-mist/60 px-2 py-2">
      <ToolbarButton
        title={t("editorBold")}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        title={t("editorItalic")}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        title={t("editorUnderline")}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-[var(--line)]" />

      <ToolbarButton
        title={t("editorH2")}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title={t("editorH3")}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-[var(--line)]" />

      <ToolbarButton
        title={t("editorBullet")}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •—
      </ToolbarButton>
      <ToolbarButton
        title={t("editorNumbered")}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-[var(--line)]" />

      <ToolbarButton
        title={t("editorLink")}
        active={editor.isActive("link")}
        onClick={setLink}
      >
        {t("editorLink")}
      </ToolbarButton>

      {!textOnly && (
        <>
          <ToolbarButton
            title={t("editorImage")}
            onClick={onUploadImage}
            disabled={uploading}
          >
            {uploading ? "…" : t("editorImage")}
          </ToolbarButton>
        </>
      )}

      <span className="mx-1 h-5 w-px bg-[var(--line)]" />

      <ToolbarButton
        title={t("editorUndo")}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        title={t("editorRedo")}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  textOnly = false,
}: Props) {
  const t = useTranslations("admin");
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const lastEmitted = useRef(cleanMarkdown(value || ""));
  const ready = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-accent-deep underline" },
      }),
      ...(textOnly
        ? []
        : [
            SafeImage.configure({
              allowBase64: false,
              HTMLAttributes: {
                class: "my-3 max-h-80 rounded-lg border border-[var(--line)]",
              },
            }),
          ]),
      Placeholder.configure({
        placeholder: placeholder || t("editorPlaceholder"),
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        breaks: true,
        transformPastedText: true,
      }),
    ],
    content: cleanMarkdown(value || ""),
    editorProps: {
      attributes: {
        class:
          "prose-school min-h-[22rem] max-w-none px-4 py-3 focus:outline-none [&_img]:max-w-full",
      },
    },
    onCreate: ({ editor: ed }) => {
      removeEmptyImages(ed);
      ready.current = true;
    },
    onUpdate: ({ editor: ed, transaction }) => {
      if (!ready.current || !transaction.docChanged) return;
      removeEmptyImages(ed);
      const md = getMarkdown(ed);
      lastEmitted.current = md;
      onChange(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = cleanMarkdown(value || "");
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    editor.commands.setContent(next);
    removeEmptyImages(editor);
  }, [value, editor]);

  async function onPickImage(file: File | null) {
    if (!file || !token || !editor || textOnly) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file, token);
      const src = resolveSrc(url) || url;
      if (!src) throw new Error("empty url");
      editor.chain().focus().setImage({ src }).run();
    } catch {
      window.alert(t("editorUploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!editor) {
    return (
      <div className="min-h-[22rem] rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-ink-soft">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
      <Toolbar
        editor={editor}
        uploading={uploading}
        textOnly={textOnly}
        onUploadImage={() => fileRef.current?.click()}
      />
      <EditorContent editor={editor} />
      {!textOnly && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
        />
      )}
      <p className="border-t border-[var(--line)] bg-mist/40 px-3 py-2 text-[0.75rem] text-ink-soft">
        {textOnly ? t("editorHintTextOnly") : t("editorHint")}
      </p>
    </div>
  );
}
