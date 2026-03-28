import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target specific model page as requested by user
// StartPage indicates where to begin scraping for that category
const TARGETS = [
    { url: 'https://xemay.net/danh-muc-san-pham/model-xe/phu-tung-sh/', category: 'Phụ tùng SH', startPage: 1 },
    { url: 'https://xemay.net/danh-muc-san-pham/model-xe-yamaha/exciter/', category: 'Phụ tùng Exciter', startPage: 1 },
    { url: 'https://xemay.net/danh-muc-san-pham/model-xe-yamaha/sirius/', category: 'Phụ tùng Sirius', startPage: 1 }
];
const OUTPUT_FILE = path.join(__dirname, '../external_parts.json');
const MAX_PAGES_PER_CATEGORY = 300; // Increased limit to cover all pages

async function scrape() {
    console.log('🚀 Starting scraper for multiple categories (Continuing from page 51)...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // Load existing data to append to
    let allProducts = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const existingData = fs.readFileSync(OUTPUT_FILE, 'utf8');
            allProducts = JSON.parse(existingData);
            console.log(`📂 Loaded ${allProducts.length} existing products from file.`);
        } catch (e) {
            console.error('⚠️ Could not read existing file, starting fresh.');
        }
    }

    try {
        for (const target of TARGETS) {
            console.log(`\n🌐 Starting category: ${target.category}`);

            // Construct start URL based on startPage
            let currentUrl = target.url;
            if (target.startPage && target.startPage > 1) {
                currentUrl = `${target.url}page/${target.startPage}/`;
            }
            console.log(`🔗 URL: ${currentUrl}`);

            let currentPage = target.startPage || 1;

            // Navigate to the start page
            try {
                await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            } catch (e) {
                console.log(`⚠️ Could not navigate to ${currentUrl}: ${e.message}`);
                continue;
            }

            while (currentPage <= MAX_PAGES_PER_CATEGORY) {
                console.log(`   📄 Scraping page ${currentPage} of ${target.category}...`);

                // Wait for table
                try {
                    await page.waitForSelector('.pn-products-table', { timeout: 10000 });
                } catch (e) {
                    console.log('   ⚠️ Table not found, moving to next category.');
                    break;
                }

                // Scroll to load images
                await autoScroll(page);

                // Extract data
                const products = await page.evaluate((categoryName) => {
                    const rows = Array.from(document.querySelectorAll('.pn-products-table tbody tr'));
                    return rows.map(row => {
                        const nameEl = row.querySelector('.pn-product-name strong');
                        const skuEl = row.querySelector('.pn-product-sku');
                        const priceEl = row.querySelector('.pn-current-price .woocommerce-Price-amount bdi');
                        const imgEl = row.querySelector('.pn-product-thumb img');
                        const linkEl = row.querySelector('.pn-product-name');

                        let price = 0;
                        if (priceEl) {
                            // Remove non-numeric chars except dot if needed, but usually just remove dots/commas for parsing
                            const priceText = priceEl.innerText.replace(/\./g, '').replace(/[^\d]/g, '');
                            price = parseInt(priceText) || 0;
                        }

                        return {
                            name: nameEl ? nameEl.innerText.trim() : 'Unknown Part',
                            sku: skuEl ? skuEl.innerText.trim() : '',
                            price: price,
                            category: categoryName,
                            image_url: imgEl ? imgEl.src : '',
                            source_url: linkEl ? linkEl.href : ''
                        };
                    });
                }, target.category);

                console.log(`   ✅ Found ${products.length} products.`);

                // Append new products to the main list
                allProducts = allProducts.concat(products);

                // Save immediately to avoid data loss
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));

                // Check for next page
                const nextBtn = await page.$('.next-page');
                if (nextBtn && currentPage < MAX_PAGES_PER_CATEGORY) {
                    // Get the href directly and navigate to it
                    const nextUrl = await page.evaluate(el => el.href, nextBtn);

                    if (nextUrl) {
                        await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                        currentPage++;
                    } else {
                        console.log('   ⚠️ Next button found but no URL.');
                        break;
                    }
                } else {
                    console.log('   🛑 No more pages for this category.');
                    break;
                }
            }
        }

        console.log(`\n🎉 Total products scraped across all categories: ${allProducts.length}`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
        console.log(`💾 Final data saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Error during scraping:', error);
        // Save what we have so far
        if (allProducts.length > 0) {
            console.log(`⚠️ Saving ${allProducts.length} products scraped before error...`);
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
        }
    } finally {
        await browser.close();
        console.log('👋 Browser closed.');
    }
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 50);
        });
    });
}

scrape();
