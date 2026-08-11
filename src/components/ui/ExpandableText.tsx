export function ExpandableText({ text }: { text: string | null | undefined }) {
  if (!text || text === "N.A" || text === "-" || text === "—") {
    return <>{text || ""}</>;
  }

  return (
    <div className="w-full whitespace-pre-wrap">
      {text}
    </div>
  );
}
