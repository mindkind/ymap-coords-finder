const fetch = require('node-fetch');
const fs = require('fs');

async function fetchAllDataIdentifiers() {
    const url = "https://api.plebmasters.de/v1/ymaps/search";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0",
        "Accept": "application/json",
        "Accept-Language": "en-CA,en-US;q=0.7,en;q=0.3",
        "Content-Type": "application/json",
        "Referer": "https://forge.plebmasters.de/",
    };

    let allDataIdentifiers = new Set(); // Prevents duplicates
    let totalResults = 0;
    let skip = 0;
    const take = 40; // Number of results per request

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    try {
        // First request to get totalResultsCount
        let initialResponse = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                "SearchTerm": "",
                "SearchTags": [],
                "Skip": skip,
                "Take": take,
                "Dlc": [],
                "Position": null,
                "PositionRange": 150,
                "FavoritesOnly": false
            })
        });

        let initialData;
        try {
            initialData = await initialResponse.json();
        } catch (error) {
            let rawText = await initialResponse.text();
            console.warn(`⚠️ Non-JSON Response: ${rawText}`);
            return;
        }

        if (!initialResponse.ok) {
            throw new Error(`HTTP error! Status: ${initialResponse.status}`);
        }

        totalResults = initialData.totalResultsCount;
        console.log(`Total Results to Fetch: ${totalResults}`);

        let batchCount = 0;
        initialData.results.forEach(item => {
            if (item.dataIdentifier && !item.isAdvertisement) {
                allDataIdentifiers.add(item.dataIdentifier);
                batchCount++;
            }
        });

        console.log(`Retrieved: ${batchCount} | Total Accumulated: ${allDataIdentifiers.size}`);

        // Loop through remaining data
        while (skip + take < totalResults) {
            skip += take;
            console.log(`Fetching results from ${skip} to ${skip + take}...`);

            await delay(750); // Delay to prevent rate-limiting

            let response;
            try {
                response = await fetch(url, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({
                        "SearchTerm": "",
                        "SearchTags": [],
                        "Skip": skip,
                        "Take": take,
                        "Dlc": [],
                        "Position": null,
                        "PositionRange": 150,
                        "FavoritesOnly": false
                    })
                });

                let data;
                try {
                    data = await response.json();
                } catch (error) {
                    let rawText = await response.text();
                    console.warn(`⚠️ Non-JSON Response: ${rawText}`);

                    // If the response contains "Hold on", wait and retry
                    if (rawText.toLowerCase().includes("hold on")) {
                        console.log("⏳ Rate limit detected. Waiting 5 seconds...");
                        await delay(5000);
                        skip -= take; // Retry this batch
                    }
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                // Process and filter out advertisements
                batchCount = 0;
                data.results.forEach(item => {
                    if (item.dataIdentifier && !item.isAdvertisement) {
                        allDataIdentifiers.add(item.dataIdentifier);
                        batchCount++;
                    }
                });

                console.log(`Retrieved: ${batchCount} | Total Accumulated: ${allDataIdentifiers.size}`);

            } catch (error) {
                console.error("⚠️ Error fetching data, retrying in 5 seconds:", error);
                await delay(5000);
                skip -= take; // Retry this batch
            }
        }

        // Convert Set to an Array and Sort it
        const uniqueIdentifiers = [...allDataIdentifiers].sort();
        console.log(`✅ Final Total Unique Data Identifiers Retrieved: ${uniqueIdentifiers.length}`);

        // Write to a txt file
        fs.writeFileSync("dataIdentifiers.txt", uniqueIdentifiers.join("\n"), "utf-8");
        console.log("✅ Successfully written to dataIdentifiers.txt");
    } catch (error) {
        console.error("❌ Fatal Error:", error);
    }
}

fetchAllDataIdentifiers();
