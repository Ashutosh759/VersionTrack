import { useState } from 'react';
import { Columns, List } from 'lucide-react';

const DiffViewer = ({ diffBlocks = [] }) => {
  const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side' | 'unified'

  // Helper to parse the line structure for side-by-side view
  const parseDiffSideBySide = () => {
    const left = [];
    const right = [];

    let i = 0;
    while (i < diffBlocks.length) {
      const current = diffBlocks[i];

      if (!current.added && !current.removed) {
        // Unchanged content
        const lines = current.value.split('\n');
        // If last element is empty (because of trailing newline), remove it
        if (lines[lines.length - 1] === '') lines.pop();
        
        for (const line of lines) {
          left.push({ type: 'normal', content: line });
          right.push({ type: 'normal', content: line });
        }
        i++;
      } else if (current.removed && i + 1 < diffBlocks.length && diffBlocks[i + 1].added) {
        // Modified content (a delete followed immediately by an insert)
        const next = diffBlocks[i + 1];
        const removedLines = current.value.split('\n');
        if (removedLines[removedLines.length - 1] === '') removedLines.pop();
        
        const addedLines = next.value.split('\n');
        if (addedLines[addedLines.length - 1] === '') addedLines.pop();

        const max = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < max; j++) {
          if (j < removedLines.length) {
            left.push({ type: 'removed', content: removedLines[j] });
          } else {
            left.push({ type: 'empty', content: '' });
          }

          if (j < addedLines.length) {
            right.push({ type: 'added', content: addedLines[j] });
          } else {
            right.push({ type: 'empty', content: '' });
          }
        }
        i += 2;
      } else if (current.removed) {
        // Deletions only
        const lines = current.value.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        
        for (const line of lines) {
          left.push({ type: 'removed', content: line });
          right.push({ type: 'empty', content: '' });
        }
        i++;
      } else if (current.added) {
        // Additions only
        const lines = current.value.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        
        for (const line of lines) {
          left.push({ type: 'empty', content: '' });
          right.push({ type: 'added', content: line });
        }
        i++;
      }
    }

    return { left, right };
  };

  const { left, right } = parseDiffSideBySide();

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-900/10 overflow-hidden font-mono text-xs select-text">
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-2 shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">COMMIT DIFF VIEWER</span>
        
        <div className="flex border border-zinc-800 rounded bg-zinc-950 p-0.5">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${viewMode === 'side-by-side' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Columns className="h-3 w-3" />
            <span className="text-[10px]">Side-by-side</span>
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${viewMode === 'unified' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <List className="h-3 w-3" />
            <span className="text-[10px]">Unified</span>
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="overflow-x-auto">
        {viewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 min-w-[700px] divide-x divide-zinc-800 bg-zinc-950">
            {/* Left Column (Original/Base) */}
            <div className="flex flex-col">
              <div className="border-b border-zinc-850 bg-zinc-900/20 px-4 py-1.5 text-[10px] text-zinc-500">
                BASE VERSION
              </div>
              <div className="flex flex-col py-1">
                {left.map((line, index) => {
                  let bgClass = 'bg-transparent text-zinc-400';
                  let prefix = ' ';
                  if (line.type === 'removed') {
                    bgClass = 'bg-red-950/20 text-red-400';
                    prefix = '-';
                  } else if (line.type === 'empty') {
                    bgClass = 'bg-zinc-900/10 opacity-30';
                    prefix = ' ';
                  }

                  return (
                    <div key={`l-${index}`} className={`flex px-3 py-0.5 leading-relaxed font-mono ${bgClass}`}>
                      <span className="w-5 select-none opacity-40 text-right pr-2">{line.type !== 'empty' ? index + 1 : ''}</span>
                      <span className="w-4 select-none opacity-50">{prefix}</span>
                      <span className="whitespace-pre">{line.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (Compare/Modified) */}
            <div className="flex flex-col">
              <div className="border-b border-zinc-850 bg-zinc-900/20 px-4 py-1.5 text-[10px] text-zinc-500">
                COMPARE VERSION
              </div>
              <div className="flex flex-col py-1">
                {right.map((line, index) => {
                  let bgClass = 'bg-transparent text-zinc-400';
                  let prefix = ' ';
                  if (line.type === 'added') {
                    bgClass = 'bg-emerald-950/20 text-emerald-400';
                    prefix = '+';
                  } else if (line.type === 'empty') {
                    bgClass = 'bg-zinc-900/10 opacity-30';
                    prefix = ' ';
                  }

                  return (
                    <div key={`r-${index}`} className={`flex px-3 py-0.5 leading-relaxed font-mono ${bgClass}`}>
                      <span className="w-5 select-none opacity-40 text-right pr-2">{line.type !== 'empty' ? index + 1 : ''}</span>
                      <span className="w-4 select-none opacity-50">{prefix}</span>
                      <span className="whitespace-pre">{line.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Unified View */
          <div className="bg-zinc-950 flex flex-col py-2 min-w-[500px]">
            {diffBlocks.map((block, bIndex) => {
              const lines = block.value.split('\n');
              if (lines[lines.length - 1] === '') lines.pop();

              return lines.map((line, lIndex) => {
                let bgClass = 'text-zinc-400';
                let prefix = ' ';
                if (block.removed) {
                  bgClass = 'bg-red-950/25 text-red-400';
                  prefix = '-';
                } else if (block.added) {
                  bgClass = 'bg-emerald-950/25 text-emerald-400';
                  prefix = '+';
                }

                return (
                  <div key={`u-${bIndex}-${lIndex}`} className={`flex px-4 py-0.5 leading-relaxed font-mono ${bgClass}`}>
                    <span className="w-4 select-none opacity-50">{prefix}</span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              });
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
