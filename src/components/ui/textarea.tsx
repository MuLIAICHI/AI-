// src/components/ui/textarea.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
  minRows?: number
  maxRows?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize = false, minRows = 1, maxRows = 5, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const combinedRef = React.useCallback(
      (node: HTMLTextAreaElement) => {
        textareaRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea || !autoResize) return

      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto'
      
      // Calculate line height
      const style = window.getComputedStyle(textarea)
      const lineHeight = parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2
      
      // Calculate min and max heights
      const minHeight = lineHeight * minRows
      const maxHeight = lineHeight * maxRows
      
      // Set height based on content, within min/max bounds
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      
      textarea.style.height = `${newHeight}px`
    }, [autoResize, minRows, maxRows])

    // Adjust height when value changes
    React.useEffect(() => {
      adjustHeight()
    }, [props.value, adjustHeight])

    // Adjust height on input
    const handleInput = React.useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        adjustHeight()
        props.onInput?.(e)
      },
      [adjustHeight, props.onInput]
    )

    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          autoResize && "resize-none overflow-hidden",
          className
        )}
        ref={combinedRef}
        onInput={handleInput}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }