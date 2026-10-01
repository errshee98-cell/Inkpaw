import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';

/**
 * Rich text + Markdown editor.
 * Markdown shortcuts work while typing: "# ", "## ", "> ", "- ", "1. ", "[ ] ", "```", **bold**, *italic*, ~~strike~~.
 * Pasting Markdown is converted to rich text, and the Md button lets you edit the raw Markdown.
 */
export default function Editor({ entryId, content, onChange, placeholder }) {
  const [mdMode, setMdMode] = useState(false);
  const [md, setMd] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder || 'Dear diary…' }),
      CharacterCount,
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false, linkify: true, breaks: true }),
    ],
    content: content || '',
    editorProps: { attributes: { class: 'prose', spellcheck: 'true' } },
    onUpdate: ({ editor: ed }) => onChange({ content: ed.getJSON(), text: ed.getText() }),
  });

  // Load a different entry into the same editor instance.
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content || '', false);
    setMdMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, editor]);

  if (!editor) return null;

  const toggleMarkdown = () => {
    if (!mdMode) {
      setMd(editor.storage.markdown.getMarkdown());
      setMdMode(true);
    } else {
      editor.commands.setContent(md); // tiptap-markdown parses the string as Markdown
      onChange({ content: editor.getJSON(), text: editor.getText() });
      setMdMode(false);
    }
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url === '') return editor.chain().focus().unsetLink().run();
    if (!/^(https?:|mailto:)/i.test(url)) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const B = ({ cmd, active, label, title, disabled }) => (
    <button type="button" className={`tb-btn ${active ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={cmd} title={title} aria-label={title} aria-pressed={!!active} disabled={disabled || mdMode}>
      {label}
    </button>
  );

  const c = () => editor.chain().focus();

  return (
    <div className="editor">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <B cmd={() => c().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="H1" title="Heading 1" />
        <B cmd={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" title="Heading 2" />
        <B cmd={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" title="Heading 3" />
        <span className="tb-sep" />
        <B cmd={() => c().toggleBold().run()} active={editor.isActive('bold')} label={<b>B</b>} title="Bold (Ctrl+B)" />
        <B cmd={() => c().toggleItalic().run()} active={editor.isActive('italic')} label={<i>I</i>} title="Italic (Ctrl+I)" />
        <B cmd={() => c().toggleUnderline().run()} active={editor.isActive('underline')} label={<u>U</u>} title="Underline (Ctrl+U)" />
        <B cmd={() => c().toggleStrike().run()} active={editor.isActive('strike')} label={<s>S</s>} title="Strikethrough" />
        <B cmd={() => c().toggleHighlight().run()} active={editor.isActive('highlight')} label={<mark>H</mark>} title="Highlight" />
        <span className="tb-sep" />
        <B cmd={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="❝" title="Quote" />
        <B cmd={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} label="•" title="Bullet list" />
        <B cmd={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1." title="Numbered list" />
        <B cmd={() => c().toggleTaskList().run()} active={editor.isActive('taskList')} label="☑" title="Checklist" />
        <B cmd={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} label="{ }" title="Code block" />
        <B cmd={setLink} active={editor.isActive('link')} label="🔗" title="Link" />
        <B cmd={() => c().setHorizontalRule().run()} label="—" title="Divider" />
        <span className="tb-sep" />
        <B cmd={() => c().undo().run()} label="↶" title="Undo" disabled={!editor.can().undo()} />
        <B cmd={() => c().redo().run()} label="↷" title="Redo" disabled={!editor.can().redo()} />
        <span className="tb-grow" />
        <button type="button" className={`tb-btn md ${mdMode ? 'on' : ''}`} onClick={toggleMarkdown} title="Edit as Markdown">
          {mdMode ? 'Done' : 'Md'}
        </button>
      </div>

      {mdMode ? (
        <textarea className="md-source" value={md} onChange={(e) => setMd(e.target.value)} spellCheck="true" aria-label="Markdown source" />
      ) : (
        <EditorContent editor={editor} className="editor-surface" />
      )}

      <div className="editor-foot">
        <span>{editor.storage.characterCount.words()} words</span>
        <span className="hint">Tip: type <kbd>#</kbd>, <kbd>&gt;</kbd>, <kbd>-</kbd> or <kbd>[ ]</kbd> + space</span>
      </div>
    </div>
  );
}
