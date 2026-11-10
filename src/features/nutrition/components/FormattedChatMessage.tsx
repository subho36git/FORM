import React from 'react'

interface FormattedChatMessageProps {
  content: string
}

function renderInlineText(text: string): React.ReactNode[] {
  // Parse **bold** and `code`
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-[var(--color-text-primary)]">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-accent-text)]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ content }) => {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 1. Table Detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        // First line is header
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        // Ignore separator line (tableLines[1])
        const rowLines = tableLines.slice(2)

        blocks.push(
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-hover)]/70 border-b border-[var(--color-border)] text-[var(--color-text-secondary)] font-bold">
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className={`py-2 px-3 ${hIdx > 0 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {rowLines.map((r, rIdx) => {
                  const cells = r
                    .split('|')
                    .slice(1, -1)
                    .map((c) => c.trim())
                  return (
                    <tr key={rIdx} className="hover:bg-[var(--color-surface-hover)]/40 transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-1.5 px-3 text-[11.5px] ${
                            cIdx > 0 ? 'text-right font-medium' : 'text-left font-semibold text-[var(--color-text-primary)]'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 2. Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const listItems: string[] = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('• '))
      ) {
        listItems.push(lines[i].trim().replace(/^[-•]\s*/, ''))
        i++
      }

      blocks.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1 text-xs text-[var(--color-text-secondary)] list-disc list-inside">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineText(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 3. Normal paragraph or header
    if (line.trim()) {
      blocks.push(
        <p key={`p-${i}`} className="leading-relaxed text-xs text-[var(--color-text-primary)]">
          {renderInlineText(line)}
        </p>
      )
    }

    i++
  }

  return <div className="space-y-2">{blocks}</div>
}
