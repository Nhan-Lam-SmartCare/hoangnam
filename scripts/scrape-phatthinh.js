import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://phatthinh.vn/collections/phu-tung';
const TOTAL_PAGES = 19;
const OUTPUT_FILE = path.join(__dirname, '../phatthinh_parts.json');

async function scrape() {
    console.log('🚀 Starting scraper for Phat Thinh (19 pages)...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    let allProducts = [];

    try {
        for (let currentPage = 1; currentPage <= TOTAL_PAGES; currentPage++) {
            const url = `${BASE_URL}?page=${currentPage}`;
            console.log(`\n📄 Scraping page ${currentPage}/${TOTAL_PAGES}: ${url}`);

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            } catch (e) {
                console.log(`⚠️ Could not navigate to ${url}: ${e.message}`);
                continue;
            }

            // Wait for product grid
            try {
                await page.waitForSelector('.product-list', { timeout: 10000 });
            } catch (e) {
                console.log('   ⚠️ Product list not found, skipping page.');
                continue;
            }

            await autoScroll(page);

            // Extract data
            const products = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.product-item'));
                return items.map(item => {
                    const nameEl = item.querySelector('.product-title a');
                    const priceEl = item.querySelector('.price-box .price');
                    const imgEl = item.querySelector('.product-img img');
                    const linkEl = item.querySelector('.product-title a');

                    // Try to find SKU if available (often not visible on grid, but let's check)
                    // Phatthinh might not show SKU on grid, so we might leave it empty or try to extract from URL/Name

                    // Try multiple selectors for price
                    let priceText = '';
                    const priceSelectors = [
                        '.special-price .price',
                        '.price-box .price',
                        '.regular-price .price',
                        '.price',
                        '.current-price'
                    ];

                    for (const selector of priceSelectors) {
                        const el = item.querySelector(selector);
                        if (el) {
                            priceText = el.innerText;
                            break;
                        }
                    }

                    let price = 0;
                    if (priceText) {
                        const cleanPrice = priceText.replace(/\./g, '').replace(/[^\d]/g, '');
                        price = parseInt(cleanPrice) || 0;
                    }

                    // Handle lazy loading images
                    let imageUrl = '';
                    if (imgEl) {
                        imageUrl = imgEl.dataset.src || imgEl.src;
                        if (imageUrl.startsWith('//')) {
                            imageUrl = 'https:' + imageUrl;
                        }
                    }

                    return {
                        name: nameEl ? nameEl.innerText.trim() : 'Unknown Part',
                        sku: '', // Phatthinh grid doesn't seem to show SKU easily
                        price: price,
                        category: 'Phụ tùng PhatThinh', // Generic category for now
                        image_url: imageUrl,
                        source_url: linkEl ? 'https://phatthinh.vn' + linkEl.getAttribute('href') : ''
                    };
                });
            });

            console.log(`   ✅ Found ${products.length} products on page ${currentPage}.`);
            allProducts = allProducts.concat(products);

            // Save progress
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
        }

        console.log(`\n🎉 Total products scraped: ${allProducts.length}`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
        console.log(`💾 Data saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Error during scraping:', error);
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
