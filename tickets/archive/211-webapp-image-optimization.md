# Ticket 211: Webapp - Use Next.js Image Component

## Status

RESOLVED

## Priority

LOW

## Category

webapp-performance

## Description

Several components use HTML `<img>` tags instead of Next.js `<Image>` component, missing out on automatic image optimization.

## Current Locations

Based on ESLint warnings:

- `webapp/src/app/admin/page.tsx` (line 692)
- `webapp/src/app/batch/[id]/page.tsx` (line 163)
- `webapp/src/components/TokenCard.tsx` (line 85)
- Potentially others

## Impact

- Slower LCP (Largest Contentful Paint)
- Higher bandwidth usage
- No automatic format optimization (WebP, AVIF)
- No lazy loading by default
- No responsive image sizing

## Recommendation

Replace `<img>` with Next.js `<Image>` component:

```tsx
// Before
<img src={imageUrl} alt="Description" className="w-full h-48" />;

// After
import Image from "next/image";

<Image src={imageUrl} alt="Description" width={400} height={192} className="w-full h-48 object-cover" />;
```

## Special Considerations

- IPFS images may need custom loader
- External images need domain configuration in next.config.js
- SVGs can remain as `<img>` if needed

## Configuration Needed

In `next.config.js`:

```js
images: {
  domains: ['ipfs.io', 'gateway.pinata.cloud', 'w3s.link'],
  // or use remotePatterns for more control
}
```

## Resolution

Implemented Next.js Image component across all identified locations:

- Header.tsx: Logo image (40x40 fixed dimensions)
- mytokens/page.tsx: NFT thumbnails (64x64 fixed dimensions)
- token/[id]/page.tsx: Large NFT display (responsive fill layout)

All IPFS domains already configured in next.config.js. Build completes successfully.

## Note

Low priority as current implementation works. Consider when improving performance metrics.
