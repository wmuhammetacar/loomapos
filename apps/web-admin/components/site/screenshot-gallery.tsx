import { Card, CardTitle } from "@/components/ui/card";
import type { ScreenshotPlaceholder } from "@/lib/marketing-content";

interface ScreenshotGalleryProps {
  items: readonly ScreenshotPlaceholder[];
}

const platformLabelMap: Record<ScreenshotPlaceholder["platform"], string> = {
  desktop: "Desktop app",
  mobile: "Mobile app",
  dashboard: "Management view"
};

export function ScreenshotGallery({ items }: ScreenshotGalleryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item, index) => (
        <Card key={`${item.title}-${index}`}>
          <div className="flex h-56 items-center justify-center rounded-[24px] border border-dashed border-line bg-gradient-to-br from-white via-muted/45 to-brand/10 text-center text-sm font-semibold text-text/55">
            Screenshot Placeholder
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <CardTitle className="text-lg">{item.title}</CardTitle>
            <span className="rounded-full border border-line bg-muted/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/60">
              {platformLabelMap[item.platform]}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-text/72">{item.description}</p>
        </Card>
      ))}
    </div>
  );
}
