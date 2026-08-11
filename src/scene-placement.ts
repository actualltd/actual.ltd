export type PlacementRange = {
  left: readonly [number, number];
  bottom: readonly [number, number];
  width: readonly [number, number];
};

export type AnimalArtworkBounds = {
  aspectRatio: number;
  alpha: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

export type PlacementEntropy = {
  left: number;
  bottom: number;
  width: number;
};

type Viewport = {
  width: number;
  height: number;
};

export type ResolvedPlacement = {
  left: number;
  bottom: number;
  width: number;
};

function interpolate([minimum, maximum]: readonly [number, number], entropy: number): number {
  return minimum + (maximum - minimum) * Math.min(1, Math.max(0, entropy));
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Keeps the visible alpha silhouette inside the viewport, including the
 * maximum parallax and idle travel, while retaining art-directed randomness.
 */
export function resolveAnimalPlacement(
  range: PlacementRange,
  artwork: AnimalArtworkBounds,
  entropy: PlacementEntropy,
  viewport: Viewport,
): ResolvedPlacement {
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const alphaWidth = Math.max(0.01, artwork.alpha.right - artwork.alpha.left);
  const alphaHeight = Math.max(0.01, artwork.alpha.bottom - artwork.alpha.top);

  // Parallax travels at most 2.4vw / 15px and idle motion adds up to 10px.
  const horizontalMargin = 1.25 + 2.4 + 1_000 / viewportWidth;
  const verticalMargin = 1.25 + 1_500 / viewportHeight;
  const horizontalWidthLimit = (100 - horizontalMargin * 2) / alphaWidth;
  const verticalWidthLimit = (
    (100 - verticalMargin * 2)
    * (viewportHeight / viewportWidth)
    / (artwork.aspectRatio * alphaHeight)
  );
  const requestedWidth = interpolate(range.width, entropy.width);
  const width = Math.max(24, Math.min(requestedWidth, horizontalWidthLimit, verticalWidthLimit));

  const requestedLeft = interpolate(range.left, entropy.left);
  const minimumLeft = horizontalMargin - artwork.alpha.left * width;
  const maximumLeft = 100 - horizontalMargin - artwork.alpha.right * width;
  const left = clamp(requestedLeft, minimumLeft, maximumLeft);

  const elementHeight = width * (viewportWidth / viewportHeight) * artwork.aspectRatio;
  const requestedBottom = interpolate(range.bottom, entropy.bottom);
  const minimumBottom = verticalMargin - (1 - artwork.alpha.bottom) * elementHeight;
  const maximumBottom = 100 - verticalMargin - (1 - artwork.alpha.top) * elementHeight;
  const bottom = clamp(requestedBottom, minimumBottom, maximumBottom);

  return { left, bottom, width };
}
