/**
 * Blogi Static Site Generator
 * Generates static HTML pages from Markdown content
 * 
 * Usage: node generate.js
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  contentDir: path.join(__dirname, '..', 'content', 'articles'),
  outputDir: path.join(__dirname, '..', '..', 'dist'),
  templatesDir: path.join(__dirname, '..', 'pages'),
  cssDir: path.join(__dirname, '..', 'css'),
  jsDir: path.join(__dirname, '..', 'js'),

  // Homepage curation settings
  heroCount: 3,
  popularCount: 3,
  featuredCount: 5,
  recentDays: 30,

  // Categories
  categories: {
    technology: {
      name: 'Technology',
      description: 'Explore the latest in tech, AI, software development, and digital innovation.',
      seoText: 'Stay ahead of the curve with our technology articles covering everything from artificial intelligence and machine learning to software development best practices. Our expert writers analyze trends, review tools, and provide actionable insights for tech professionals and enthusiasts alike.'
    },
    business: {
      name: 'Business',
      description: 'Insights on entrepreneurship, management, finance, and business growth strategies.',
      seoText: 'Whether you\'re launching a startup or scaling an enterprise, our business content delivers the strategies you need. From financial planning and team management to market analysis and growth hacking, we provide expert guidance for every stage of your business journey.'
    },
    lifestyle: {
      name: 'Lifestyle',
      description: 'Tips for living your best life, from wellness to productivity and beyond.',
      seoText: 'Transform your daily life with our lifestyle articles. Covering mindfulness, productivity, relationships, personal development, and more, we help you build habits that lead to a more fulfilling life. Practical advice backed by research and real-world experience.'
    },
    movies: {
      name: 'Movies',
      description: 'Film analysis, industry insights, and the art of screenwriting.',
      seoText: 'Dive deep into the world of cinema with our movies section. From script analysis and filmmaking techniques to industry trends and reviews, we cover all aspects of the film industry for creators and cinephiles alike.'
    },
    health: {
      name: 'Health',
      description: 'Evidence-based advice for physical and mental well-being.',
      seoText: 'Your health is your wealth. Our health articles provide science-backed guidance on nutrition, fitness, mental health, sleep, and preventive care. Written by experts, designed for real people looking to improve their well-being.'
    }
  },

  // Default author avatar
  defaultAuthorAvatar: '/images/authors/editorial-team.jpg',

  // Reading speed (words per minute)
  wordsPerMinute: 200
};

// ============================================
// UTILITIES
// ============================================

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content) {
  // Normalize line endings to \n
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content };
  }

  const frontmatterStr = match[1];
  const markdownContent = match[2];

  const metadata = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Parse arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v =>
        v.trim().replace(/^["']|["']$/g, '')
      );
    }
    // Parse numbers
    else if (!isNaN(value) && value !== '') {
      value = Number(value);
    }
    // Remove quotes
    else {
      value = value.replace(/^["']|["']$/g, '');
    }

    metadata[key] = value;
  }

  return { metadata, content: markdownContent };
}


/**
 * Convert markdown to HTML
 */
function markdownToHtml(markdown) {
  let html = markdown;

  // Code blocks (must be first)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // YouTube embeds
  html = html.replace(/\{\{youtube:([^}]+)\}\}/g, (match, videoId) => {
    const id = extractYouTubeId(videoId);
    return `<div class="video-container">
      <iframe src="https://www.youtube.com/embed/${id}" 
              title="YouTube video" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen></iframe>
    </div>`;
  });

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  const blocks = html.split('\n\n');
  html = blocks.map(block => {
    if (block.trim() &&
      !block.startsWith('<h') &&
      !block.startsWith('<ul') &&
      !block.startsWith('<ol') &&
      !block.startsWith('<pre') &&
      !block.startsWith('<blockquote') &&
      !block.startsWith('<div') &&
      !block.startsWith('<hr')) {
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }
    return block;
  }).join('\n');

  return html;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return url;
}

/**
 * Calculate reading time
 */
function calculateReadingTime(content) {
  const words = content.split(/\s+/).length;
  return Math.ceil(words / CONFIG.wordsPerMinute);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================
// ARTICLE PROCESSING
// ============================================

/**
 * Read and parse all articles
 */
function readArticles() {
  const articles = [];

  if (!fs.existsSync(CONFIG.contentDir)) {
    console.log('No content directory found.');
    return articles;
  }

  const files = fs.readdirSync(CONFIG.contentDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(CONFIG.contentDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, content: markdownContent } = parseFrontmatter(content);

    const article = {
      ...metadata,
      content: markdownContent,
      html: markdownToHtml(markdownContent),
      readingTime: calculateReadingTime(markdownContent),
      formattedDate: formatDate(metadata.publish_date),
      categorySlug: metadata.category?.toLowerCase().replace(/\s+/g, '-'),
      authorAvatar: CONFIG.defaultAuthorAvatar,
      fileName: file
    };

    articles.push(article);
  }

  // Sort by date (newest first)
  articles.sort((a, b) =>
    new Date(b.publish_date) - new Date(a.publish_date)
  );

  return articles;
}

/**
 * Generate article pages
 */
function generateArticlePages(articles) {
  const templatePath = path.join(CONFIG.templatesDir, 'articles', 'article-template.html');

  if (!fs.existsSync(templatePath)) {
    console.log('Article template not found, skipping article generation.');
    return;
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const outputDir = path.join(CONFIG.outputDir, 'articles');
  ensureDir(outputDir);

  for (const article of articles) {
    let html = template;

    // Replace placeholders
    html = html.replace(/\{\{title\}\}/g, article.title || '');
    html = html.replace(/\{\{slug\}\}/g, article.slug || '');
    html = html.replace(/\{\{author\}\}/g, article.author || 'Editorial Team');
    html = html.replace(/\{\{category\}\}/g, article.category || '');
    html = html.replace(/\{\{category_slug\}\}/g, article.categorySlug || '');
    html = html.replace(/\{\{publish_date\}\}/g, article.publish_date || '');
    html = html.replace(/\{\{formatted_date\}\}/g, article.formattedDate || '');
    html = html.replace(/\{\{reading_time\}\}/g, article.readingTime || 5);
    html = html.replace(/\{\{excerpt\}\}/g, article.excerpt || '');
    html = html.replace(/\{\{thumbnail\}\}/g, article.thumbnail || '');
    html = html.replace(/\{\{author_avatar\}\}/g, article.authorAvatar || '');
    html = html.replace(/\{\{content\}\}/g, article.html || '');
    html = html.replace(/\{\{meta_description\}\}/g, article.excerpt || '');
    html = html.replace(/\{\{keywords\}\}/g, Array.isArray(article.tags) ? article.tags.join(', ') : '');
    html = html.replace(/\{\{modified_date\}\}/g, article.publish_date || '');

    // Style variables
    html = html.replace(/\{\{background_color\}\}/g, getColorValue('bg', article.background_color));
    html = html.replace(/\{\{page_accent\}\}/g, getColorValue('accent', article.page_accent));
    html = html.replace(/\{\{font_style\}\}/g, getFontValue(article.font_style));

    // Tags
    const tagsHtml = Array.isArray(article.tags)
      ? article.tags.map(tag =>
        `<a href="/tags/${tag}.html" class="article-tag">#${tag}</a>`
      ).join('\n      ')
      : '';
    html = html.replace(/\{\{#each tags\}\}[\s\S]*?\{\{\/each\}\}/g, tagsHtml);

    // Related articles (simplified - just show other articles)
    const related = articles
      .filter(a => a.slug !== article.slug)
      .slice(0, 3);

    const relatedHtml = related.map(a => `
        <div class="blog-card">
          <div class="blog-card-image">
            <img src="${a.thumbnail}" alt="${a.title}" loading="lazy">
            <span class="blog-card-category">${a.category}</span>
          </div>
          <div class="blog-card-body">
            <h3 class="blog-card-title">
              <a href="/articles/${a.slug}.html">${a.title}</a>
            </h3>
            <p class="blog-card-excerpt">${a.excerpt}</p>
            <div class="blog-card-meta">
              <div class="blog-card-author">
                <span>${a.author}</span>
              </div>
              <div class="blog-card-date">${a.formattedDate}</div>
            </div>
          </div>
        </div>`).join('\n');

    html = html.replace(/\{\{#each related_articles\}\}[\s\S]*?\{\{\/each\}\}/g, relatedHtml);

    // Write file
    const outputPath = path.join(outputDir, `${article.slug}.html`);
    fs.writeFileSync(outputPath, html);
    console.log(`Generated: articles/${article.slug}.html`);
  }
}

/**
 * Get color value from style map
 */
function getColorValue(type, colorName) {
  const colorMaps = {
    bg: {
      white: '#ffffff',
      gray: '#f9fafb',
      cream: '#fefce8',
      dark: '#0f172a'
    },
    accent: {
      blue: '#2563eb',
      purple: '#7c3aed',
      green: '#16a34a',
      amber: '#d97706',
      rose: '#e11d48'
    }
  };

  return colorMaps[type]?.[colorName] || colorMaps[type]?.blue || '#ffffff';
}

/**
 * Get font value
 */
function getFontValue(fontName) {
  const fonts = {
    system: 'system-ui, -apple-system, sans-serif',
    serif: 'Georgia, Cambria, serif',
    mono: 'ui-monospace, monospace'
  };

  return fonts[fontName] || fonts.system;
}

// ============================================
// CATEGORY PAGES
// ============================================

/**
 * Generate category pages
 */
function generateCategoryPages(articles) {
  const outputDir = path.join(CONFIG.outputDir, 'categories');
  ensureDir(outputDir);

  for (const [slug, category] of Object.entries(CONFIG.categories)) {
    const categoryArticles = articles.filter(a =>
      a.category?.toLowerCase() === category.name.toLowerCase()
    );

    const html = generateCategoryHtml(category, categoryArticles, slug);
    const outputPath = path.join(outputDir, `${slug}.html`);
    fs.writeFileSync(outputPath, html);
    console.log(`Generated: categories/${slug}.html`);
  }
}

/**
 * Generate HTML for a category page
 */
function generateCategoryHtml(category, articles, slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${category.description}">
  <meta property="og:title" content="${category.name} Articles | Blogi">
  <meta property="og:description" content="${category.description}">
  <title>${category.name} Articles | Blogi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/png" href="/short log.png">
  <link rel="stylesheet" href="/css/main.css">
  <style>body { font-family: 'Inter', var(--font-system); }</style>
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="header-inner">
        <a href="/" class="logo">
          <img src="/short log.png" alt="Blogi" height="40">
          <span class="logo-text">BLOGI</span>
        </a>
        <nav class="nav">
          <ul class="nav-links">
            <li><a href="/" class="nav-link">Home</a></li>
            <li><a href="/categories/technology.html" class="nav-link ${slug === 'technology' ? 'active' : ''}">Technology</a></li>
            <li><a href="/categories/business.html" class="nav-link ${slug === 'business' ? 'active' : ''}">Business</a></li>
            <li><a href="/categories/lifestyle.html" class="nav-link ${slug === 'lifestyle' ? 'active' : ''}">Lifestyle</a></li>
            <li><a href="/categories/movies.html" class="nav-link ${slug === 'movies' ? 'active' : ''}">Movies</a></li>
          </ul>
          <div class="nav-actions">
            <a href="/#newsletter" class="btn btn-gradient">Subscribe</a>
          </div>
        </nav>
      </div>
    </div>
  </header>

  <section class="category-header">
    <div class="container">
      <h1>${category.name}</h1>
      <p class="category-description">${category.description}</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">All ${category.name} Articles</h2>
        <p class="section-subtitle">${articles.length} articles in this category</p>
      </div>
      
      <div class="category-grid">
        ${articles.map(article => `
        <div class="blog-card">
          <div class="blog-card-image">
            <img src="${article.thumbnail}" alt="${article.title}" loading="lazy">
            <span class="blog-card-category">${article.category}</span>
          </div>
          <div class="blog-card-body">
            <h3 class="blog-card-title">
              <a href="/articles/${article.slug}.html">${article.title}</a>
            </h3>
            <p class="blog-card-excerpt">${article.excerpt}</p>
            <div class="blog-card-meta">
              <div class="blog-card-author">
                <span>${article.author}</span>
              </div>
              <div class="blog-card-date">${article.formattedDate}</div>
            </div>
          </div>
        </div>`).join('\n')}
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container container-narrow">
      <h2 class="section-title text-center">About ${category.name}</h2>
      <div style="margin-top: var(--spacing-6); line-height: var(--line-height-relaxed); color: var(--color-gray-600);">
        <p>${category.seoText}</p>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="footer-bottom">
        <p>&copy; 2026 Blogi. All rights reserved.</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

// ============================================
// HOMEPAGE
// ============================================

/**
 * Generate homepage with curated content
 */
function generateHomepage(articles) {
  const templatePath = path.join(CONFIG.templatesDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.log('Homepage template not found.');
    return;
  }

  // Just copy the template for now - in a real implementation,
  // you would replace the hardcoded content with dynamic content
  const template = fs.readFileSync(templatePath, 'utf-8');

  const outputPath = path.join(CONFIG.outputDir, 'index.html');
  fs.writeFileSync(outputPath, template);
  console.log('Generated: index.html');
}

// ============================================
// SITEMAP & RSS
// ============================================

/**
 * Generate sitemap.xml
 */
function generateSitemap(articles) {
  const baseUrl = 'https://blogi.com';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

  // Category pages
  for (const slug of Object.keys(CONFIG.categories)) {
    xml += `  <url>
    <loc>${baseUrl}/categories/${slug}.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  // Article pages
  for (const article of articles) {
    xml += `  <url>
    <loc>${baseUrl}/articles/${article.slug}.html</loc>
    <lastmod>${article.publish_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += '</urlset>';

  const outputPath = path.join(CONFIG.outputDir, 'sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  console.log('Generated: sitemap.xml');
}

/**
 * Generate RSS feed
 */
function generateRSS(articles) {
  const baseUrl = 'https://blogi.com';
  const recentArticles = articles.slice(0, 10);

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blogi</title>
    <link>${baseUrl}</link>
    <description>All news about Blogs in one place</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
`;

  for (const article of recentArticles) {
    rss += `    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${baseUrl}/articles/${article.slug}.html</link>
      <guid>${baseUrl}/articles/${article.slug}.html</guid>
      <pubDate>${new Date(article.publish_date).toUTCString()}</pubDate>
      <description><![CDATA[${article.excerpt}]]></description>
      <category>${article.category}</category>
    </item>
`;
  }

  rss += `  </channel>
</rss>`;

  const outputPath = path.join(CONFIG.outputDir, 'rss.xml');
  fs.writeFileSync(outputPath, rss);
  console.log('Generated: rss.xml');
}

// ============================================
// COPY STATIC ASSETS
// ============================================

/**
 * Copy static files to dist
 */
function copyStaticAssets() {
  // Copy CSS
  const cssOutputDir = path.join(CONFIG.outputDir, 'src', 'css');
  ensureDir(cssOutputDir);
  if (fs.existsSync(path.join(CONFIG.cssDir, 'main.css'))) {
    fs.copyFileSync(
      path.join(CONFIG.cssDir, 'main.css'),
      path.join(cssOutputDir, 'main.css')
    );
    console.log('Copied: src/css/main.css');
  }

  // Copy JS
  const jsOutputDir = path.join(CONFIG.outputDir, 'src', 'js');
  ensureDir(jsOutputDir);
  if (fs.existsSync(path.join(CONFIG.jsDir, 'write.js'))) {
    fs.copyFileSync(
      path.join(CONFIG.jsDir, 'write.js'),
      path.join(jsOutputDir, 'write.js')
    );
    console.log('Copied: src/js/write.js');
  }

  // Copy write page
  const pagesOutputDir = path.join(CONFIG.outputDir, 'src', 'pages');
  ensureDir(pagesOutputDir);
  const writePath = path.join(CONFIG.templatesDir, 'write.html');
  if (fs.existsSync(writePath)) {
    fs.copyFileSync(writePath, path.join(CONFIG.outputDir, 'write.html'));
    console.log('Copied: write.html');
  }
}

// ============================================
// MAIN
// ============================================

function main() {
  console.log('🚀 Blogi Static Site Generator\n');
  console.log('================================\n');

  // Ensure output directory exists
  ensureDir(CONFIG.outputDir);

  // Read all articles
  console.log('📖 Reading articles...');
  const articles = readArticles();
  console.log(`   Found ${articles.length} articles\n`);

  // Generate pages
  console.log('📝 Generating pages...');
  generateHomepage(articles);
  generateArticlePages(articles);
  generateCategoryPages(articles);

  // Generate sitemap and RSS
  console.log('\n📋 Generating sitemap and RSS...');
  generateSitemap(articles);
  generateRSS(articles);

  // Copy static assets
  console.log('\n📦 Copying static assets...');
  copyStaticAssets();

  console.log('\n================================');
  console.log('✅ Build complete!');
  console.log(`   Output: ${CONFIG.outputDir}`);
}

main();
