const fs = require("fs");

const COLLECTIONS = [
  {
    name: "Nintendo Switch",
    platform: "switch",
    url: "https://ecommerce.datablitz.com.ph/collections/nintendo-switch-games/products.json",
  },
  {
    name: "Nintendo Switch 2",
    platform: "switch-2",
    url: "https://ecommerce.datablitz.com.ph/collections/nintendo-switch-2-games-1/products.json",
  },
  {
    name: "PlayStation 4",
    platform: "ps4-ps5",
    url: "https://ecommerce.datablitz.com.ph/collections/playstation-4-games/products.json",
  },
  {
    name: "PlayStation 5",
    platform: "ps5",
    url: "https://ecommerce.datablitz.com.ph/collections/playstation-5-games/products.json",
  },
];

const LIMIT = 250;
const OUTPUT_FILE = "datablitz_prices.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyTitleCorrections(title, platform) {
  const corrections = {
    switch: {
      "persona 5 the royal": "Persona 5 Royal",
      "mario + rabbids kingdom battle": "Mario + Rabbids Kingdom Battle",
    },

    "switch-2": {
      "hades ii": "Hades II Nintendo Switch 2 Edition",
      "animal crossing new horizons":
        "Animal Crossing: New Horizons Nintendo Switch 2 Edition",
    },

    "ps4-ps5": {
      // Add PS4-specific corrections here
    },

    ps5: {
      // Add PS5-specific corrections here
    },
  };

  const key = title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return corrections[platform]?.[key] || title;
}

function cleanGameTitle(title, platform) {
  let cleaned = title || "";

  // --------------------------------------------------
  // REMOVE PLATFORM PREFIXES
  // --------------------------------------------------

  // Nintendo
  // Switch 2 must come before Switch.
  cleaned = cleaned.replace(
    /^Nintendo\s+Switch\s+2\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^Nintendo\s+Switch\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^Switch\s+2\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^Switch\s+/i,
    ""
  );

  // PlayStation
  cleaned = cleaned.replace(
    /^PlayStation\s+5\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^PlayStation\s+4\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^PS5\s+/i,
    ""
  );

  cleaned = cleaned.replace(
    /^PS4\s+/i,
    ""
  );

  // --------------------------------------------------
  // REMOVE ANYTHING INSIDE PARENTHESES
  // --------------------------------------------------

  // Examples:
  // (US)
  // (Eng/FR)
  // (Asian)
  // (2027 Edition)
  cleaned = cleaned.replace(
    /\s*\([^)]*\)/g,
    ""
  );

  // --------------------------------------------------
  // REMOVE DATABLITZ / STORE-SPECIFIC WORDING
  // --------------------------------------------------

  cleaned = cleaned.replace(
    /\s+Game\s+Alone\b/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\s+Game\s+Only\b/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\s+Game\s+Key\s+Card\b/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\s+Pre[- ]?Order\s+Downpayment\b/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\s+Pre[- ]?Order\b/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\s+Downpayment\b/gi,
    ""
  );

  // --------------------------------------------------
  // REMOVE PACKAGING LABELS
  // --------------------------------------------------

  // Examples:
  // Chinese Packaging
  // Japan Packaging
  // Japanese Packaging
  // JPN Packaging
  cleaned = cleaned.replace(
    /\s+(?:Chinese|Japan|Japanese|JPN)\s+Packaging\s*$/gi,
    ""
  );

  // --------------------------------------------------
  // REMOVE REGION NUMBERING
  // --------------------------------------------------

  // Examples:
  // Reg.2
  // Reg 2
  // Region 2
  cleaned = cleaned.replace(
    /\s+(?:Reg\.?|Region)\s*\d+\s*$/gi,
    ""
  );

  // --------------------------------------------------
  // REMOVE LANGUAGE COMBINATIONS
  // --------------------------------------------------

  // Examples:
  // Eng
  // Eng/FR
  // Eng/Sp/Fr
  // Eng/Jpn
  // Eng/Chi
  cleaned = cleaned.replace(
    /\s+(?:Eng|English|Fr|French|Sp|Spanish|Jpn|Japanese|Chi|Chinese)(?:\/(?:Eng|English|Fr|French|Sp|Spanish|Jpn|Japanese|Chi|Chinese))*\s*$/gi,
    ""
  );

  // --------------------------------------------------
  // REMOVE REGION LABELS
  // --------------------------------------------------

  // Examples:
  // US
  // USA
  // EU
  // UK
  // AU
  // JP
  // Asian
  // SEA
  cleaned = cleaned.replace(
    /\s+(?:US|USA|EU|UK|AU|JP|JPN|Asian|Asia|SEA)\s*$/gi,
    ""
  );

  // Sometimes DataBlitz uses "All"
  // as a region/version marker.
  cleaned = cleaned.replace(
    /\s+All\s*$/gi,
    ""
  );

  // --------------------------------------------------
  // CLEAN WHITESPACE
  // --------------------------------------------------

  cleaned = cleaned
    .replace(/\s+/g, " ")
    .trim();

  // --------------------------------------------------
  // MANUAL TITLE CORRECTIONS
  // --------------------------------------------------

  cleaned = applyTitleCorrections(
    cleaned,
    platform
  );

  return cleaned;
}

function normalizeForSlug(title) {
  let normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );

  // --------------------------------------------------
  // COMMON TITLE DIFFERENCES
  // --------------------------------------------------

  normalized = normalized.replace(
    /\bmegaman\b/g,
    "mega man"
  );

  normalized = normalized.replace(
    /\bdragonball\b/g,
    "dragon ball"
  );

  return normalized;
}

function createSlug(title, platform) {
  const normalized =
    normalizeForSlug(title);

  const baseSlug = normalized

    // Remove apostrophes.
    .replace(
      /['’]/g,
      ""
    )

    // & becomes "and"
    .replace(
      /&/g,
      "and"
    )

    // + behaves like a separator.
    //
    // Pikmin 1+2
    // → pikmin-1-2
    .replace(
      /\+/g,
      " "
    )

    // Everything else becomes a dash.
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    // Remove leading/trailing dashes.
    .replace(
      /^-+|-+$/g,
      ""
    );

  return `${baseSlug}-${platform}`;
}

function getAvailability(product) {
  const productType =
    (
      product.product_type ||
      ""
    ).toLowerCase();

  const tags =
    Array.isArray(product.tags)
      ? product.tags.map(
          (tag) =>
            String(tag)
              .toLowerCase()
        )
      : [];

  const title =
    (
      product.title ||
      ""
    ).toLowerCase();

  const isPreorder =
    productType.includes(
      "pre-order"
    ) ||
    productType.includes(
      "preorder"
    ) ||
    tags.some(
      (tag) =>
        tag.includes(
          "pre-order"
        ) ||
        tag.includes(
          "preorder"
        )
    ) ||
    title.includes(
      "pre-order"
    ) ||
    title.includes(
      "preorder"
    );

  if (isPreorder) {
    return "Pre-order";
  }

  const variants =
    Array.isArray(
      product.variants
    )
      ? product.variants
      : [];

  const hasAvailableVariant =
    variants.some(
      (variant) =>
        variant.available ===
        true
    );

  return hasAvailableVariant
    ? "In Stock"
    : "Out of Stock";
}

function getPrice(product) {
  const variants =
    Array.isArray(
      product.variants
    )
      ? product.variants
      : [];

  const prices =
    variants
      .map(
        (variant) =>
          Number(
            variant.price
          )
      )
      .filter(
        (price) =>
          Number.isFinite(
            price
          )
      );

  if (
    prices.length === 0
  ) {
    return null;
  }

  // If multiple variants exist,
  // use the cheapest price.
  return Math.min(
    ...prices
  );
}

function normalizeProduct(
  product,
  updatedAt,
  platform
) {
  const title =
    cleanGameTitle(
      product.title,
      platform
    );

  return {
    slug: createSlug(
      title,
      platform
    ),

    title,

    pricePhp:
      getPrice(product),

    availability:
      getAvailability(
        product
      ),

    url:
      `https://ecommerce.datablitz.com.ph/products/${product.handle}`,

    updatedAt,
  };
}

function dedupeByLowestPrice(
  products
) {
  const map =
    new Map();

  for (
    const product of products
  ) {
    const existing =
      map.get(
        product.slug
      );

    // First occurrence.
    if (!existing) {
      map.set(
        product.slug,
        product
      );

      continue;
    }

    const newPrice =
      product.pricePhp;

    const existingPrice =
      existing.pricePhp;

    // New product has a price
    // but existing one doesn't.
    if (
      newPrice !== null &&
      existingPrice === null
    ) {
      map.set(
        product.slug,
        product
      );

      continue;
    }

    // Both have prices:
    // keep the cheaper one.
    if (
      newPrice !== null &&
      existingPrice !== null &&
      newPrice <
        existingPrice
    ) {
      map.set(
        product.slug,
        product
      );
    }
  }

  return Array.from(
    map.values()
  );
}

async function fetchPage(
  collection,
  page
) {
  const url =
    `${collection.url}?limit=${LIMIT}&page=${page}`;

  console.log(
    `Fetching ${collection.name} page ${page}...`
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 Chrome/151 Safari/537.36",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `${collection.name} request failed: ` +
      `${response.status} ` +
      `${response.statusText}`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(
      data.products
    )
  ) {
    throw new Error(
      `Unexpected response for ${collection.name} page ${page}: ` +
      `products array missing`
    );
  }

  return data.products;
}

async function fetchCollection(
  collection
) {
  const allProducts = [];

  let page = 1;

  console.log(
    `\nStarting ${collection.name}...`
  );

  while (true) {
    const products =
      await fetchPage(
        collection,
        page
      );

    console.log(
      `${collection.name} page ${page}: ` +
      `${products.length} products`
    );

    if (
      products.length ===
      0
    ) {
      break;
    }

    allProducts.push(
      ...products
    );

    // Fewer than LIMIT means
    // this is the last page.
    if (
      products.length <
      LIMIT
    ) {
      break;
    }

    page++;

    await sleep(500);
  }

  console.log(
    `${collection.name} total: ` +
    `${allProducts.length}`
  );

  return allProducts;
}

async function main() {
  try {
    console.log(
      "Starting DataBlitz scrape..."
    );

    const updatedAt =
      new Date()
        .toISOString()
        .slice(0, 10);

    const normalizedProducts =
      [];

    for (
      const collection of
      COLLECTIONS
    ) {
      const products =
        await fetchCollection(
          collection
        );

      for (
        const product of
        products
      ) {
        normalizedProducts.push(
          normalizeProduct(
            product,
            updatedAt,
            collection.platform
          )
        );
      }
    }

    console.log(
      `\nTotal normalized products: ` +
      `${normalizedProducts.length}`
    );

    const dedupedProducts =
      dedupeByLowestPrice(
        normalizedProducts
      );

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(
        dedupedProducts,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `After deduplication: ` +
      `${dedupedProducts.length}`
    );

    console.log(
      `Duplicates removed: ` +
      `${
        normalizedProducts.length -
        dedupedProducts.length
      }`
    );

    console.log(
      `Saved to: ${OUTPUT_FILE}`
    );
  } catch (error) {
    console.error(
      "\nDataBlitz scrape failed:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
}

main();