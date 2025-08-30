#!/usr/bin/env node

/**
 * Local metadata server that mimics IPFS gateway behavior
 * Serves realistic carbon offset metadata for development
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Load metadata template
const metadataTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, "mock-metadata/metadata-template.json")));

// Port for the metadata server
const PORT = 8080;

// Generate SVG image for a project
function generateSVG(project) {
    const svgString = `
        <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${project.image_style.gradient[0]};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${project.image_style.gradient[1]};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="400" height="400" fill="url(#grad)"/>
            <g transform="translate(200, 200)">
                <circle r="120" fill="white" opacity="0.2"/>
                <text y="-40" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
                    ${project.type.toUpperCase()}
                </text>
                <text y="0" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="white" text-anchor="middle">
                    ${project.location}
                </text>
                <text y="40" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">
                    ${project.co2_tons.toLocaleString()}
                </text>
                <text y="65" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="white" text-anchor="middle">
                    tons CO₂
                </text>
                <text y="100" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="white" text-anchor="middle" opacity="0.8">
                    ${project.verifier} • ${project.vintage}
                </text>
            </g>
        </svg>
    `;
    return `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`;
}

// Map CIDs to projects
const cidToProject = new Map();

// Initialize CID mappings based on project IDs
metadataTemplate.projects.forEach((project, index) => {
    // Create multiple CID patterns for each project
    const patterns = [
        `Qm${project.id.substring(0, 8).padEnd(44, project.id.charAt(0))}`, // Enhanced seed format
        `QmTest${index + 1}`, // Legacy format
        `QmVault${index + 1}`, // Vault format
        `QmExtra${index + 1}`, // Extra format
        `QmLocal${index + 1}`, // Local batch format
    ];

    patterns.forEach((cid) => {
        cidToProject.set(cid, project);
    });
});

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Extract CID from path (format: /ipfs/{cid} or just /{cid})
    const cidMatch = pathname.match(/^(?:\/ipfs)?\/(.+)$/);

    if (!cidMatch) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid path" }));
        return;
    }

    const cid = cidMatch[1];

    // Find project for this CID
    let project = cidToProject.get(cid);

    // If no exact match, try to extract a number and map to a project
    if (!project) {
        const numberMatch = cid.match(/(\d+)$/);
        if (numberMatch) {
            const index = (parseInt(numberMatch[1]) - 1) % metadataTemplate.projects.length;
            project = metadataTemplate.projects[index];
        }
    }

    // Default to first project if still no match
    if (!project) {
        project = metadataTemplate.projects[0];
    }

    // Generate metadata
    const metadata = {
        name: project.name,
        description: project.description,
        image: generateSVG(project),
        external_url: `https://astaverde.eco/token/${cid}`,
        attributes: [
            { trait_type: "Project Type", value: project.type },
            { trait_type: "Location", value: project.location },
            { trait_type: "CO2 Offset", value: `${project.co2_tons.toLocaleString()} tons` },
            { trait_type: "Verification", value: project.verifier },
            { trait_type: "Vintage", value: project.vintage },
            { trait_type: "Status", value: "Active" },
        ],
    };

    // Add CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Content-Type", "application/json");

    // Log the request
    console.log(`[${new Date().toISOString()}] Serving metadata for CID: ${cid} -> ${project.name}`);

    // Send response
    res.writeHead(200);
    res.end(JSON.stringify(metadata, null, 2));
});

// Start server
server.listen(PORT, () => {
    console.log("\n🌐 Local Metadata Server Running");
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Serving ${metadataTemplate.projects.length} carbon offset projects`);
    console.log("\n📝 Example endpoints:");
    console.log(`   http://localhost:${PORT}/QmTest1`);
    console.log(`   http://localhost:${PORT}/Qmsolar-far...`);
    console.log(`   http://localhost:${PORT}/ipfs/QmVault1`);
    console.log("\n   Press Ctrl+C to stop the server\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down metadata server...");
    server.close(() => {
        console.log("✅ Server stopped");
        process.exit(0);
    });
});
