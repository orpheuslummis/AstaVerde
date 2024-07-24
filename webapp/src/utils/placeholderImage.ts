const generatePlaceholderSVG = (id: number | string) => {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    // Use prime numbers and bitwise operations for more distinct patterns
    const seed = (numericId * 2654435761) % 2 ** 32;

    // Generate multiple colors for a more complex pattern
    const hue1 = (seed * 137.508) % 360;
    const hue2 = ((seed << 5) * 222.508) % 360;
    const saturation = 70 + (seed % 30);
    const lightness = 50 + ((seed >> 3) % 20);

    // Create a more complex SVG pattern with increased padding
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <defs>
          <linearGradient id="grad${numericId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
            <stop offset="100%" style="stop-color:hsl(${hue2},${saturation}%,${lightness}%);stop-opacity:1" />
          </linearGradient>
          <pattern id="pattern${numericId}" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="15" fill="rgba(255,255,255,0.1)" />
            <circle cx="5" cy="5" r="5" fill="rgba(255,255,255,0.1)" />
            <circle cx="35" cy="35" r="5" fill="rgba(255,255,255,0.1)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad${numericId})" />
        <rect width="100%" height="100%" fill="url(#pattern${numericId})" />
        <rect x="10" y="10" width="280" height="180" fill="none" stroke="white" stroke-width="2" rx="10" ry="10" />
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dy=".3em">Batch ${numericId}</text>
      </svg>
    `;
};

export const getPlaceholderImageUrl = (id: number | string) => {
    const svgString = generatePlaceholderSVG(id);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
};