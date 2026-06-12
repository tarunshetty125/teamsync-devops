import { lazy, Suspense } from "react";

const EmojiMartPicker = lazy(() => import("./emoji-mart-picker"));

interface EmojiPickerComponentProps {
  onSelectEmoji: (emoji: string) => void;
}

const EmojiPickerComponent = ({
  onSelectEmoji,
}: EmojiPickerComponentProps) => {
  return (
    <div className="relative w-full !max-w-8">
      <Suspense
        fallback={<div className="h-10 w-10 rounded-md border bg-muted" />}
      >
        <EmojiMartPicker onSelectEmoji={onSelectEmoji} />
      </Suspense>
    </div>
  );
};

export default EmojiPickerComponent;
