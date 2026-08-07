import { useState, useRef, useEffect } from "react";
import { Button } from "./button";

interface ExpandableTextProps {
  text: string | null | undefined;
}

export function ExpandableText({ text }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [text]);

  if (!text || text === "N.A" || text === "-" || text === "—") {
    return <>{text || ""}</>;
  }

  return (
    <div className="flex flex-col items-start w-full">
      <div 
        ref={textRef}
        className={`w-full ${expanded ? "" : "line-clamp-3"} whitespace-pre-wrap`}
      >
        {text}
      </div>
      {isOverflowing && !expanded && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-[10px] mt-1 text-indigo-600"
          onClick={() => setExpanded(true)}
        >
          Ver mais...
        </Button>
      )}
      {expanded && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-[10px] mt-1 text-slate-500"
          onClick={() => setExpanded(false)}
        >
          Ver menos
        </Button>
      )}
    </div>
  );
}
