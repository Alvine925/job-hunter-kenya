import { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  SIGNIN_HERO_SLIDES,
  SIGNUP_HERO_SLIDES,
  type AuthHeroSlide,
} from "@/lib/auth-hero-slides";

const AUTOPLAY_MS = 6000;

function HeroSlideContent({
  slide,
  compact,
  fillHeight,
}: {
  slide: AuthHeroSlide;
  compact?: boolean;
  fillHeight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        fillHeight ? "h-full min-h-0" : compact ? "h-full" : "h-auto",
      )}
    >
      <img
        src={slide.image}
        alt=""
        className={cn(
          "w-full object-cover object-center",
          fillHeight ? "absolute inset-0 size-full" : compact ? "h-full" : "h-full min-h-[16rem]",
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-white/92 via-white/72 to-white/0 backdrop-blur-[1px] dark:from-slate-950/88 dark:via-slate-950/60 dark:to-slate-950/0",
          compact ? "h-36" : "h-64",
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20",
          compact ? "p-5" : "max-w-lg p-10 xl:p-14",
        )}
      >
        <div className={cn("flex items-center", compact ? "mb-3" : "mb-6")}>
          <span
            className={cn(
              "font-black uppercase tracking-wide text-[#FD5D28]",
              compact ? "text-xl" : "text-3xl xl:text-4xl",
            )}
          >
            Tellus
          </span>
        </div>
        <h2
          className={cn(
            "font-extrabold leading-tight tracking-tight text-[#D94716]",
            compact ? "text-sm" : "text-xl xl:text-2xl",
          )}
        >
          {slide.title}
        </h2>
        {!compact && (
          <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-slate-700">
            {slide.body}
          </p>
        )}
      </div>
    </div>
  );
}

export function AuthHeroCarousel({
  mode,
  compact,
  fillHeight,
  className,
}: {
  mode: "signin" | "signup";
  compact?: boolean;
  /** Stretch slides to fill a fixed-height parent (desktop hero column). */
  fillHeight?: boolean;
  className?: string;
}) {
  const slides = mode === "signin" ? SIGNIN_HERO_SLIDES : SIGNUP_HERO_SLIDES;
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActive(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api]);

  return (
    <div className={cn("relative", fillHeight ? "h-full min-h-0 w-full" : "h-full w-full", className)}>
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className={fillHeight ? "h-full min-h-0" : "h-full"}
      >
        <CarouselContent
          viewportClassName={fillHeight ? "h-full min-h-0" : undefined}
          className={cn(
            "ml-0",
            fillHeight && "h-full min-h-0 [&>div]:h-full [&>div]:min-h-0",
          )}
        >
          {slides.map((slide, i) => (
            <CarouselItem
              key={i}
              className={cn(
                "basis-full pl-0",
                fillHeight && "h-full min-h-0",
              )}
            >
              <HeroSlideContent slide={slide} compact={compact} fillHeight={fillHeight} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div
        className={cn(
          "absolute z-20 flex gap-1.5",
          compact ? "bottom-3 left-5" : "bottom-8 left-10 xl:left-14",
        )}
        aria-hidden
      >
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === active ? "w-6 bg-[#FD5D28]" : "w-1.5 bg-[#FD5D28]/30 hover:bg-[#FD5D28]/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
