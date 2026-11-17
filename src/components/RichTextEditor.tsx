import React, { useRef } from 'react';
import { Bold, Italic, Heading2, List, Link as LinkIcon, Code } from 'lucide-react';

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ label, value, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapTag = (openTag: string, closeTag: string, defaultText = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || defaultText;
    const next = value.slice(0, start) + openTag + selected + closeTag + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + openTag.length, start + openTag.length + selected.length);
    }, 0);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => wrapTag('<strong>', '</strong>', 'bold text')}
            title="Bold"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapTag('<em>', '</em>', 'italic text')}
            title="Italic"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapTag('<h3>', '</h3>', 'Subheading')}
            title="Heading"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapTag('<ul>\n  <li>', '</li>\n</ul>', 'List item')}
            title="Bullet List"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapTag('<p>', '</p>', 'Paragraph')}
            title="Paragraph"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapTag('<a href="https://" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">', '</a>', 'Link text')}
            title="Insert Link"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm text-slate-800 focus:outline-none resize-y font-sans leading-relaxed"
      />
    </div>
  );
};
