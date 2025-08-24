const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

async function identifyFailingTests() {
    console.log("🔍 Identifying Failing Legacy Tests\n");
    console.log("=".repeat(60));

    try {
        // Run tests and capture output
        const { stdout, stderr } = await execPromise("npm run test 2>&1", { maxBuffer: 10 * 1024 * 1024 });
        const output = stdout + stderr;

        // Parse failing tests
        const failingTests = [];
        const lines = output.split("\n");

        let currentFile = "";
        let currentDescribe = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect test file
            if (line.includes(".ts") && !line.includes("node_modules")) {
                const match = line.match(/test\/(\S+\.ts)/);
                if (match) {
                    currentFile = match[1];
                }
            }

            // Detect describe block
            if (line.trim().startsWith("describe(") || line.includes("describe(")) {
                const match = line.match(/describe\(['"]([^'"]+)['"]/);
                if (match) {
                    currentDescribe = match[1];
                }
            }

            // Detect failing test
            if (line.includes("AssertionError")) {
                // Look backwards for the test name
                for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                    if (lines[j].includes("Should") || lines[j].includes("should")) {
                        const testName = lines[j].trim().replace(":", "");
                        failingTests.push({
                            file: currentFile,
                            describe: currentDescribe,
                            test: testName,
                            reason: "Balance assertion failure",
                        });
                        break;
                    }
                }
            }

            // Detect function not found errors
            if (line.includes("is not a function")) {
                const match = line.match(/(\w+) is not a function/);
                if (match) {
                    failingTests.push({
                        file: currentFile,
                        describe: currentDescribe,
                        test: "Unknown",
                        reason: `Function ${match[1]} not found`,
                    });
                }
            }
        }

        // Group by file
        const byFile = {};
        failingTests.forEach((test) => {
            if (!byFile[test.file]) {
                byFile[test.file] = [];
            }
            byFile[test.file].push(test);
        });

        // Output organized results
        console.log("\n📋 FAILING TESTS BY FILE:\n");

        for (const [file, tests] of Object.entries(byFile)) {
            console.log(`\n📄 ${file || "Unknown File"}`);
            console.log("-".repeat(40));

            tests.forEach((test) => {
                console.log(`  ❌ ${test.test}`);
                console.log(`     Reason: ${test.reason}`);
            });
        }

        // Summary of patterns
        console.log("\n\n📊 COMMON FAILURE PATTERNS:\n");

        const patterns = {
            "Balance assertions": 0,
            "emergencyRescue not found": 0,
            "ProducerPayment event": 0,
            Other: 0,
        };

        failingTests.forEach((test) => {
            if (test.reason.includes("Balance")) patterns["Balance assertions"]++;
            else if (test.reason.includes("emergencyRescue")) patterns["emergencyRescue not found"]++;
            else if (test.reason.includes("ProducerPayment")) patterns["ProducerPayment event"]++;
            else patterns["Other"]++;
        });

        for (const [pattern, count] of Object.entries(patterns)) {
            if (count > 0) {
                console.log(`  • ${pattern}: ${count} tests`);
            }
        }

        // Migration strategy
        console.log("\n\n🔧 RECOMMENDED MIGRATION STRATEGY:\n");
        console.log("1. Start with balance assertion fixes (most common)");
        console.log("2. Remove emergencyRescue references");
        console.log("3. Update event expectations");
        console.log("4. Run tests after each file update");

        console.log("\n" + "=".repeat(60));
        console.log(`Total failing tests: ${failingTests.length}`);
        console.log("=".repeat(60));
    } catch (error) {
        // Tests failing is expected, parse what we can
        const output = error.stdout + error.stderr;

        // Extract summary
        const summaryMatch = output.match(/(\d+) passing.*\n.*(\d+) failing/);
        if (summaryMatch) {
            console.log(`\n📈 Test Summary: ${summaryMatch[1]} passing, ${summaryMatch[2]} failing\n`);
        }

        // Extract specific failures
        const failureMatches = output.match(/\d+\).+\n.+at Context/g);
        if (failureMatches) {
            console.log("Identified test failures:");
            failureMatches.forEach((match, index) => {
                console.log(`\n${index + 1}. ${match.split("\n")[0]}`);
            });
        }
    }
}

identifyFailingTests().catch(console.error);
