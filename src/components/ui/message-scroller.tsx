"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";

interface MessageScrollerContextValue {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  setIsAtBottom?: (atBottom: boolean) => void;
  scrollToBottom: (smooth?: boolean) => void;
  scrollToTop: (smooth?: boolean) => void;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

export function useMessageScroller(): MessageScrollerContextValue {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    return {
      viewportRef: { current: null },
      isAtBottom: true,
      scrollToBottom: () => {},
      scrollToTop: () => {},
    };
  }
  return context;
}

export function useMessageScrollerScrollable(): { isScrollable: boolean } {
  const { viewportRef } = useMessageScroller();
  const [isScrollable, setIsScrollable] = React.useState(false);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const check = () => {
      setIsScrollable(el.scrollHeight > el.clientHeight);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportRef]);

  return { isScrollable };
}

export function useMessageScrollerVisibility(): { isVisible: boolean } {
  return { isVisible: true };
}

export interface MessageScrollerProviderProps {
  children?: React.ReactNode;
  autoScroll?: boolean;
  defaultScrollPosition?: "top" | "bottom" | "last-anchor" | string;
  scrollPreviousItemPeek?: number;
}

export function MessageScrollerProvider({
  children,
}: MessageScrollerProviderProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const scrollToBottom = React.useCallback((smooth = true) => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const scrollToTop = React.useCallback((smooth = true) => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({
        top: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const value = React.useMemo(
    () => ({
      viewportRef,
      isAtBottom,
      setIsAtBottom,
      scrollToBottom,
      scrollToTop,
    }),
    [isAtBottom, scrollToBottom, scrollToTop]
  );

  return (
    <MessageScrollerContext.Provider value={value}>
      {children}
    </MessageScrollerContext.Provider>
  );
}

export type MessageScrollerProps = React.HTMLAttributes<HTMLDivElement>;

export function MessageScroller({ className, children, ...props }: MessageScrollerProps) {
  return (
    <div
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MessageScrollerViewportProps = React.HTMLAttributes<HTMLDivElement>;

export function MessageScrollerViewport({
  className,
  children,
  onScroll,
  ...props
}: MessageScrollerViewportProps) {
  const context = React.useContext(MessageScrollerContext);
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const ref = context ? context.viewportRef : localRef;

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(e);
      const el = e.currentTarget;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 48;
      if (context && context.isAtBottom !== atBottom) {
        context.setIsAtBottom?.(atBottom);
      }
    },
    [onScroll, context]
  );

  return (
    <div
      ref={ref}
      data-slot="message-scroller-viewport"
      onScroll={handleScroll}
      className={cn(
        "size-full min-h-0 min-w-0 scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MessageScrollerContentProps = React.HTMLAttributes<HTMLDivElement>;

export function MessageScrollerContent({ className, children, ...props }: MessageScrollerContentProps) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MessageScrollerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  messageId?: string;
  scrollAnchor?: boolean;
}

export function MessageScrollerItem({
  className,
  children,
  messageId,
  scrollAnchor = false,
  ...props
}: MessageScrollerItemProps) {
  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? "true" : undefined}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MessageScrollerButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  direction?: "start" | "end";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
}

export function MessageScrollerButton({
  direction = "end",
  className,
  children,
  variant = "secondary",
  size = "icon-sm",
  onClick,
  ...props
}: MessageScrollerButtonProps) {
  const { scrollToBottom, scrollToTop } = useMessageScroller();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (direction === "end") {
      scrollToBottom(true);
    } else {
      scrollToTop(true);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      data-slot="message-scroller-button"
      data-direction={direction}
      onClick={handleClick}
      className={cn(
        "absolute inset-x-1/2 -translate-x-1/2 border-border bg-background text-foreground shadow-md transition-all duration-200 hover:bg-muted hover:text-foreground",
        direction === "end" ? "bottom-4" : "top-4",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon className={cn("size-4", direction === "start" && "rotate-180")} />
          <span className="sr-only">
            {direction === "end" ? "Scroll to end" : "Scroll to start"}
          </span>
        </>
      )}
    </Button>
  );
}
