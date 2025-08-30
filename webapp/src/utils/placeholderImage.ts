const _generateFractalPath = (seed: number, iterations: number, angle: number): string => {
  const rules = ["F+F-F-F+F", "F-F+F+F-F", "F+F-F+F-F", "F-F+F-F+F", "F+F+F-F-F", "F-F-F+F+F"];
  let path = "F";
  const ruleIndex = seed % rules.length;

  for (let i = 0; i < iterations; i++) {
    path = path.replace(/F/g, rules[ruleIndex]);
  }

  let x = 150,
    y = 100;
  let dir = 0;
  const stepSize = 200 / 3 ** iterations;
  let svgPath = `M${x},${y}`;

  for (const char of path) {
    switch (char) {
    case "F":
      x += stepSize * Math.cos(dir);
      y += stepSize * Math.sin(dir);
      svgPath += `L${x},${y}`;
      break;
    case "+":
      dir += angle;
      break;
    case "-":
      dir -= angle;
      break;
    }
  }

  return svgPath;
};

export function getPlaceholderImageUrl(id: string, tokenCount: string): string {
  const svg = generatePlaceholderSVG(id, tokenCount);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getTokenPlaceholderImageUrl(tokenId: string): string {
  const svg = generateTokenPlaceholderSVG(tokenId);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function generatePlaceholderSVG(id: string, tokenCount: string): string {
  const idNum = Number.parseInt(id, 10);
  const tokenCountNum = Number.parseInt(tokenCount, 10);

  // Generate more vibrant and diverse colors
  const hue1 = (idNum * 137.508) % 360;
  const hue2 = ((idNum << 5) * 222.508) % 360;
  const hue3 = ((idNum << 3) * 179.508) % 360;
  const saturation = 80 + (idNum % 20);
  const lightness = 60 + ((idNum >> 3) % 20);

  // Create a more complex background pattern
  const patternSize = 20 + (idNum % 30);
  const patternRotation = (idNum * 7) % 360;

  // Generate a unique shape based on the batch ID
  const shapeType = idNum % 4; // 0: circle, 1: square, 2: triangle, 3: star
  const shapeSize = 100 + (idNum % 50);
  const shapeRotation = (idNum * 11) % 360;

  // Use tokenCount to influence the number of elements
  const elementCount = 3 + (tokenCountNum % 5);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
      <defs>
        <linearGradient id="grad${idNum}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="50%" style="stop-color:hsl(${hue2},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue3},${saturation}%,${lightness}%);stop-opacity:1" />
        </linearGradient>
        <pattern id="pattern${idNum}" width="${patternSize}" height="${patternSize}" patternUnits="userSpaceOnUse" patternTransform="rotate(${patternRotation})">
          <circle cx="${patternSize / 2}" cy="${patternSize / 2}" r="${patternSize / 4}" fill="rgba(255,255,255,0.1)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad${idNum})" />
      <rect width="100%" height="100%" fill="url(#pattern${idNum})" />
      ${generateShape(shapeType, shapeSize, shapeRotation)}
      ${generateElements(elementCount, idNum)}
      <rect x="10" y="10" width="280" height="180" fill="none" stroke="white" stroke-width="2" rx="10" ry="10" />
      <text x="150" y="190" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle">Batch ${id}</text>
    </svg>
  `;
}

function generateTokenPlaceholderSVG(id: string): string {
  const idNum = Number.parseInt(id, 10);
  const hue1 = (idNum * 131.508) % 360;
  const hue2 = ((idNum << 4) * 211.508) % 360;
  const hue3 = ((idNum << 2) * 173.508) % 360;
  const saturation = 75 + (idNum % 20);
  const lightness = 55 + ((idNum >> 2) % 25);

  const path = _generateFractalPath(idNum, 3, Math.PI / 3);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="gradTok${idNum}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue2},${saturation}%,${lightness}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#gradTok${idNum})" />
      <path d="${path}" stroke="rgba(255,255,255,0.5)" stroke-width="2" fill="none"/>
      <circle cx="200" cy="200" r="140" fill="hsla(${hue3},70%,60%,0.2)" />
      <text x="200" y="210" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">Token ${id}</text>
    </svg>
  `;
}

function generateShape(type: number, size: number, rotation: number): string {
  const centerX = 150;
  const centerY = 100;
  switch (type) {
  case 0: // Circle
    return `<circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="rgba(255,255,255,0.2)" />`;
  case 1: // Square
    return `<rect x="${centerX - size / 2}" y="${centerY - size / 2}" width="${size}" height="${size}" fill="rgba(255,255,255,0.2)" transform="rotate(${rotation} ${centerX} ${centerY})" />`;
  case 2: {
    // Triangle
    const points = `${centerX},${centerY - size / 2} ${centerX - size / 2},${centerY + size / 2} ${centerX + size / 2},${centerY + size / 2}`;
    return `<polygon points="${points}" fill="rgba(255,255,255,0.2)" transform="rotate(${rotation} ${centerX} ${centerY})" />`;
  }
  case 3: // Star
    return generateStar(centerX, centerY, 5, size / 2, size / 4, rotation);
  default:
    return "";
  }
}

function generateStar(
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  rotation: number,
): string {
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    points += `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)} `;
  }
  return `<polygon points="${points}" fill="rgba(255,255,255,0.2)" transform="rotate(${rotation} ${cx} ${cy})" />`;
}

function generateElements(count: number, seed: number): string {
  let elements = "";
  for (let i = 0; i < count; i++) {
    const x = 20 + ((seed * (i + 1) * 17) % 260);
    const y = 20 + ((seed * (i + 1) * 23) % 160);
    const size = 10 + ((seed * (i + 1)) % 20);
    const hue = (seed * (i + 1) * 47) % 360;
    elements += `<circle cx="${x}" cy="${y}" r="${size}" fill="hsla(${hue}, 70%, 60%, 0.5)" />`;
  }
  return elements;
}
