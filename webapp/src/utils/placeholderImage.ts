const generateFractalPath = (seed: number, iterations: number, angle: number): string => {
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

function generatePlaceholderSVG(id: string, tokenCount: string): string {
    // Convert id and tokenCount to numbers for calculations
    const idNum = Number.parseInt(id, 10);
    const tokenCountNum = Number.parseInt(tokenCount, 10);

    const hue1 = (idNum * 137.508) % 360;
    const hue2 = ((idNum << 5) * 222.508) % 360;
    const hue3 = ((idNum << 3) * 179.508) % 360;
    const saturation = 70 + (idNum % 30);
    const lightness = 50 + ((idNum >> 3) % 20);

    const iterations = 4 + (idNum % 3);
    const angle = (((idNum % 8) + 2) * Math.PI) / 16;
    const fractalPath = generateFractalPath(idNum, iterations, angle);

    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
      <defs>
        <linearGradient id="grad${idNum}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="50%" style="stop-color:hsl(${hue2},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue3},${saturation}%,${lightness}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad${idNum})" />
      <path d="${fractalPath}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" />
      <rect x="10" y="10" width="280" height="180" fill="none" stroke="white" stroke-width="2" rx="10" ry="10" />
    </svg>
  `;
}
